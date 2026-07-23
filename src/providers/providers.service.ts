import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Provider } from './provider.entity';
import { CreateProviderDto, UpdateProviderDto } from './dto/provider.dto';
import { BaseCrudService } from '../common/services/base-crud.service';

@Injectable()
export class ProvidersService extends BaseCrudService<Provider> {
  constructor(@InjectRepository(Provider) private readonly providerRepo: Repository<Provider>) {
    super(providerRepo);
  }

  async search(page?: number, limit?: number, q?: string) {
    if (!q?.trim()) {
      return super.findAll(undefined, page, limit);
    }
    const qb = this.providerRepo
      .createQueryBuilder('p')
      .orderBy('p.name', 'ASC')
      .andWhere('(p.name ILIKE :q OR p.code ILIKE :q OR p.markerLetter ILIKE :q)', {
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

  create(dto: CreateProviderDto) {
    return super.create({
      ...dto,
      markerLetter: this.normalizeMarkerLetter(dto.markerLetter, dto.name),
    } as Partial<Provider>);
  }

  update(id: string, dto: UpdateProviderDto) {
    const patch = { ...dto } as Partial<Provider>;
    if (dto.markerLetter !== undefined) {
      patch.markerLetter = this.normalizeMarkerLetter(dto.markerLetter, dto.name);
    }
    return super.update(id, patch);
  }

  private normalizeMarkerLetter(letter?: string, name?: string): string {
    const raw = (letter || '').trim().toUpperCase();
    if (raw) return raw.slice(0, 3);
    const fromName = (name || '')
      .replace(/[^a-zA-Z]/g, '')
      .charAt(0)
      .toUpperCase();
    return fromName || '?';
  }
}
