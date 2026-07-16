import { Entity, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';
import { AmbulanceStatus } from '../common/enums';
import { City } from '../cities/city.entity';
import { Provider } from '../providers/provider.entity';
import { User } from '../users/user.entity';
import { Transit } from '../transits/transit.entity';
import { GpsLocation } from '../gps/gps-location.entity';

@Entity('ambulances')
export class Ambulance extends BaseEntity {
  @Column({ name: 'unit_number' })
  unitNumber: string;

  @Column({ name: 'city_id' })
  cityId: string;

  @ManyToOne(() => City, (city) => city.ambulances, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'city_id' })
  city: City;

  @Column({ name: 'provider_id' })
  providerId: string;

  @ManyToOne(() => Provider, (provider) => provider.ambulances)
  @JoinColumn({ name: 'provider_id' })
  provider: Provider;

  @Column({
    type: 'enum',
    enum: AmbulanceStatus,
    default: AmbulanceStatus.AVAILABLE,
  })
  status: AmbulanceStatus;

  @Column({ name: 'current_lat', type: 'decimal', precision: 10, scale: 7, nullable: true })
  currentLat: number | null;

  @Column({ name: 'current_lng', type: 'decimal', precision: 10, scale: 7, nullable: true })
  currentLng: number | null;

  @Column({ name: 'current_speed', type: 'decimal', precision: 6, scale: 2, default: 0 })
  currentSpeed: number;

  @Column({ name: 'driver_id', nullable: true })
  driverId: string | null;

  @Column({ name: 'gps_url', type: 'varchar', nullable: true })
  gpsUrl: string | null;

  @Column({ name: 'gps_headers', type: 'text', nullable: true })
  gpsHeaders: string | null;

  @ManyToOne(() => User, (user) => user.ambulances, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'driver_id' })
  driver: User | null;


  @OneToMany(() => Transit, (transit) => transit.ambulance)
  transits: Transit[];

  @OneToMany(() => GpsLocation, (gps) => gps.ambulance)
  gpsLocations: GpsLocation[];
}
