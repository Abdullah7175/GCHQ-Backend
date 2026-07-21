import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';
import { HospitalGeofence } from './hospital-geofence.entity';

/** Sampled ring coordinates describing the circular fence boundary. */
@Entity('hospital_geofence_points')
export class HospitalGeofencePoint extends BaseEntity {
  @Column({ name: 'geofence_id' })
  geofenceId: string;

  @ManyToOne(() => HospitalGeofence, (geofence) => geofence.boundaryPoints, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'geofence_id' })
  geofence: HospitalGeofence;

  @Column({ name: 'point_index', type: 'int' })
  pointIndex: number;

  @Column({ type: 'decimal', precision: 10, scale: 7 })
  latitude: number;

  @Column({ type: 'decimal', precision: 10, scale: 7 })
  longitude: number;
}
