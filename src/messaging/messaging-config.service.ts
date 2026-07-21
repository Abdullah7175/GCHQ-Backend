import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import {
  MessagingChannel,
  MessagingProviderConfig,
} from './messaging-provider-config.entity';
import { decryptSecret, encryptSecret, maskSecret } from './encryption.util';
import {
  CreateMessagingProviderDto,
  UpdateMessagingProviderDto,
} from './dto/messaging.dto';
import { assertValidMessagingApiUrl } from './messaging.util';

export type MessagingProviderPublic = {
  id: string;
  name: string;
  channel: MessagingChannel;
  apiUrlMasked: string;
  secretKeyMasked: string;
  hasSecretKey: boolean;
  authFieldName: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class MessagingConfigService {
  private readonly logger = new Logger(MessagingConfigService.name);

  constructor(
    @InjectRepository(MessagingProviderConfig)
    private readonly repo: Repository<MessagingProviderConfig>,
  ) {}

  toPublic(row: MessagingProviderConfig, reveal = false): MessagingProviderPublic {
    const apiUrl = decryptSecret(row.apiUrlCipher);
    const secretKey = decryptSecret(row.secretKeyCipher);
    return {
      id: row.id,
      name: row.name,
      channel: row.channel,
      apiUrlMasked: reveal ? apiUrl : maskSecret(apiUrl),
      secretKeyMasked: maskSecret(secretKey),
      hasSecretKey: Boolean(secretKey),
      authFieldName: row.authFieldName || 'token',
      isActive: row.isActive,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async findAll(page?: number, limit?: number) {
    if (page && limit) {
      const skip = (page - 1) * limit;
      const [rows, total] = await this.repo.findAndCount({
        order: { name: 'ASC' },
        skip,
        take: limit,
      });
      return {
        data: rows.map((r) => this.toPublic(r)),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    }
    const rows = await this.repo.find({ order: { name: 'ASC' } });
    return rows.map((r) => this.toPublic(r));
  }

  async findOne(id: string) {
    const row = await this.repo.findOneOrFail({ where: { id } });
    return this.toPublic(row);
  }

  async getDecryptedById(id: string): Promise<{
    apiUrl: string;
    secretKey: string;
    channel: MessagingChannel;
    name: string;
    authFieldName: string;
  }> {
    const row = await this.repo.findOneOrFail({ where: { id } });
    return {
      apiUrl: decryptSecret(row.apiUrlCipher),
      secretKey: decryptSecret(row.secretKeyCipher),
      channel: row.channel,
      name: row.name,
      authFieldName: row.authFieldName || 'token',
    };
  }

  async getDecryptedActive(channel: MessagingChannel): Promise<{
    apiUrl: string;
    secretKey: string;
    authFieldName: string;
  } | null> {
    const row = await this.repo.findOne({
      where: { channel, isActive: true },
      order: { updatedAt: 'DESC' },
    });
    if (!row) return null;
    return {
      apiUrl: decryptSecret(row.apiUrlCipher),
      secretKey: decryptSecret(row.secretKeyCipher),
      authFieldName: row.authFieldName || 'token',
    };
  }

  async create(dto: CreateMessagingProviderDto) {
    assertValidMessagingApiUrl(dto.apiUrl);
    const isActive = dto.isActive !== false;
    const saved = await this.repo.save({
      name: dto.name,
      channel: dto.channel,
      apiUrlCipher: encryptSecret(dto.apiUrl.trim()),
      secretKeyCipher: encryptSecret(dto.secretKey),
      authFieldName: dto.authFieldName?.trim() || 'token',
      isActive,
    });
    if (isActive) {
      await this.deactivateOthersInChannel(saved.channel, saved.id);
    }
    this.logger.log(`Messaging provider created: ${saved.name} (${saved.channel})`);
    return this.toPublic(saved);
  }

  async update(id: string, dto: UpdateMessagingProviderDto) {
    await this.repo.findOneOrFail({ where: { id } });
    const patch: Partial<MessagingProviderConfig> = {};
    if (dto.name != null) patch.name = dto.name;
    if (dto.channel != null) patch.channel = dto.channel;
    if (dto.isActive != null) patch.isActive = dto.isActive;
    if (dto.authFieldName != null) patch.authFieldName = dto.authFieldName.trim() || 'token';
    if (dto.apiUrl != null) {
      assertValidMessagingApiUrl(dto.apiUrl);
      patch.apiUrlCipher = encryptSecret(dto.apiUrl.trim());
    }
    if (dto.secretKey != null && dto.secretKey.length > 0) {
      patch.secretKeyCipher = encryptSecret(dto.secretKey);
    }
    await this.repo.update(id, patch);
    const updated = await this.repo.findOneOrFail({ where: { id } });
    if (updated.isActive) {
      await this.deactivateOthersInChannel(updated.channel, updated.id);
    }
    this.logger.log(`Messaging provider updated: ${updated.name}`);
    return this.toPublic(updated);
  }

  async remove(id: string) {
    const row = await this.repo.findOneOrFail({ where: { id } });
    await this.repo.remove(row);
  }

  /** Only one provider per channel (SMS / WhatsApp) may be active at a time. */
  private async deactivateOthersInChannel(channel: MessagingChannel, keepId: string) {
    await this.repo.update(
      { channel, isActive: true, id: Not(keepId) },
      { isActive: false },
    );
  }
}
