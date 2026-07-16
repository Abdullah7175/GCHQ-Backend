import { Injectable, Inject, forwardRef, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
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
    // 1. Instantly update the ambulance current coordinate row using faster update method
    await this.ambulanceRepo.update(id, {
      currentLat: dto.latitude,
      currentLng: dto.longitude,
      currentSpeed: dto.speed ?? 0,
    });

    const ambulance = await this.findOne(id);

    // 2. Delegate GPS log buffering and geofencing calculations to GpsCacheService
    const transit = await this.gpsCacheService.update({
      ambulanceId: id,
      transitId: transitId ?? null,
      latitude: dto.latitude,
      longitude: dto.longitude,
      speed: dto.speed ?? 0,
      heading: dto.heading ?? null,
      recordedAt: new Date(),
    });

    this.events.broadcastGpsUpdate({ ambulanceId: id, ...dto, transitId: transit?.id ?? transitId });
    return { ambulance, transit };
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

