import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { City } from './city.entity';
import { CreateCityDto, UpdateCityDto } from './dto/city.dto';
import { BaseCrudService } from '../common/services/base-crud.service';
import { DEFAULT_CITY_CONFIG } from './city-operational-config';

@Injectable()
export class CitiesService extends BaseCrudService<City> {
  constructor(@InjectRepository(City) repo: Repository<City>) {
    super(repo);
  }

  findAllActive() {
    return this.repository.find({
      where: { isActive: true },
      order: { name: 'ASC' },
    });
  }

  createCity(dto: CreateCityDto) {
    return super.create({
      ...dto,
      code: dto.code.toUpperCase(),
      operationalConfig: { ...DEFAULT_CITY_CONFIG, ...dto.operationalConfig },
    } as Partial<City>);
  }

  async updateCity(id: string, dto: UpdateCityDto) {
    if (dto.operationalConfig) {
      const city = await this.findOne(id);
      dto.operationalConfig = { ...city.operationalConfig, ...dto.operationalConfig };
    }
    if (dto.code) dto.code = dto.code.toUpperCase();
    return super.update(id, dto as Partial<City>);
  }
}
