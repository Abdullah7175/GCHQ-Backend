import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseCrudService } from '../common/services/base-crud.service';
import { LatencyBreachRule } from './latency-breach-rule.entity';
import { LatencyBreachRecipient } from './latency-breach-recipient.entity';
import { CreateLatencyRecipientDto, CreateLatencyRuleDto, UpdateLatencyRecipientDto, UpdateLatencyRuleDto } from './dto/latency.dto';
import { normalizePakistanPhone } from '../messaging/phone.util';

@Injectable()
export class LatencyRulesService extends BaseCrudService<LatencyBreachRule> {
  constructor(
    @InjectRepository(LatencyBreachRule)
    ruleRepo: Repository<LatencyBreachRule>,
    @InjectRepository(LatencyBreachRecipient)
    private readonly recipientRepo: Repository<LatencyBreachRecipient>,
  ) {
    super(ruleRepo);
  }

  listRules(page?: number, limit?: number, cityId?: string) {
    return super.findAll(
      {
        where: cityId ? { cityId } : {},
        relations: { city: true, sector: true, recipients: true } as never,
        order: { name: 'ASC' },
      },
      page,
      limit,
    );
  }

  findOne(id: string) {
    return super.findOne(id, { city: true, sector: true, recipients: true } as never);
  }

  create(dto: CreateLatencyRuleDto) {
    return super.create(dto as Partial<LatencyBreachRule>);
  }

  update(id: string, dto: UpdateLatencyRuleDto) {
    return super.update(id, dto as Partial<LatencyBreachRule>);
  }

  async findRecipients(ruleId?: string, page?: number, limit?: number) {
    const where = ruleId ? { ruleId } : {};
    if (page && limit) {
      const skip = (page - 1) * limit;
      const [data, total] = await this.recipientRepo.findAndCount({
        where,
        relations: { rule: true },
        order: { name: 'ASC' },
        skip,
        take: limit,
      });
      return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
    }
    return this.recipientRepo.find({
      where,
      relations: { rule: true },
      order: { name: 'ASC' },
    });
  }

  findRecipient(id: string) {
    return this.recipientRepo.findOneOrFail({
      where: { id },
      relations: { rule: true },
    });
  }

  createRecipient(dto: CreateLatencyRecipientDto) {
    const notificationCount = Math.min(10, Math.max(1, Number(dto.notificationCount) || 1));
    const notificationIntervalMinutes = Math.min(
      24 * 60,
      Math.max(1, Number(dto.notificationIntervalMinutes) || 15),
    );
    return this.recipientRepo.save({
      ...dto,
      phone: normalizePakistanPhone(dto.phone),
      notificationCount,
      notificationIntervalMinutes,
    });
  }

  updateRecipient(id: string, dto: UpdateLatencyRecipientDto) {
    const patch = { ...dto } as Partial<LatencyBreachRecipient>;
    if (dto.phone != null) {
      patch.phone = normalizePakistanPhone(dto.phone);
    }
    if (dto.notificationCount != null) {
      patch.notificationCount = Math.min(10, Math.max(1, Number(dto.notificationCount) || 1));
    }
    if (dto.notificationIntervalMinutes != null) {
      patch.notificationIntervalMinutes = Math.min(
        24 * 60,
        Math.max(1, Number(dto.notificationIntervalMinutes) || 15),
      );
    }
    return this.recipientRepo.save({ id, ...patch });
  }

  removeRecipient(id: string) {
    return this.recipientRepo.delete(id);
  }
}
