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
    private readonly ruleRepo: Repository<LatencyBreachRule>,
    @InjectRepository(LatencyBreachRecipient)
    private readonly recipientRepo: Repository<LatencyBreachRecipient>,
  ) {
    super(ruleRepo);
  }

  async listRules(page?: number, limit?: number, cityId?: string, q?: string) {
    const qb = this.ruleRepo
      .createQueryBuilder('rule')
      .leftJoinAndSelect('rule.city', 'city')
      .leftJoinAndSelect('rule.sector', 'sector')
      .leftJoinAndSelect('rule.recipients', 'recipients')
      .orderBy('rule.name', 'ASC');

    if (cityId) qb.andWhere('rule.cityId = :cityId', { cityId });
    if (q?.trim()) {
      qb.andWhere(
        '(rule.name ILIKE :q OR CAST(rule.breachType AS text) ILIKE :q OR CAST(rule.targetRole AS text) ILIKE :q)',
        { q: `%${q.trim()}%` },
      );
    }

    if (page && limit) {
      const [data, total] = await qb
        .skip((page - 1) * limit)
        .take(limit)
        .getManyAndCount();
      return { data, total, page, limit, totalPages: Math.ceil(total / limit) || 1 };
    }
    return qb.getMany();
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

  async findRecipients(ruleId?: string, page?: number, limit?: number, q?: string) {
    const qb = this.recipientRepo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.rule', 'rule')
      .orderBy('r.name', 'ASC');

    if (ruleId) qb.andWhere('r.ruleId = :ruleId', { ruleId });
    if (q?.trim()) {
      qb.andWhere('(r.name ILIKE :q OR r.phone ILIKE :q OR rule.name ILIKE :q)', {
        q: `%${q.trim()}%`,
      });
    }

    if (page && limit) {
      const [data, total] = await qb
        .skip((page - 1) * limit)
        .take(limit)
        .getManyAndCount();
      return { data, total, page, limit, totalPages: Math.ceil(total / limit) || 1 };
    }
    return qb.getMany();
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
