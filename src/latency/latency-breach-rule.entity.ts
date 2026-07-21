import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';
import { City } from '../cities/city.entity';
import { Sector } from '../sectors/sector.entity';
import { UserRole } from '../common/enums';
import { LatencyBreachType } from './latency.enums';
import { LatencyBreachRecipient } from './latency-breach-recipient.entity';
import { LatencyBreachRecord } from './latency-breach-record.entity';

@Entity('latency_breach_rules')
export class LatencyBreachRule extends BaseEntity {
  @Column()
  name: string;

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

  @Column({ name: 'target_role', type: 'enum', enum: UserRole, nullable: true })
  targetRole: UserRole | null;

  @Column({ name: 'threshold_minutes', type: 'int', default: 6 })
  thresholdMinutes: number;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @OneToMany(() => LatencyBreachRecipient, (recipient) => recipient.rule)
  recipients: LatencyBreachRecipient[];

  @OneToMany(() => LatencyBreachRecord, (record) => record.rule)
  records: LatencyBreachRecord[];
}
