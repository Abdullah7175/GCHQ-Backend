import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, FindOptionsWhere, Between, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';
import { Transit } from './transit.entity';
import { CreateTransitDto, UpdateTransitDto } from './dto/transit.dto';
import { BaseCrudService } from '../common/services/base-crud.service';
import { AmbulanceStatus, TransitStatus, UserRole } from '../common/enums';
import { Ambulance } from '../ambulances/ambulance.entity';
import { Hospital } from '../hospitals/hospital.entity';
import { City } from '../cities/city.entity';
import { EventsGateway } from '../events/events.gateway';
import { JwtPayload } from '../auth/jwt.strategy';
import { LatencyService } from '../latency/latency.service';
import { LatencyBreachRecord } from '../latency/latency-breach-record.entity';
import { HospitalGeofencesService } from '../geofences/hospital-geofences.service';
import { DEFAULT_CITY_CONFIG } from '../cities/city-operational-config';
import { isInsideGeofence, haversineMeters as geoHaversine } from '../geofences/geofence.util';
import { RouteEtaService } from '../eta/route-eta.service';
import { OsrmRoutingService } from '../eta/osrm-routing.service';
import { EtaCalibrationService } from '../eta/eta-calibration.service';

export interface TransitCaseDetails extends Transit {
  totalDistanceMeters: number | null;
  etaBreach: LatencyBreachRecord | null;
  etaBreaches: LatencyBreachRecord[];
  breached: boolean;
}

export interface TransitListFilters {
  ambulanceId?: string;
  status?: string;
  from?: string;
  to?: string;
  activeOnly?: boolean;
}

@Injectable()
export class TransitsService extends BaseCrudService<Transit> {
  constructor(
    @InjectRepository(Transit) private readonly transitRepo: Repository<Transit>,
    @InjectRepository(Ambulance) private readonly ambulanceRepo: Repository<Ambulance>,
    @InjectRepository(Hospital) private readonly hospitalRepo: Repository<Hospital>,
    @InjectRepository(City) private readonly cityRepo: Repository<City>,
    private readonly events: EventsGateway,
    private readonly latencyService: LatencyService,
    private readonly geofencesService: HospitalGeofencesService,
    private readonly routeEta: RouteEtaService,
    private readonly osrm: OsrmRoutingService,
    private readonly etaCalibration: EtaCalibrationService,
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

  haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
    return geoHaversine(lat1, lng1, lat2, lng2);
  }

  private async tryGeofenceAutoComplete(
    active: Transit,
    lat: number,
    lng: number,
  ): Promise<Transit | null> {
    if (active.status !== TransitStatus.EN_ROUTE || !active.hospitalId) return null;

    const city = await this.cityRepo.findOne({ where: { id: active.cityId } });
    const config = { ...DEFAULT_CITY_CONFIG, ...(city?.operationalConfig ?? {}) };
    if (!config.geofenceAutoCompleteEnabled) return null;

    const geofence = await this.geofencesService.findForHospital(active.hospitalId);
    if (!geofence) return null;

    const inside = isInsideGeofence(lat, lng, {
      shapeType: geofence.shapeType,
      centerLat: Number(geofence.centerLat),
      centerLng: Number(geofence.centerLng),
      radiusMeters: geofence.radiusMeters,
      boundaryPoints: (geofence.boundaryPoints ?? []).map((p) => ({
        latitude: Number(p.latitude),
        longitude: Number(p.longitude),
      })),
    });
    const delayMs = (config.geofenceAutoCompleteDelaySeconds ?? 10) * 1000;
    const now = Date.now();

    if (!inside) {
      if (active.geofenceEnteredAt) {
        await this.transitRepo.update(active.id, { geofenceEnteredAt: null });
      }
      return null;
    }

    if (!active.geofenceEnteredAt) {
      await this.transitRepo.update(active.id, { geofenceEnteredAt: new Date(now) });
      return null;
    }

    if (now - active.geofenceEnteredAt.getTime() >= delayMs) {
      await this.transitRepo.update(active.id, { geofenceEnteredAt: null });
      return this.complete(active.id);
    }

    return null;
  }

  private parseDayBound(iso: string, endOfDay: boolean): Date {
    const raw = iso.trim();
    // Date-only (YYYY-MM-DD) → bound to local calendar day in UTC wall-clock
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      return endOfDay
        ? new Date(`${raw}T23:59:59.999Z`)
        : new Date(`${raw}T00:00:00.000Z`);
    }
    return new Date(raw);
  }

  private buildStartedAtFilter(from?: string, to?: string): FindOptionsWhere<Transit>['startedAt'] | undefined {
    if (!from && !to) return undefined;
    if (from && to) {
      return Between(this.parseDayBound(from, false), this.parseDayBound(to, true));
    }
    if (from) return MoreThanOrEqual(this.parseDayBound(from, false));
    return LessThanOrEqual(this.parseDayBound(to!, true));
  }

  async findAllPaginated(
    cityId?: string,
    page = 1,
    limit = 20,
    filters: TransitListFilters = {},
  ): Promise<{ data: Transit[]; total: number; page: number; limit: number; totalPages: number }> {
    const where: FindOptionsWhere<Transit> = {};
    if (cityId) where.cityId = cityId;
    if (filters.ambulanceId) where.ambulanceId = filters.ambulanceId;
    if (filters.activeOnly) {
      where.status = In([TransitStatus.PENDING, TransitStatus.EN_ROUTE, TransitStatus.ARRIVED]);
    } else if (filters.status) {
      where.status = filters.status as TransitStatus;
    }
    const startedAt = this.buildStartedAtFilter(filters.from, filters.to);
    if (startedAt) where.startedAt = startedAt;

    const [data, total] = await this.transitRepo.findAndCount({
      where,
      relations: this.relations,
      order: { startedAt: 'DESC', createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  /** Completed cases for one ambulance in an optional date range (Admin / ops history). */
  async findHistoryByAmbulance(ambulanceId: string, from?: string, to?: string): Promise<Transit[]> {
    const where: FindOptionsWhere<Transit> = {
      ambulanceId,
      status: TransitStatus.COMPLETED,
    };
    const startedAt = this.buildStartedAtFilter(from, to);
    if (startedAt) where.startedAt = startedAt;

    return this.transitRepo.find({
      where,
      relations: this.relations,
      order: { startedAt: 'DESC', completedAt: 'DESC' },
      take: 500,
    });
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

  async findCaseDetails(id: string): Promise<TransitCaseDetails> {
    const transit = await this.findOne(id);
    const etaBreaches = await this.latencyService.findTransitEtaBreaches(id);
    return {
      ...(transit as Transit),
      totalDistanceMeters: transit.routeDistanceMeters,
      etaBreach: etaBreaches[0] ?? null,
      etaBreaches,
      breached: etaBreaches.length > 0,
    };
  }

  /** Prefer OSRM plan distance; fall back to straight-line origin→hospital. */
  private resolveTotalDistanceMeters(transit: Transit): number | null {
    if (transit.routeDistanceMeters != null && Number.isFinite(Number(transit.routeDistanceMeters))) {
      return Math.round(Number(transit.routeDistanceMeters));
    }
    if (
      transit.originLat != null &&
      transit.originLng != null &&
      transit.hospital?.latitude != null &&
      transit.hospital?.longitude != null
    ) {
      return Math.round(
        this.haversineMeters(
          Number(transit.originLat),
          Number(transit.originLng),
          Number(transit.hospital.latitude),
          Number(transit.hospital.longitude),
        ),
      );
    }
    return null;
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

  private async cityHospitals(cityId: string): Promise<Hospital[]> {
    return this.hospitalRepo
      .createQueryBuilder('hospital')
      .leftJoinAndSelect('hospital.emergencyTypes', 'emergencyType')
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

  private async assertParamedicOwnsAmbulance(
    actor: Pick<JwtPayload, 'sub' | 'role'> | undefined,
    ambulanceId: string | null | undefined,
  ) {
    if (!actor || actor.role !== UserRole.PARAMEDIC) return;
    if (!ambulanceId) {
      throw new ForbiddenException('No ambulance is linked to this transit');
    }
    const ambulance = await this.ambulanceRepo.findOne({
      where: { id: ambulanceId },
      select: { id: true, driverId: true },
    });
    if (!ambulance || ambulance.driverId !== actor.sub) {
      throw new ForbiddenException(
        'Only the active shift driver for this ambulance can perform this action',
      );
    }
  }

  async create(dto: CreateTransitDto, actor?: Pick<JwtPayload, 'sub' | 'role'>) {
    const ambulance = await this.ambulanceRepo.findOne({ where: { id: dto.ambulanceId } });
    if (!ambulance) throw new BadRequestException('Ambulance not found');
    await this.assertParamedicOwnsAmbulance(actor, ambulance.id);
    if (ambulance.status !== AmbulanceStatus.AVAILABLE) {
      throw new BadRequestException('Ambulance is not available');
    }

    const hospitals = await this.cityHospitals(ambulance.cityId);
    if (!hospitals.length) {
      throw new BadRequestException('No hospital is configured in the ambulance city');
    }

    const requestedHospital = dto.hospitalId
      ? hospitals.find((candidate) => candidate.id === dto.hospitalId)
      : undefined;
    if (dto.hospitalId && !requestedHospital) {
      throw new BadRequestException(
        'Selected hospital does not belong to the ambulance city',
      );
    }

    const sourceLat = dto.originLat ?? ambulance.currentLat;
    const sourceLng = dto.originLng ?? ambulance.currentLng;
    const hasSourceLocation =
      sourceLat != null &&
      sourceLng != null &&
      Number.isFinite(Number(sourceLat)) &&
      Number.isFinite(Number(sourceLng));
    const sortedByDistance = [...hospitals].sort(
      (a, b) =>
        this.hospitalDistanceKm(a, sourceLat, sourceLng) -
        this.hospitalDistanceKm(b, sourceLat, sourceLng),
    );
    const capableHospitals = sortedByDistance.filter((candidate) =>
      candidate.emergencyTypes.some((type) => type.id === dto.emergencyTypeId),
    );
    const hospital =
      requestedHospital ??
      capableHospitals[0] ??
      sortedByDistance[0];

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
      hospitalChoiceConsent: dto.hospitalChoiceConsent,
      claimedById: null,
      claimedAt: null,
    } as Partial<Transit>);

    const full = await this.findOne(transit.id);
    this.events.broadcastTransitUpdate(full);
    return {
      ...full,
      hospitalSelection: {
        automatic: !dto.hospitalId,
        availableHospitalCount: hospitals.length,
        capableHospitalCount: capableHospitals.length,
        selectedHospitalCatersEmergency: hospital.emergencyTypes.some(
          (type) => type.id === dto.emergencyTypeId,
        ),
        patientConsentOverride: Boolean(
          requestedHospital &&
          !requestedHospital.emergencyTypes.some((type) => type.id === dto.emergencyTypeId),
        ),
        reason: dto.hospitalId
          ? 'Hospital selected by the mobile user; patient-consent override is allowed'
          : hasSourceLocation
            ? capableHospitals.length
              ? 'Nearest hospital that caters the selected emergency type'
              : 'Nearest hospital because no hospital is configured for this emergency type'
            : capableHospitals.length
              ? 'First capable hospital alphabetically because no origin GPS was supplied'
              : 'First city hospital alphabetically because no origin GPS was supplied',
      },
    };
  }

  async start(
    id: string,
    lat?: number,
    lng?: number,
    actor?: Pick<JwtPayload, 'sub' | 'role'>,
  ) {
    const transit = await this.findOne(id);
    await this.assertParamedicOwnsAmbulance(actor, transit.ambulanceId);
    if (transit.status !== TransitStatus.PENDING) {
      throw new BadRequestException('Transit already started');
    }
    if (!transit.ambulanceId) {
      throw new BadRequestException('Transit has no ambulance assigned');
    }

    const startLat = lat ?? Number(transit.originLat);
    const startLng = lng ?? Number(transit.originLng);
    const hospitalLat = transit.hospital?.latitude != null ? Number(transit.hospital.latitude) : null;
    const hospitalLng = transit.hospital?.longitude != null ? Number(transit.hospital.longitude) : null;

    await this.ambulanceRepo.update(transit.ambulanceId, {
      status: AmbulanceStatus.EN_ROUTE,
      currentLat: Number.isFinite(startLat) ? startLat : transit.originLat,
      currentLng: Number.isFinite(startLng) ? startLng : transit.originLng,
    });

    const startedAt = new Date();
    let etaMinutes = transit.etaMinutes ?? transit.baselineEtaMinutes;
    let routeGeometry: [number, number][] | null = null;
    let routeDistanceMeters: number | null = null;
    let staticDurationSeconds: number | null = null;

    // Plan route via OSRM and set promised ETA (fixed for breach) from static duration × city/hour factor.
    if (
      Number.isFinite(startLat) &&
      Number.isFinite(startLng) &&
      hospitalLat != null &&
      hospitalLng != null &&
      Number.isFinite(hospitalLat) &&
      Number.isFinite(hospitalLng)
    ) {
      const route = await this.osrm.getDrivingRoute(startLat, startLng, hospitalLat, hospitalLng);
      if (route) {
        routeGeometry = route.coordinatesLngLat;
        routeDistanceMeters = route.distanceMeters;
        staticDurationSeconds = route.durationSeconds;
        const hour = startedAt.getHours();
        const factor = await this.etaCalibration.getCorrectionFactor(transit.cityId, hour);
        etaMinutes = this.routeEta.computeInitialPromisedMinutes(route.durationSeconds, factor);
        this.routeEta.registerRoute(transit.id, route.coordinatesLngLat);
      }
    }

    const estimatedArrivalAt = this.latencyService.computeEstimatedArrival(
      startedAt,
      etaMinutes != null ? Number(etaMinutes) : null,
    );

    const updated = await super.update(id, {
      status: TransitStatus.EN_ROUTE,
      startedAt,
      estimatedArrivalAt,
      etaMinutes: etaMinutes != null ? Number(etaMinutes) : null,
      baselineEtaMinutes: etaMinutes != null ? Number(etaMinutes) : transit.baselineEtaMinutes,
      currentLat: Number.isFinite(startLat) ? startLat : transit.originLat,
      currentLng: Number.isFinite(startLng) ? startLng : transit.originLng,
      routeGeometry,
      routeDistanceMeters,
      staticDurationSeconds,
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

  async complete(id: string, actor?: Pick<JwtPayload, 'sub' | 'role'>) {
    const transit = await this.findOne(id);
    await this.assertParamedicOwnsAmbulance(actor, transit.ambulanceId);
    if (transit.status === TransitStatus.COMPLETED) {
      return transit;
    }
    if (
      transit.status !== TransitStatus.PENDING &&
      transit.status !== TransitStatus.EN_ROUTE &&
      transit.status !== TransitStatus.ARRIVED
    ) {
      throw new BadRequestException(`Cannot complete a transit in status "${transit.status}"`);
    }

    if (transit.ambulanceId) {
      await this.ambulanceRepo.update(transit.ambulanceId, {
        status: AmbulanceStatus.AVAILABLE,
        currentSpeed: 0,
      });
    }

    const totalDistanceMeters = this.resolveTotalDistanceMeters(transit);

    const updated = await super.update(id, {
      status: TransitStatus.COMPLETED,
      completedAt: new Date(),
      currentSpeed: 0,
      ...(transit.arrivedAt ? {} : { arrivedAt: new Date() }),
      ...(totalDistanceMeters != null ? { routeDistanceMeters: totalDistanceMeters } : {}),
    });

    // Row stays in `transits` with status=completed — never deleted on complete
    const full = await this.findOne(updated.id);
    this.routeEta.clearRoute(full.id);
    await this.latencyService.evaluateTransitArrival(full);
    this.events.broadcastTransitUpdate(full);
    this.events.broadcastDashboardRefresh(full.cityId);
    return full;
  }

  async markArrived(id: string, actor?: Pick<JwtPayload, 'sub' | 'role'>) {
    const transit = await this.findOne(id);
    await this.assertParamedicOwnsAmbulance(actor, transit.ambulanceId);
    if (transit.ambulanceId) {
      await this.ambulanceRepo.update(transit.ambulanceId, {
        status: AmbulanceStatus.BUSY,
        currentSpeed: 0,
      });
    }
    const updated = await super.update(id, {
      status: TransitStatus.ARRIVED,
      arrivedAt: new Date(),
      currentSpeed: 0,
    });
    const full = await this.findOne(updated.id);
    this.routeEta.clearRoute(full.id);
    await this.latencyService.evaluateTransitArrival(full);
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
   * Called on each GPS ping. Updates position and live etaMinutes from route
   * geometry + rolling speed. Does NOT change estimatedArrivalAt (promised ETA
   * for breach stays fixed from corridor start).
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

    // Prefer server-side live ETA from stored route; fall back to client-supplied minutes.
    if (active.status === TransitStatus.EN_ROUTE) {
      this.routeEta.ensureRouteCached(active.id, active.routeGeometry);
      let live = await this.routeEta.onGpsPing({
        transitId: active.id,
        lat,
        lng,
        timestamp: Date.now(),
      });

      // Off-route: re-plan from current position (keeps promised estimatedArrivalAt).
      if (live?.needsReroute && active.hospital?.latitude != null && active.hospital?.longitude != null) {
        const route = await this.osrm.getDrivingRoute(
          lat,
          lng,
          Number(active.hospital.latitude),
          Number(active.hospital.longitude),
        );
        if (route) {
          patch.routeGeometry = route.coordinatesLngLat;
          // Keep routeDistanceMeters from the initial plan — that is total trip distance for case records.
          // Keep original staticDurationSeconds for calibration against first plan.
          this.routeEta.registerRoute(active.id, route.coordinatesLngLat);
          live = await this.routeEta.onGpsPing({
            transitId: active.id,
            lat,
            lng,
            timestamp: Date.now(),
          });
        }
      }

      if (live) {
        patch.etaMinutes = live.etaMinutes;
      } else if (etaMinutes != null && Number.isFinite(Number(etaMinutes))) {
        patch.etaMinutes = Number(etaMinutes);
      }
    } else if (etaMinutes != null && Number.isFinite(Number(etaMinutes))) {
      patch.etaMinutes = Number(etaMinutes);
    }

    await this.transitRepo.update(active.id, patch as never);

    const autoCompleted = await this.tryGeofenceAutoComplete(active, lat, lng);
    if (autoCompleted) {
      this.routeEta.clearRoute(active.id);
      return autoCompleted;
    }

    const full = await this.findOne(active.id);
    this.events.broadcastGpsUpdate({
      ambulanceId,
      transitId: full.id,
      cityId: full.cityId,
      latitude: lat,
      longitude: lng,
      speed,
      remainingMeters: remaining,
      etaMinutes: full.etaMinutes,
    });
    this.events.broadcastTransitUpdate(full);
    return full;
  }

  /**
   * Mobile-reported live ETA. Updates display etaMinutes only —
   * estimatedArrivalAt (promised) stays fixed for breach evaluation.
   */
  async updateEta(
    id: string,
    dto: { etaMinutes: number; currentLat?: number; currentLng?: number; currentSpeed?: number },
    actor?: Pick<JwtPayload, 'sub' | 'role'>,
  ) {
    const transit = await this.findOne(id);
    await this.assertParamedicOwnsAmbulance(actor, transit.ambulanceId);
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

    const patch: Partial<Transit> = {
      etaMinutes: eta,
    };
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
    this.events.broadcastDashboardRefresh(full.cityId);
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
    this.events.broadcastDashboardRefresh(transit.cityId);
  }
}
