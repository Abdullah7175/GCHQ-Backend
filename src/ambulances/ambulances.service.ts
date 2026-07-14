import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ambulance } from './ambulance.entity';
import { CreateAmbulanceDto, UpdateAmbulanceDto, UpdateGpsDto } from './dto/ambulance.dto';
import { BaseCrudService } from '../common/services/base-crud.service';
import { GpsLocation } from '../gps/gps-location.entity';
import { EventsGateway } from '../events/events.gateway';
import { AmbulanceStatus } from '../common/enums';
import { TransitsService } from '../transits/transits.service';

@Injectable()
export class AmbulancesService extends BaseCrudService<Ambulance> {
  constructor(
    @InjectRepository(Ambulance) private readonly ambulanceRepo: Repository<Ambulance>,
    @InjectRepository(GpsLocation) private readonly gpsRepo: Repository<GpsLocation>,
    private readonly events: EventsGateway,
    @Inject(forwardRef(() => TransitsService))
    private readonly transitsService: TransitsService,
  ) {
    super(ambulanceRepo);
  }

  findByCity(cityId?: string) {
    return this.ambulanceRepo.find({
      where: cityId ? { cityId } : {},
      relations: { provider: true, driver: true, city: true } as never,
      order: { unitNumber: 'ASC' },
    });
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

  async updateGps(id: string, dto: UpdateGpsDto, transitId?: string) {
    const ambulance = await super.update(id, {
      currentLat: dto.latitude,
      currentLng: dto.longitude,
      currentSpeed: dto.speed ?? 0,
    });

    await this.gpsRepo.save({
      ambulanceId: id,
      transitId: transitId ?? null,
      latitude: dto.latitude,
      longitude: dto.longitude,
      speed: dto.speed ?? 0,
      heading: dto.heading ?? null,
      recordedAt: new Date(),
    });

    // Apply to active transit + demo geofence complete
    const transit = await this.transitsService.applyGpsUpdate(
      id,
      dto.latitude,
      dto.longitude,
      dto.speed ?? 0,
    );

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
