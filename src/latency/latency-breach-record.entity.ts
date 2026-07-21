import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';
import { City } from '../cities/city.entity';
import { Sector } from '../sectors/sector.entity';
import { LatencyBreachType } from './latency.enums';
import { LatencyBreachRule } from './latency-breach-rule.entity';
import { LatencyNotification } from './latency-notification.entity';

@Entity('latency_breach_records')
export class LatencyBreachRecord extends BaseEntity {
  @Column({ name: 'rule_id', nullable: true })
  ruleId: string | null;

  @ManyToOne(() => LatencyBreachRule, (rule) => rule.records, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'rule_id' })
  rule: LatencyBreachRule | null;

  @Column({ name: 'breach_type', type: 'varchar', length: 40 })
  breachType: LatencyBreachType;

  @Column({ name: 'city_id' })
  cityId: string;

  @ManyToOne(() => City, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'city_id' })
  city: City;

  @Column({ name: 'sector_id', nullable: true })
  sectorId: string | null;

  @ManyToOne(() => Sector, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'sector_id' })
  sector: Sector | null;

  /** transit | user */
  @Column({ name: 'reference_type', type: 'varchar', length: 20 })
  referenceType: string;

  @Column({ name: 'reference_id', type: 'uuid' })
  referenceId: string;

  @Column({ name: 'detected_at', type: 'timestamptz' })
  detectedAt: Date;

  @Column({ name: 'expected_at', type: 'timestamptz', nullable: true })
  expectedAt: Date | null;

  @Column({ name: 'actual_at', type: 'timestamptz', nullable: true })
  actualAt: Date | null;

  @Column({ name: 'threshold_minutes', type: 'int' })
  thresholdMinutes: number;

  @Column({ name: 'delay_minutes', type: 'decimal', precision: 8, scale: 2 })
  delayMinutes: number;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @OneToMany(() => LatencyNotification, (notification) => notification.breachRecord)
  notifications: LatencyNotification[];
}
