import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, FindOptionsWhere } from 'typeorm';
import { Transit } from './transit.entity';
import { CreateTransitDto, UpdateTransitDto } from './dto/transit.dto';
import { BaseCrudService } from '../common/services/base-crud.service';
import { AmbulanceStatus, TransitStatus } from '../common/enums';
import { Ambulance } from '../ambulances/ambulance.entity';
import { Hospital } from '../hospitals/hospital.entity';
import { City } from '../cities/city.entity';
import { EventsGateway } from '../events/events.gateway';
import { paginate, PaginatedResult } from '../common/dto/pagination.dto';

@Injectable()
export class TransitsService extends BaseCrudService<Transit> {
  constructor(
    @InjectRepository(Transit) private readonly transitRepo: Repository<Transit>,
    @InjectRepository(Ambulance) private readonly ambulanceRepo: Repository<Ambulance>,
    @InjectRepository(Hospital) private readonly hospitalRepo: Repository<Hospital>,
    @InjectRepository(City) private readonly cityRepo: Repository<City>,
    private readonly events: EventsGateway,
  ) {
    super(transitRepo);
  }

  private readonly relations = {
    ambulance: { provider: true },
    hospital: true,
    emergencyType: true,
    triageCode: true,
    sector: true,
    city: true,
    claimedBy: true,
  } as never;

  /** Hospital arrival radius for demo geofence (meters). Swap for real tracker geofence later. */
  private readonly HOSPITAL_GEOFENCE_METERS = 250;

  haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const toRad = (d: number) => (d * Math.PI) / 180;
    const R = 6371000;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  }

  async findAllPaginated(
    cityId?: string,
    page = 1,
    limit = 20,
    activeOnly = false,
  ): Promise<PaginatedResult<Transit>> {
    const where: FindOptionsWhere<Transit> = {};
    if (cityId) where.cityId = cityId;
    if (activeOnly) {
      where.status = In([TransitStatus.PENDING, TransitStatus.EN_ROUTE, TransitStatus.ARRIVED]);
    }

    const [data, total] = await this.transitRepo.findAndCount({
      where,
      relations: this.relations,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return paginate(data, total, page, limit);
  }

  list(cityId?: string) {
    return this.transitRepo.find({
      where: cityId ? { cityId } : {},
      relations: this.relations,
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }

  findOne(id: string) {
    return super.findOne(id, this.relations);
  }

  async findActiveForAmbulance(ambulanceId: string): Promise<Transit | null> {
    return this.transitRepo.findOne({
      where: {
        ambulanceId,
        status: In([TransitStatus.PENDING, TransitStatus.EN_ROUTE, TransitStatus.ARRIVED]),
      },
      relations: this.relations,
    });
  }

  findActive(cityId?: string) {
    return this.transitRepo.find({
      where: {
        status: In([TransitStatus.PENDING, TransitStatus.EN_ROUTE, TransitStatus.ARRIVED]),
        ...(cityId ? { cityId } : {}),
      },
      relations: this.relations,
      order: { createdAt: 'DESC' },
    });
  }

  findByHospital(hospitalId: string) {
    return this.transitRepo.find({
      where: {
        hospitalId,
        status: In([TransitStatus.EN_ROUTE, TransitStatus.ARRIVED]),
      },
      relations: this.relations,
      order: { etaMinutes: 'ASC' },
    });
  }

  private async generateTransitId(cityId: string): Promise<string> {
    const city = await this.cityRepo.findOne({ where: { id: cityId } });
    const prefix = city?.operationalConfig?.transitIdPrefix ?? city?.code ?? 'TRN';
    const count = await this.transitRepo.count({ where: { cityId } });
    return `${prefix}-${String(count + 1).padStart(4, '0')}`;
  }

  private async assertCapacity(cityId: string) {
    const city = await this.cityRepo.findOne({ where: { id: cityId } });
    if (!city) throw new BadRequestException('City not found');

    const activeCount = await this.transitRepo.count({
      where: {
        cityId,
        status: In([TransitStatus.PENDING, TransitStatus.EN_ROUTE, TransitStatus.ARRIVED]),
      },
    });

    const max = city.operationalConfig?.maxConcurrentTransits ?? 50;
    if (activeCount >= max) {
      throw new BadRequestException(
        `City capacity reached (${activeCount}/${max} active transits). Complete or cancel existing cases first.`,
      );
    }
  }

  private async eligibleHospitals(cityId: string, emergencyTypeId: string): Promise<Hospital[]> {
    return this.hospitalRepo
      .createQueryBuilder('hospital')
      .innerJoinAndSelect(
        'hospital.emergencyTypes',
        'emergencyType',
        'emergencyType.id = :emergencyTypeId',
        { emergencyTypeId },
      )
      .where('hospital.cityId = :cityId', { cityId })
      .orderBy('hospital.name', 'ASC')
      .getMany();
  }

  private hospitalDistanceKm(
    hospital: Hospital,
    latitude?: number | null,
    longitude?: number | null,
  ): number {
    if (latitude == null || longitude == null) return Number.POSITIVE_INFINITY;
    const toRadians = (degrees: number) => degrees * Math.PI / 180;
    const hospitalLat = Number(hospital.latitude);
    const hospitalLng = Number(hospital.longitude);
    const dLat = toRadians(hospitalLat - latitude);
    const dLng = toRadians(hospitalLng - longitude);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRadians(latitude)) *
        Math.cos(toRadians(hospitalLat)) *
        Math.sin(dLng / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  async create(dto: CreateTransitDto) {
    const ambulance = await this.ambulanceRepo.findOne({ where: { id: dto.ambulanceId } });
    if (!ambulance) throw new BadRequestException('Ambulance not found');
    if (ambulance.status !== AmbulanceStatus.AVAILABLE) {
      throw new BadRequestException('Ambulance is not available');
    }

    const eligible = await this.eligibleHospitals(ambulance.cityId, dto.emergencyTypeId);
    if (!eligible.length) {
      throw new BadRequestException(
        'No hospital in this city caters the selected emergency type',
      );
    }

    const requestedHospital = dto.hospitalId
      ? eligible.find((candidate) => candidate.id === dto.hospitalId)
      : undefined;
    if (dto.hospitalId && !requestedHospital) {
      throw new BadRequestException(
        'Selected hospital does not cater this emergency type or belongs to another city',
      );
    }

    const sourceLat = dto.originLat ?? ambulance.currentLat;
    const sourceLng = dto.originLng ?? ambulance.currentLng;
    const hasSourceLocation =
      sourceLat != null &&
      sourceLng != null &&
      Number.isFinite(Number(sourceLat)) &&
      Number.isFinite(Number(sourceLng));
    const hospital = requestedHospital ?? [...eligible].sort(
      (a, b) =>
        this.hospitalDistanceKm(a, sourceLat, sourceLng) -
        this.hospitalDistanceKm(b, sourceLat, sourceLng),
    )[0];

    await this.assertCapacity(hospital.cityId);

    const city = await this.cityRepo.findOne({ where: { id: hospital.cityId } });
    const transitId = await this.generateTransitId(hospital.cityId);
    const baseline = dto.baselineEtaMinutes ?? city?.operationalConfig?.defaultBaselineEtaMinutes ?? 15;
    const sectorId = dto.sectorId ?? hospital.sectorId ?? null;

    const transit = await super.create({
      ...dto,
      hospitalId: hospital.id,
      cityId: hospital.cityId,
      sectorId,
      transitId,
      status: TransitStatus.PENDING,
      currentLat: dto.originLat,
      currentLng: dto.originLng,
      etaMinutes: baseline,
      baselineEtaMinutes: baseline,
      claimedById: null,
      claimedAt: null,
    } as Partial<Transit>);

    const full = await this.findOne(transit.id);
    this.events.broadcastTransitUpdate(full);
    return {
      ...full,
      hospitalSelection: {
        automatic: !dto.hospitalId,
        eligibleHospitalCount: eligible.length,
        reason: dto.hospitalId
          ? 'Hospital selected by the mobile user from eligible hospitals'
          : hasSourceLocation
            ? 'Nearest hospital that caters the selected emergency type'
            : 'First eligible hospital alphabetically because no origin GPS was supplied',
      },
    };
  }

  async start(id: string, lat?: number, lng?: number) {
    const transit = await this.findOne(id);
    if (transit.status !== TransitStatus.PENDING) {
      throw new BadRequestException('Transit already started');
    }

    await this.ambulanceRepo.update(transit.ambulanceId, {
      status: AmbulanceStatus.EN_ROUTE,
      currentLat: lat ?? transit.originLat,
      currentLng: lng ?? transit.originLng,
    });

    const updated = await super.update(id, {
      status: TransitStatus.EN_ROUTE,
      startedAt: new Date(),
      currentLat: lat ?? transit.originLat,
      currentLng: lng ?? transit.originLng,
    });

    const full = await this.findOne(updated.id);
    this.events.broadcastTransitUpdate(full);
    return full;
  }

  async claim(id: string, userId: string, userSectorId?: string | null, isOverseer?: boolean) {
    const transit = await this.findOne(id);
    if (transit.status !== TransitStatus.EN_ROUTE && transit.status !== TransitStatus.PENDING) {
      throw new BadRequestException('Only active corridors can be claimed');
    }
    if (transit.claimedById) {
      throw new BadRequestException('This corridor is already claimed by another CSR');
    }
    if (!isOverseer && userSectorId && transit.sectorId && transit.sectorId !== userSectorId) {
      throw new ForbiddenException('This corridor belongs to another sector');
    }

    // CSR may only guide one ambulance at a time
    const alreadyGuiding = await this.transitRepo.findOne({
      where: {
        claimedById: userId,
        status: In([TransitStatus.PENDING, TransitStatus.EN_ROUTE, TransitStatus.ARRIVED]),
      },
    });
    if (alreadyGuiding) {
      throw new BadRequestException(
        `You are already guiding ${alreadyGuiding.transitId}. Close that guidance or wait until it completes before taking another.`,
      );
    }

    await super.update(id, {
      claimedById: userId,
      claimedAt: new Date(),
    } as Partial<Transit>);

    const full = await this.findOne(id);
    this.events.broadcastTransitUpdate(full);
    return full;
  }

  /** CSR closes live guidance early — corridor stays open, driver continues; CSR becomes free for new intimations */
  async releaseGuidance(id: string, userId: string, isOverseer?: boolean) {
    const transit = await this.findOne(id);
    if (!transit.claimedById) {
      throw new BadRequestException('This corridor is not being guided');
    }
    if (!isOverseer && transit.claimedById !== userId) {
      throw new ForbiddenException('Only the guiding CSR can close this session');
    }

    await super.update(id, {
      claimedById: null,
      claimedAt: null,
    } as Partial<Transit>);

    const full = await this.findOne(id);
    this.events.broadcastTransitUpdate(full);
    return full;
  }

  async complete(id: string) {
    const transit = await this.findOne(id);
    await this.ambulanceRepo.update(transit.ambulanceId, {
      status: AmbulanceStatus.AVAILABLE,
      currentSpeed: 0,
    });

    const updated = await super.update(id, {
      status: TransitStatus.COMPLETED,
      completedAt: new Date(),
      currentSpeed: 0,
    });

    const full = await this.findOne(updated.id);
    this.events.broadcastTransitUpdate(full);
    return full;
  }

  async markArrived(id: string) {
    await this.ambulanceRepo.update((await this.findOne(id)).ambulanceId, {
      status: AmbulanceStatus.BUSY,
      currentSpeed: 0,
    });
    const updated = await super.update(id, {
      status: TransitStatus.ARRIVED,
      arrivedAt: new Date(),
      currentSpeed: 0,
    });
    const full = await this.findOne(updated.id);
    this.events.broadcastTransitUpdate(full);
    return full;
  }

  async setPrepReady(id: string) {
    const updated = await super.update(id, { prepStatus: 'ready' as never });
    const full = await this.findOne(updated.id);
    this.events.broadcastTransitUpdate(full);
    return full;
  }

  /**
   * Called when tracker/demo GPS updates. Updates transit position and
   * auto-completes when ambulance enters hospital geofence.
   * Does NOT overwrite etaMinutes — mobile owns ETA via PATCH /transits/:id/eta
   * (or optional etaMinutes on the GPS payload).
   */
  async applyGpsUpdate(
    ambulanceId: string,
    lat: number,
    lng: number,
    speed = 0,
    etaMinutes?: number | null,
  ) {
    const active = await this.transitRepo.findOne({
      where: {
        ambulanceId,
        status: In([TransitStatus.EN_ROUTE, TransitStatus.ARRIVED]),
      },
      relations: this.relations,
      order: { createdAt: 'DESC' },
    });
    if (!active) return null;

    const remaining =
      active.hospital?.latitude != null && active.hospital?.longitude != null
        ? this.haversineMeters(lat, lng, Number(active.hospital.latitude), Number(active.hospital.longitude))
        : null;

    const patch: Partial<Transit> = {
      currentLat: lat,
      currentLng: lng,
      currentSpeed: speed,
    };
    if (etaMinutes != null && Number.isFinite(Number(etaMinutes))) {
      patch.etaMinutes = Number(etaMinutes);
    }

    await this.transitRepo.update(active.id, patch as never);

    if (
      remaining != null &&
      remaining <= this.HOSPITAL_GEOFENCE_METERS &&
      active.status === TransitStatus.EN_ROUTE
    ) {
      return this.complete(active.id);
    }

    const full = await this.findOne(active.id);
    this.events.broadcastGpsUpdate({
      ambulanceId,
      transitId: full.id,
      latitude: lat,
      longitude: lng,
      speed,
      remainingMeters: remaining,
    });
    this.events.broadcastTransitUpdate(full);
    return full;
  }

  /** Persist mobile-reported ETA (overwrites previous etaMinutes). */
  async updateEta(
    id: string,
    dto: { etaMinutes: number; currentLat?: number; currentLng?: number; currentSpeed?: number },
  ) {
    const transit = await this.findOne(id);
    if (
      transit.status !== TransitStatus.PENDING &&
      transit.status !== TransitStatus.EN_ROUTE &&
      transit.status !== TransitStatus.ARRIVED
    ) {
      throw new BadRequestException('ETA can only be updated on an active transit');
    }

    const eta = Number(dto.etaMinutes);
    if (!Number.isFinite(eta) || eta < 0) {
      throw new BadRequestException('etaMinutes must be a non-negative number');
    }

    const patch: Partial<Transit> = { etaMinutes: eta };
    if (dto.currentLat != null && Number.isFinite(Number(dto.currentLat))) {
      patch.currentLat = Number(dto.currentLat);
    }
    if (dto.currentLng != null && Number.isFinite(Number(dto.currentLng))) {
      patch.currentLng = Number(dto.currentLng);
    }
    if (dto.currentSpeed != null && Number.isFinite(Number(dto.currentSpeed))) {
      patch.currentSpeed = Number(dto.currentSpeed);
      if (transit.ambulanceId) {
        await this.ambulanceRepo.update(transit.ambulanceId, {
          currentSpeed: Number(dto.currentSpeed),
          ...(patch.currentLat != null ? { currentLat: patch.currentLat } : {}),
          ...(patch.currentLng != null ? { currentLng: patch.currentLng } : {}),
        });
      }
    } else if (patch.currentLat != null || patch.currentLng != null) {
      if (transit.ambulanceId) {
        await this.ambulanceRepo.update(transit.ambulanceId, {
          ...(patch.currentLat != null ? { currentLat: patch.currentLat } : {}),
          ...(patch.currentLng != null ? { currentLng: patch.currentLng } : {}),
        });
      }
    }

    await this.transitRepo.update(id, patch as never);
    const full = await this.findOne(id);
    this.events.broadcastTransitUpdate(full);
    this.events.broadcastDashboardRefresh();
    return full;
  }

  update(id: string, dto: UpdateTransitDto | Partial<Transit>) {
    return super.update(id, dto as Partial<Transit>).then(async (t) => {
      const full = await this.findOne(t.id);
      this.events.broadcastTransitUpdate(full);
      return full;
    });
  }

  /** Admin delete case — clear GPS rows, free ambulance, remove transit */
  async remove(id: string): Promise<void> {
    const transit = await this.findOne(id);
    await this.transitRepo.manager.transaction(async (em) => {
      await em.query(`DELETE FROM gps_locations WHERE transit_id = $1`, [id]);
      await em.delete(Transit, { id });
      if (transit.ambulanceId) {
        await em.update(
          Ambulance,
          { id: transit.ambulanceId },
          { status: AmbulanceStatus.AVAILABLE, currentSpeed: 0 },
        );
      }
    });
    this.events.broadcastDashboardRefresh();
  }
}
