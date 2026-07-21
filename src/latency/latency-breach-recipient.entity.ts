import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';
import { LatencyNotifyChannel } from './latency.enums';
import { LatencyBreachRule } from './latency-breach-rule.entity';

@Entity('latency_breach_recipients')
export class LatencyBreachRecipient extends BaseEntity {
  @Column({ name: 'rule_id' })
  ruleId: string;

  @ManyToOne(() => LatencyBreachRule, (rule) => rule.recipients, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'rule_id' })
  rule: LatencyBreachRule;

  @Column()
  name: string;

  @Column({ length: 20 })
  phone: string;

  @Column({ type: 'varchar', length: 20, default: LatencyNotifyChannel.BOTH })
  channel: LatencyNotifyChannel;

  /** How many times to notify for one breach (1 = only the first alert). */
  @Column({ name: 'notification_count', type: 'int', default: 1 })
  notificationCount: number;

  /** Minutes between alerts 2..N. Ignored when notificationCount is 1. */
  @Column({ name: 'notification_interval_minutes', type: 'int', default: 15 })
  notificationIntervalMinutes: number;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;
}
