import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Sector } from './sector.entity';
import { CreateSectorDto, UpdateSectorDto } from './dto/sector.dto';
import { BaseCrudService } from '../common/services/base-crud.service';

@Injectable()
export class SectorsService extends BaseCrudService<Sector> {
  constructor(@InjectRepository(Sector) repo: Repository<Sector>) {
    super(repo);
  }

  findByCity(cityId?: string, page?: number, limit?: number, q?: string) {
    if (!q?.trim()) {
      return super.findAll(
        {
          where: cityId ? { cityId } : {},
          relations: { city: true } as never,
          order: { name: 'ASC' },
        },
        page,
        limit,
      );
    }
    const qb = this.repository
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.city', 'city')
      .orderBy('s.name', 'ASC');
    if (cityId) qb.andWhere('s.cityId = :cityId', { cityId });
    qb.andWhere('(s.name ILIKE :q OR s.code ILIKE :q)', { q: `%${q.trim()}%` });
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
    return super.findOne(id, { city: true } as never);
  }

  create(dto: CreateSectorDto) {
    return super.create(dto as Partial<Sector>);
  }

  update(id: string, dto: UpdateSectorDto) {
    return super.update(id, dto as Partial<Sector>);
  }

  async toggleOverride(id: string) {
    const sector = await this.findOne(id);
    return super.update(id, { overrideActive: !sector.overrideActive });
  }
}
