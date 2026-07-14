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

  findByCity(cityId?: string) {
    return this.repository.find({
      where: cityId ? { cityId } : {},
      relations: { city: true } as never,
      order: { name: 'ASC' },
    });
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
