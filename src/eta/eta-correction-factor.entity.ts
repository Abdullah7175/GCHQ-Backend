import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { City } from '../cities/city.entity';

/** Per city + hour-of-day multiplier: actualDuration / OSRM static duration. */
@Entity('eta_correction_factors')
@Unique('UQ_eta_correction_city_hour', ['cityId', 'hourOfDay'])
@Index('IDX_eta_correction_city', ['cityId'])
export class EtaCorrectionFactor {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'city_id' })
  cityId: string;

  @ManyToOne(() => City, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'city_id' })
  city: City;

  @Column({ name: 'hour_of_day', type: 'int' })
  hourOfDay: number;

  @Column({ name: 'correction_factor', type: 'float' })
  correctionFactor: number;

  @Column({ name: 'sample_size', type: 'int', default: 0 })
  sampleSize: number;

  @CreateDateColumn({ name: 'computed_at' })
  computedAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
