import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';
import { LatencyNotificationStatus, LatencyNotifyChannel } from './latency.enums';
import { LatencyBreachRecord } from './latency-breach-record.entity';
import { LatencyBreachRecipient } from './latency-breach-recipient.entity';

@Entity('latency_notifications')
export class LatencyNotification extends BaseEntity {
  @Column({ name: 'breach_record_id' })
  breachRecordId: string;

  @ManyToOne(() => LatencyBreachRecord, (record) => record.notifications, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'breach_record_id' })
  breachRecord: LatencyBreachRecord;

  @Column({ name: 'recipient_id', nullable: true })
  recipientId: string | null;

  @ManyToOne(() => LatencyBreachRecipient, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'recipient_id' })
  recipient: LatencyBreachRecipient | null;

  @Column()
  name: string;

  @Column({ length: 20 })
  phone: string;

  @Column({ type: 'varchar', length: 20 })
  channel: LatencyNotifyChannel;

  @Column({ type: 'varchar', length: 20, default: LatencyNotificationStatus.PENDING })
  status: LatencyNotificationStatus;

  /** 1-based sequence within this recipient+channel for the breach. */
  @Column({ name: 'attempt_number', type: 'int', default: 1 })
  attemptNumber: number;

  /** Total planned attempts for this recipient+channel (copied from contact settings). */
  @Column({ name: 'max_attempts', type: 'int', default: 1 })
  maxAttempts: number;

  /** When this notification should be sent (null = send ASAP). */
  @Column({ name: 'scheduled_at', type: 'timestamptz', nullable: true })
  scheduledAt: Date | null;

  @Column({ name: 'provider_response', type: 'text', nullable: true })
  providerResponse: string | null;

  @Column({ name: 'sent_at', type: 'timestamptz', nullable: true })
  sentAt: Date | null;
}
