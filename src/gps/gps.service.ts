import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GpsLocation } from './gps-location.entity';
import { BaseCrudService } from '../common/services/base-crud.service';

@Injectable()
export class GpsService extends BaseCrudService<GpsLocation> {
  constructor(@InjectRepository(GpsLocation) repo: Repository<GpsLocation>) {
    super(repo);
  }

  findByAmbulance(ambulanceId: string, limit = 50) {
    return this.repository.find({
      where: { ambulanceId },
      order: { recordedAt: 'DESC' },
      take: limit,
    });
  }

  findByTransit(transitId: string) {
    return this.repository.find({
      where: { transitId },
      order: { recordedAt: 'ASC' },
    });
  }
}
