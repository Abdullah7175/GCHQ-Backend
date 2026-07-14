import { Entity, Column, OneToMany, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';
import { City } from '../cities/city.entity';
import { SectorGridStatus } from '../common/enums';
import { Hospital } from '../hospitals/hospital.entity';
import { Transit } from '../transits/transit.entity';

@Entity('sectors')
export class Sector extends BaseEntity {
  @Column()
  name: string;

  @Column()
  code: string;

  @Column({ name: 'city_id' })
  cityId: string;

  @ManyToOne(() => City, (city) => city.sectors, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'city_id' })
  city: City;

  @Column({ default: '#0056b3' })
  color: string;

  @Column({
    name: 'grid_status',
    type: 'enum',
    enum: SectorGridStatus,
    default: SectorGridStatus.FLOWING,
  })
  gridStatus: SectorGridStatus;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  latitude: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  longitude: number | null;

  @Column({ name: 'override_active', default: false })
  overrideActive: boolean;

  @OneToMany(() => Hospital, (hospital) => hospital.sector)
  hospitals: Hospital[];

  @OneToMany(() => Transit, (transit) => transit.sector)
  transits: Transit[];
}
