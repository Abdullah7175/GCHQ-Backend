import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';
import { Ambulance } from '../ambulances/ambulance.entity';
import { Transit } from '../transits/transit.entity';

@Entity('gps_locations')
export class GpsLocation extends BaseEntity {
  @Column({ name: 'ambulance_id' })
  ambulanceId: string;

  @ManyToOne(() => Ambulance, (ambulance) => ambulance.gpsLocations)
  @JoinColumn({ name: 'ambulance_id' })
  ambulance: Ambulance;

  @Column({ name: 'transit_id', nullable: true })
  transitId: string | null;

  @ManyToOne(() => Transit, (transit) => transit.gpsLocations, { nullable: true })
  @JoinColumn({ name: 'transit_id' })
  transit: Transit | null;

  @Column({ type: 'decimal', precision: 10, scale: 7 })
  latitude: number;

  @Column({ type: 'decimal', precision: 10, scale: 7 })
  longitude: number;

  @Column({ type: 'decimal', precision: 6, scale: 2, default: 0 })
  speed: number;

  @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true })
  heading: number | null;

  @Column({ name: 'recorded_at', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  recordedAt: Date;
}
