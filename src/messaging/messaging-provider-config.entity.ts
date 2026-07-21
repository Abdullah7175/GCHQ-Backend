import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';

export enum MessagingChannel {
  WHATSAPP = 'whatsapp',
  SMS = 'sms',
}

@Entity('messaging_provider_configs')
export class MessagingProviderConfig extends BaseEntity {
  @Column()
  name: string;

  @Column({ type: 'varchar', length: 20 })
  channel: MessagingChannel;

  /** AES-256-GCM encrypted API URL */
  @Column({ name: 'api_url_cipher', type: 'text' })
  apiUrlCipher: string;

  /** AES-256-GCM encrypted secret / API key */
  @Column({ name: 'secret_key_cipher', type: 'text' })
  secretKeyCipher: string;

  /** JSON body field name for the auth value — BizIntel/ESSPL uses "token" */
  @Column({ name: 'auth_field_name', type: 'varchar', length: 40, default: 'token' })
  authFieldName: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;
}
