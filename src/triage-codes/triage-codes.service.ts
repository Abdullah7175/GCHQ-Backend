import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TriageCode } from './triage-code.entity';
import { CreateTriageCodeDto, UpdateTriageCodeDto } from './dto/triage-code.dto';
import { BaseCrudService } from '../common/services/base-crud.service';

@Injectable()
export class TriageCodesService extends BaseCrudService<TriageCode> {
  constructor(@InjectRepository(TriageCode) repo: Repository<TriageCode>) {
    super(repo);
  }

  create(dto: CreateTriageCodeDto) {
    return super.create(dto as Partial<TriageCode>);
  }

  update(id: string, dto: UpdateTriageCodeDto) {
    return super.update(id, dto as Partial<TriageCode>);
  }
}
