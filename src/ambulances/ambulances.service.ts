import { Injectable, Inject, forwardRef, OnModuleInit, OnModuleDestroy, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, IsNull, In } from 'typeorm';
import { Ambulance } from './ambulance.entity';
import { CreateAmbulanceDto, UpdateAmbulanceDto, UpdateGpsDto } from './dto/ambulance.dto';
import { BaseCrudService } from '../common/services/base-crud.service';
import { GpsLocation } from '../gps/gps-location.entity';
import { Transit } from '../transits/transit.entity';
import { EventsGateway } from '../events/events.gateway';
import { AmbulanceStatus, TransitStatus } from '../common/enums';
import { TransitsService } from '../transits/transits.service';
import { GpsCacheService } from '../gps/gps-cache.service';
import { User } from '../users/user.entity';
import { UserRole } from '../common/enums';

@Injectable()
export class AmbulancesService extends BaseCrudService<Ambulance> implements OnModuleInit, OnModuleDestroy {
  private gpsUrlInterval: NodeJS.Timeout | null = null;

  constructor(
    @InjectRepository(Ambulance) private readonly ambulanceRepo: Repository<Ambulance>,
    @InjectRepository(GpsLocation) private readonly gpsRepo: Repository<GpsLocation>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly events: EventsGateway,
    @Inject(forwardRef(() => TransitsService))
    private readonly transitsService: TransitsService,
    @Inject(forwardRef(() => GpsCacheService))
    private readonly gpsCacheService: GpsCacheService,
  ) {
    super(ambulanceRepo);
  }

  async onModuleInit() {
    // Compatibility backfill for deployments upgrading from single-driver assignment.
    await this.ambulanceRepo.query(`
      INSERT INTO "ambulance_drivers" ("ambulance_id", "user_id")
      SELECT "id", "driver_id"
      FROM "ambulances"
      WHERE "driver_id" IS NOT NULL
      ON CONFLICT DO NOTHING
    `);
    this.gpsUrlInterval = setInterval(() => this.crawlGpsUrls(), 5000);
  }

  onModuleDestroy() {
    if (this.gpsUrlInterval) {
      clearInterval(this.gpsUrlInterval);
    }
  }

  async crawlGpsUrls() {
    try {
      const ambulances = await this.ambulanceRepo.find({
        where: {
          gpsUrl: Not(IsNull()),
        },
      });
      for (const a of ambulances) {
        if (!a.gpsUrl) continue;
        this.fetchAmbulanceGps(a).catch(() => {});
      }
    } catch (_) {}
  }

  async fetchAmbulanceGps(a: Ambulance) {
    try {
      let headers = {};
      if (a.gpsHeaders) {
        try {
          headers = JSON.parse(a.gpsHeaders);
        } catch (_) {
          console.warn(`Invalid JSON headers format for ambulance ${a.unitNumber}`);
        }
      }
      const res = await fetch(a.gpsUrl!, { headers });
      if (!res.ok) throw new Error(`HTTP status ${res.status}`);
      const data = await res.json();
      
      const lat = Number(data.lat ?? data.latitude ?? data.latlng?.[0] ?? data.coords?.[0]);
      const lng = Number(data.lng ?? data.longitude ?? data.lon ?? data.long ?? data.latlng?.[1] ?? data.coords?.[1]);
      const speed = Number(data.speed ?? data.velocity ?? data.currentSpeed ?? 0);
      const heading = Number(data.heading ?? data.bearing ?? data.direction ?? 0);

      if (!isNaN(lat) && !isNaN(lng)) {
        const activeTransit = await this.transitsService.findActiveForAmbulance(a.id);
        await this.updateGps(a.id, { latitude: lat, longitude: lng, speed, heading }, activeTransit?.id);
      }
    } catch (err) {
      console.warn(`GPS Feed URL crawler error for ambulance ${a.unitNumber}:`, err.message);
    }
  }


  findByCity(cityId?: string, page?: number, limit?: number, q?: string) {
    if (!q?.trim()) {
      return super.findAll(
        {
          where: cityId ? { cityId } : {},
          relations: { provider: true, driver: true, assignedDrivers: true, city: true } as never,
          order: { unitNumber: 'ASC' },
        },
        page,
        limit,
      );
    }
    const qb = this.ambulanceRepo
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.provider', 'provider')
      .leftJoinAndSelect('a.driver', 'driver')
      .leftJoinAndSelect('a.assignedDrivers', 'assignedDrivers')
      .leftJoinAndSelect('a.city', 'city')
      .orderBy('a.unitNumber', 'ASC');
    if (cityId) qb.andWhere('a.cityId = :cityId', { cityId });
    qb.andWhere(
      '(a.unitNumber ILIKE :q OR provider.name ILIKE :q OR CAST(a.status AS text) ILIKE :q)',
      { q: `%${q.trim()}%` },
    );
    if (page && limit) {
      return qb
        .skip((page - 1) * limit)
        .take(limit)
        .getManyAndCount()
        .then(([data, total]) => ({
          data,
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit) || 1,
        }));
    }
    return qb.getMany();
  }

  findOne(id: string) {
    return super.findOne(
      id,
      { provider: true, driver: true, assignedDrivers: true, city: true } as never,
    );
  }

  async create(dto: CreateAmbulanceDto) {
    const driverIds = dto.driverIds ?? (dto.driverId ? [dto.driverId] : []);
    const assignedDrivers = await this.resolveAssignedDrivers(
      driverIds,
      dto.cityId,
      dto.providerId,
    );
    const { driverIds: _driverIds, driverId: _legacyDriverId, ...data } = dto;
    const ambulance = this.ambulanceRepo.create({
      ...data,
      driverId: null,
      assignedDrivers,
    });
    return this.ambulanceRepo.save(ambulance);
  }

  async update(id: string, dto: UpdateAmbulanceDto) {
    const ambulance = await this.findOne(id);
    const assignmentWasProvided = dto.driverIds !== undefined || dto.driverId !== undefined;
    const driverIds = dto.driverIds ?? (dto.driverId ? [dto.driverId] : []);
    const cityId = dto.cityId ?? ambulance.cityId;
    const providerId = dto.providerId ?? ambulance.providerId;
    const { driverIds: _driverIds, driverId: _legacyDriverId, ...data } = dto;

    Object.assign(ambulance, data);
    if (assignmentWasProvided) {
      ambulance.assignedDrivers = await this.resolveAssignedDrivers(
        driverIds,
        cityId,
        providerId,
        id,
      );
      if (
        ambulance.driverId &&
        !ambulance.assignedDrivers.some((driver) => driver.id === ambulance.driverId)
      ) {
        ambulance.driverId = null;
        ambulance.driver = null;
      }
    }
    return this.ambulanceRepo.save(ambulance);
  }

  private async resolveAssignedDrivers(
    driverIds: string[],
    cityId: string,
    providerId: string,
    ambulanceId?: string,
  ): Promise<User[]> {
    if (driverIds.length === 0) return [];
    if (driverIds.length > 3) {
      throw new BadRequestException('An ambulance can have at most three assigned drivers');
    }

    const drivers = await this.userRepo.find({ where: { id: In(driverIds) } });
    if (drivers.length !== driverIds.length) {
      throw new BadRequestException('One or more selected drivers do not exist');
    }

    for (const driver of drivers) {
      if (driver.role !== UserRole.PARAMEDIC) {
        throw new BadRequestException(`${driver.email} is not a paramedic account`);
      }
      if (driver.cityId && driver.cityId !== cityId) {
        throw new BadRequestException(`${driver.email} belongs to another city`);
      }
      if (driver.providerId && driver.providerId !== providerId) {
        throw new BadRequestException(`${driver.email} belongs to another fleet provider`);
      }

      const assignedElsewhere = await this.ambulanceRepo
        .createQueryBuilder('ambulance')
        .innerJoin('ambulance.assignedDrivers', 'assignedDriver', 'assignedDriver.id = :driverId', {
          driverId: driver.id,
        })
        .andWhere(ambulanceId ? 'ambulance.id <> :ambulanceId' : '1 = 1', { ambulanceId })
        .getOne();
      if (assignedElsewhere) {
        throw new BadRequestException(
          `${driver.email} is already assigned to ${assignedElsewhere.unitNumber}`,
        );
      }
    }
    return drivers;
  }

  /** Delete ambulance without wiping completed case history. */
  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.ambulanceRepo.manager.transaction(async (em) => {
      const active = await em.find(Transit, {
        where: {
          ambulanceId: id,
          status: In([
            TransitStatus.PENDING,
            TransitStatus.EN_ROUTE,
            TransitStatus.ARRIVED,
          ]),
        },
        select: { id: true },
      });
      const activeIds = active.map((t) => t.id);
      if (activeIds.length > 0) {
        await em.delete(GpsLocation, { transitId: In(activeIds) });
        await em.delete(Transit, { id: In(activeIds) });
      }

      // Keep completed/cancelled cases — detach from this unit
      await em.update(Transit, { ambulanceId: id }, { ambulanceId: null });
      await em.query(
        `DELETE FROM gps_locations WHERE ambulance_id = $1 AND transit_id IS NULL`,
        [id],
      );
      await em.delete(Ambulance, { id });
    });
  }

  async updateGps(id: string, dto: UpdateGpsDto, transitId?: string, driverId?: string) {
    const lat = Number(dto.latitude);
    const lng = Number(dto.longitude);
    const speed = dto.speed != null ? Number(dto.speed) : 0;
    const heading = dto.heading != null ? Number(dto.heading) : null;

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      throw new BadRequestException('Invalid latitude/longitude');
    }

    const currentAmbulance = await this.findOne(id);
    if (driverId && currentAmbulance.driverId !== driverId) {
      throw new BadRequestException(
        'This driver session is not active for the selected ambulance',
      );
    }

    // Always persist live position on the ambulance row (what HQ/admin maps read as fleet GPS)
    await this.ambulanceRepo.update(id, {
      currentLat: lat,
      currentLng: lng,
      currentSpeed: Number.isFinite(speed) ? speed : 0,
    });

    const ambulance = await this.findOne(id);

    // Also push into active transit + GPS log buffer + geofence
    const transit = await this.gpsCacheService.update({
      ambulanceId: id,
      transitId: transitId ?? null,
      latitude: lat,
      longitude: lng,
      speed: Number.isFinite(speed) ? speed : 0,
      heading,
      recordedAt: new Date(),
      etaMinutes: dto.etaMinutes != null ? Number(dto.etaMinutes) : undefined,
    });

    this.events.broadcastGpsUpdate({
      ambulanceId: id,
      transitId: transit?.id ?? transitId ?? null,
      cityId: ambulance.cityId,
      latitude: lat,
      longitude: lng,
      speed: Number.isFinite(speed) ? speed : 0,
      heading,
    });
    this.events.broadcastDashboardRefresh(ambulance.cityId);

    return {
      ok: true,
      ambulance: {
        id: ambulance.id,
        unitNumber: ambulance.unitNumber,
        currentLat: Number(ambulance.currentLat),
        currentLng: Number(ambulance.currentLng),
        currentSpeed: Number(ambulance.currentSpeed),
        status: ambulance.status,
      },
      transit: transit
        ? {
            id: transit.id,
            transitId: transit.transitId,
            status: transit.status,
            currentLat: Number(transit.currentLat),
            currentLng: Number(transit.currentLng),
            etaMinutes: transit.etaMinutes,
          }
        : null,
      recordedAt: new Date().toISOString(),
    };
  }

  /** Unit for the currently active shift driver. Login sets driverId atomically. */
  /** Completed transit history for Admin Cases search by unit + date. */
  findTransitHistory(ambulanceId: string, from?: string, to?: string) {
    return this.transitsService.findHistoryByAmbulance(ambulanceId, from, to);
  }

  async findMine(driverId: string) {
    const ambulance = await this.ambulanceRepo.findOne({
      where: { driverId },
      relations: { provider: true, city: true, driver: true } as never,
    });
    if (!ambulance) return null;

    const activeTransit = await this.transitsService.findActiveForAmbulance(ambulance.id);
    return {
      ambulance: {
        id: ambulance.id,
        unitNumber: ambulance.unitNumber,
        status: ambulance.status,
        cityId: ambulance.cityId,
        providerId: ambulance.providerId,
        currentLat: ambulance.currentLat != null ? Number(ambulance.currentLat) : null,
        currentLng: ambulance.currentLng != null ? Number(ambulance.currentLng) : null,
        currentSpeed: Number(ambulance.currentSpeed ?? 0),
        provider: ambulance.provider,
        city: ambulance.city,
      },
      activeTransit: activeTransit
        ? {
            id: activeTransit.id,
            transitId: activeTransit.transitId,
            status: activeTransit.status,
            hospital: activeTransit.hospital,
            currentLat: activeTransit.currentLat != null ? Number(activeTransit.currentLat) : null,
            currentLng: activeTransit.currentLng != null ? Number(activeTransit.currentLng) : null,
          }
        : null,
    };
  }

  findAvailable(cityId?: string) {
    return this.ambulanceRepo.find({
      where: {
        status: AmbulanceStatus.AVAILABLE,
        ...(cityId ? { cityId } : {}),
      },
      relations: { provider: true, city: true } as never,
    });
  }
}

