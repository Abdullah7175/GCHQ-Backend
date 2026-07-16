import { Entity, Column, OneToMany } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';
import { Hospital } from '../hospitals/hospital.entity';
import { Sector } from '../sectors/sector.entity';
import { User } from '../users/user.entity';
import { Ambulance } from '../ambulances/ambulance.entity';
import { Transit } from '../transits/transit.entity';
import type { CityOperationalConfig } from './city-operational-config';

@Entity('cities')
export class City extends BaseEntity {
  @Column()
  name: string;

  @Column({ unique: true })
  code: string;

  @Column({ type: 'varchar', nullable: true })
  province: string | null;

  @Column({ type: 'varchar', default: 'Pakistan' })
  country: string;

  @Column({ type: 'varchar', default: 'Asia/Karachi' })
  timezone: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  /** Default map viewport for HQ / Safe City dashboards */
  @Column({ name: 'map_center_lat', type: 'decimal', precision: 10, scale: 7, nullable: true })
  mapCenterLat: number | null;

  @Column({ name: 'map_center_lng', type: 'decimal', precision: 10, scale: 7, nullable: true })
  mapCenterLng: number | null;

  @Column({ name: 'map_default_zoom', type: 'int', default: 12 })
  mapDefaultZoom: number;

  @Column({
    name: 'operational_config',
    type: 'jsonb',
  })
  operationalConfig: CityOperationalConfig;

  @OneToMany(() => Hospital, (hospital) => hospital.city)
  hospitals: Hospital[];

  @OneToMany(() => Sector, (sector) => sector.city)
  sectors: Sector[];

  @OneToMany(() => User, (user) => user.city)
  users: User[];

  @OneToMany(() => Ambulance, (ambulance) => ambulance.city)
  ambulances: Ambulance[];

  @OneToMany(() => Transit, (transit) => transit.city)
  transits: Transit[];
}
