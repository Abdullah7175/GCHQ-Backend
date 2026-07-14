import { Entity, Column, OneToMany } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';
import { Transit } from '../transits/transit.entity';

@Entity('triage_codes')
export class TriageCode extends BaseEntity {
  @Column({ unique: true })
  name: string;

  @Column({ unique: true })
  code: string;

  @Column({ default: '#ba1a1a' })
  color: string;

  @Column({ default: 1 })
  priority: number;

  @Column({ type: 'varchar', nullable: true })
  description: string | null;

  @OneToMany(() => Transit, (transit) => transit.triageCode)
  transits: Transit[];
}
