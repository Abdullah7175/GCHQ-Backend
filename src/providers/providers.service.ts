import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Provider } from './provider.entity';
import { CreateProviderDto, UpdateProviderDto } from './dto/provider.dto';
import { BaseCrudService } from '../common/services/base-crud.service';

@Injectable()
export class ProvidersService extends BaseCrudService<Provider> {
  constructor(@InjectRepository(Provider) repo: Repository<Provider>) {
    super(repo);
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
