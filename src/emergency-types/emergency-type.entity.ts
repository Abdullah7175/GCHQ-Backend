import { Entity, Column, OneToMany } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';
import { Transit } from '../transits/transit.entity';

@Entity('emergency_types')
export class EmergencyType extends BaseEntity {
  @Column({ unique: true })
  name: string;

  @Column({ unique: true })
  code: string;

  @Column({ type: 'varchar', nullable: true })
  description: string | null;

  @Column({ name: 'severity_level', default: 1 })
  severityLevel: number;

  @OneToMany(() => Transit, (transit) => transit.emergencyType)
  transits: Transit[];
}
