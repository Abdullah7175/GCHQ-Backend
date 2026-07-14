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
    return super.create(dto as Partial<Provider>);
  }

  update(id: string, dto: UpdateProviderDto) {
    return super.update(id, dto as Partial<Provider>);
  }
}
