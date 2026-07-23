import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmergencyType } from './emergency-type.entity';
import { CreateEmergencyTypeDto, UpdateEmergencyTypeDto } from './dto/emergency-type.dto';
import { BaseCrudService } from '../common/services/base-crud.service';

@Injectable()
export class EmergencyTypesService extends BaseCrudService<EmergencyType> {
  constructor(@InjectRepository(EmergencyType) private readonly typeRepo: Repository<EmergencyType>) {
    super(typeRepo);
  }

  async search(page?: number, limit?: number, q?: string) {
    if (!q?.trim()) {
      return super.findAll(undefined, page, limit);
    }
    const qb = this.typeRepo
      .createQueryBuilder('e')
      .orderBy('e.name', 'ASC')
      .andWhere('(e.name ILIKE :q OR e.code ILIKE :q OR e.description ILIKE :q)', {
        q: `%${q.trim()}%`,
      });
    if (page && limit) {
      const [data, total] = await qb
        .skip((page - 1) * limit)
        .take(limit)
        .getManyAndCount();
      return { data, total, page, limit, totalPages: Math.ceil(total / limit) || 1 };
    }
    return qb.getMany();
  }

  create(dto: CreateEmergencyTypeDto) {
    return super.create(dto as Partial<EmergencyType>);
  }

  update(id: string, dto: UpdateEmergencyTypeDto) {
    return super.update(id, dto as Partial<EmergencyType>);
  }
}
