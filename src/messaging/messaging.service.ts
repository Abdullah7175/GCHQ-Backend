import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { MessagingChannel } from './messaging-provider-config.entity';
import { MessagingConfigService } from './messaging-config.service';
import { phoneForProviderApi } from './phone.util';
import { LatencyNotifyChannel } from '../latency/latency.enums';
import { TestMessagingDto } from './dto/messaging.dto';
import { assertValidMessagingApiUrl, buildMessagingPayload } from './messaging.util';

export type SendMessageResult = {
  ok: boolean;
  statusCode?: number;
  responseBody?: string;
  error?: string;
};

@Injectable()
export class MessagingService {
  private readonly logger = new Logger(MessagingService.name);

  constructor(private readonly configService: MessagingConfigService) {}

  async sendForChannel(
    channel: LatencyNotifyChannel,
    phone: string,
    message: string,
  ): Promise<SendMessageResult> {
    if (channel === LatencyNotifyChannel.BOTH) {
      const sms = await this.send(MessagingChannel.SMS, phone, message);
      const wa = await this.send(MessagingChannel.WHATSAPP, phone, message);
      if (sms.ok || wa.ok) {
        return {
          ok: true,
          responseBody: [sms.responseBody, wa.responseBody].filter(Boolean).join(' | '),
        };
      }
      return { ok: false, error: sms.error || wa.error || 'Both channels failed' };
    }

    const providerChannel =
      channel === LatencyNotifyChannel.WHATSAPP
        ? MessagingChannel.WHATSAPP
        : MessagingChannel.SMS;
    return this.send(providerChannel, phone, message);
  }

  async send(
    channel: MessagingChannel,
    phone: string,
    message: string,
  ): Promise<SendMessageResult> {
    const config = await this.configService.getDecryptedActive(channel);
    if (!config) {
      return {
        ok: false,
        error: `No active ${channel} provider configured in Admin → Messaging API`,
      };
    }
    return this.sendRaw(
      config.apiUrl,
      config.secretKey,
      config.authFieldName,
      phone,
      message,
      channel,
    );
  }

  async testSend(dto: TestMessagingDto): Promise<SendMessageResult & { phoneUsed: string }> {
    const message =
      dto.message?.trim() ||
      '[GCHQ] Test message — your messaging API configuration is working.';

    let apiUrl: string;
    let secretKey: string;
    let authFieldName: string;
    let channel: MessagingChannel | 'test' = 'test';

    if (dto.providerId) {
      const saved = await this.configService.getDecryptedById(dto.providerId);
      apiUrl = dto.apiUrl?.trim() || saved.apiUrl;
      secretKey = dto.secretKey?.length ? dto.secretKey : saved.secretKey;
      authFieldName = dto.authFieldName?.trim() || saved.authFieldName;
      channel = saved.channel;
    } else {
      if (!dto.apiUrl?.trim() || !dto.secretKey?.length) {
        throw new BadRequestException(
          'Enter API URL and secret key above, or save the provider first and test by ID.',
        );
      }
      apiUrl = dto.apiUrl.trim();
      secretKey = dto.secretKey;
      authFieldName = dto.authFieldName?.trim() || 'token';
      channel = dto.channel ?? MessagingChannel.WHATSAPP;
    }

    assertValidMessagingApiUrl(apiUrl);
    const phoneUsed = phoneForProviderApi(dto.phone);
    const result = await this.sendRaw(apiUrl, secretKey, authFieldName, dto.phone, message, channel);
    return { ...result, phoneUsed };
  }

  private async sendRaw(
    apiUrl: string,
    secretKey: string,
    authFieldName: string,
    phone: string,
    message: string,
    channel: MessagingChannel | 'test' = 'test',
  ): Promise<SendMessageResult> {
    const phoneDigits = phoneForProviderApi(phone);
    const payload = buildMessagingPayload(authFieldName, secretKey, phoneDigits, message);

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const responseBody = await response.text();
      if (!response.ok) {
        this.logger.warn(
          `${channel} send failed (${response.status}) → ${phoneDigits}: ${responseBody.slice(0, 200)}`,
        );
        return {
          ok: false,
          statusCode: response.status,
          responseBody,
          error: `Provider returned HTTP ${response.status}`,
        };
      }

      this.logger.log(`${channel} message sent → ${phoneDigits}`);
      return { ok: true, statusCode: response.status, responseBody };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      this.logger.error(`${channel} send error → ${phoneDigits}: ${error}`);
      return { ok: false, error };
    }
  }
}
