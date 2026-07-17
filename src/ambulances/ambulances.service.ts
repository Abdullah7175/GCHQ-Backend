import { Injectable, Inject, forwardRef, OnModuleInit, OnModuleDestroy, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, IsNull, In } from 'typeorm';
import { Ambulance } from './ambulance.entity';
import { CreateAmbulanceDto, UpdateAmbulanceDto, UpdateGpsDto } from './dto/ambulance.dto';
import { BaseCrudService } from '../common/services/base-crud.service';
import { GpsLocation } from '../gps/gps-location.entity';
import { Transit } from '../transits/transit.entity';
import { EventsGateway } from '../events/events.gateway';
import { AmbulanceStatus } from '../common/enums';
import { TransitsService } from '../transits/transits.service';
import { GpsCacheService } from '../gps/gps-cache.service';

@Injectable()
export class AmbulancesService extends BaseCrudService<Ambulance> implements OnModuleInit, OnModuleDestroy {
  private gpsUrlInterval: NodeJS.Timeout | null = null;

  constructor(
    @InjectRepository(Ambulance) private readonly ambulanceRepo: Repository<Ambulance>,
    @InjectRepository(GpsLocation) private readonly gpsRepo: Repository<GpsLocation>,
    private readonly events: EventsGateway,
    @Inject(forwardRef(() => TransitsService))
    private readonly transitsService: TransitsService,
    @Inject(forwardRef(() => GpsCacheService))
    private readonly gpsCacheService: GpsCacheService,
  ) {
    super(ambulanceRepo);
  }

  onModuleInit() {
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


  findByCity(cityId?: string, page?: number, limit?: number) {
    return super.findAll(
      {
        where: cityId ? { cityId } : {},
        relations: { provider: true, driver: true, city: true } as never,
        order: { unitNumber: 'ASC' },
      },
      page,
      limit
    );
  }

  findOne(id: string) {
    return super.findOne(id, { provider: true, driver: true, city: true } as never);
  }

  create(dto: CreateAmbulanceDto) {
    return super.create(dto as Partial<Ambulance>);
  }

  update(id: string, dto: UpdateAmbulanceDto) {
    return super.update(id, dto as Partial<Ambulance>);
  }

  /** Delete ambulance and dependent GPS / transit rows first (FK-safe). */
  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.ambulanceRepo.manager.transaction(async (em) => {
      const transitIds = (
        await em.find(Transit, { where: { ambulanceId: id }, select: { id: true } })
      ).map((t) => t.id);

      if (transitIds.length > 0) {
        await em.delete(GpsLocation, { transitId: In(transitIds) });
        await em.delete(Transit, { ambulanceId: id });
      }

      await em.delete(GpsLocation, { ambulanceId: id });
      await em.delete(Ambulance, { id });
    });
  }

  async updateGps(id: string, dto: UpdateGpsDto, transitId?: string) {
    const lat = Number(dto.latitude);
    const lng = Number(dto.longitude);
    const speed = dto.speed != null ? Number(dto.speed) : 0;
    const heading = dto.heading != null ? Number(dto.heading) : null;

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      throw new BadRequestException('Invalid latitude/longitude');
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

  /** Assigned unit for the logged-in paramedic (driverId = user id) */
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

