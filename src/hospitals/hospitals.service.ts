import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Hospital } from './hospital.entity';
import { CreateHospitalDto, UpdateHospitalDto } from './dto/hospital.dto';
import { BaseCrudService } from '../common/services/base-crud.service';

@Injectable()
export class HospitalsService extends BaseCrudService<Hospital> {
  constructor(@InjectRepository(Hospital) repo: Repository<Hospital>) {
    super(repo);
  }

  findByCity(cityId?: string) {
    return this.repository.find({
      where: cityId ? { cityId } : {},
      relations: { sector: true, city: true } as never,
      order: { name: 'ASC' },
    });
  }

  findOne(id: string) {
    return super.findOne(id, { sector: true, city: true } as never);
  }

  create(dto: CreateHospitalDto) {
    return super.create(dto as Partial<Hospital>);
  }

  update(id: string, dto: UpdateHospitalDto) {
    return super.update(id, dto as Partial<Hospital>);
  }
}
