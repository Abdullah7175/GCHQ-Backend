import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmergencyType } from './emergency-type.entity';
import { CreateEmergencyTypeDto, UpdateEmergencyTypeDto } from './dto/emergency-type.dto';
import { BaseCrudService } from '../common/services/base-crud.service';

@Injectable()
export class EmergencyTypesService extends BaseCrudService<EmergencyType> {
  constructor(@InjectRepository(EmergencyType) repo: Repository<EmergencyType>) {
    super(repo);
  }

  create(dto: CreateEmergencyTypeDto) {
    return super.create(dto as Partial<EmergencyType>);
  }

  update(id: string, dto: UpdateEmergencyTypeDto) {
    return super.update(id, dto as Partial<EmergencyType>);
  }
}
