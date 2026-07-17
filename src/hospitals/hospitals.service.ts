import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Hospital } from './hospital.entity';
import { EmergencyType } from '../emergency-types/emergency-type.entity';
import { CreateHospitalDto, UpdateHospitalDto } from './dto/hospital.dto';
import { BaseCrudService } from '../common/services/base-crud.service';

@Injectable()
export class HospitalsService extends BaseCrudService<Hospital> {
  constructor(
    @InjectRepository(Hospital) private readonly hospitalRepo: Repository<Hospital>,
    @InjectRepository(EmergencyType) private readonly emergencyTypeRepo: Repository<EmergencyType>,
  ) {
    super(hospitalRepo);
  }

  private readonly relations = { sector: true, city: true, emergencyTypes: true } as never;

  findByCity(cityId?: string, page?: number, limit?: number) {
    return super.findAll(
      {
        where: cityId ? { cityId } : {},
        relations: this.relations,
        order: { name: 'ASC' },
      },
      page,
      limit
    );
  }

  findOne(id: string) {
    return super.findOne(id, this.relations);
  }

  private async resolveEmergencyTypes(ids?: string[]): Promise<EmergencyType[] | undefined> {
    if (ids === undefined) return undefined;
    if (!ids.length) return [];
    return this.emergencyTypeRepo.findBy({ id: In(ids) });
  }

  async create(dto: CreateHospitalDto) {
    const { emergencyTypeIds, ...rest } = dto;
    const hospital = this.hospitalRepo.create(rest as Partial<Hospital>);
    const types = await this.resolveEmergencyTypes(emergencyTypeIds);
    if (types !== undefined) hospital.emergencyTypes = types;
    const saved = await this.hospitalRepo.save(hospital);
    return this.findOne(saved.id);
  }

  async update(id: string, dto: UpdateHospitalDto) {
    const { emergencyTypeIds, ...rest } = dto;
    if (Object.keys(rest).length) {
      await super.update(id, rest as Partial<Hospital>);
    }
    const types = await this.resolveEmergencyTypes(emergencyTypeIds);
    if (types !== undefined) {
      const hospital = await this.hospitalRepo.findOneOrFail({ where: { id }, relations: { emergencyTypes: true } });
      hospital.emergencyTypes = types;
      await this.hospitalRepo.save(hospital);
    }
    return this.findOne(id);
  }
}
