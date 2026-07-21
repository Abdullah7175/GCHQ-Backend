import { Entity, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';
import { Hospital } from '../hospitals/hospital.entity';
import { HospitalGeofencePoint } from './hospital-geofence-point.entity';
import { GeofenceShapeType } from './geofence.enums';

@Entity('hospital_geofences')
export class HospitalGeofence extends BaseEntity {
  @Column({ name: 'hospital_id', unique: true })
  hospitalId: string;

  @ManyToOne(() => Hospital, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'hospital_id' })
  hospital: Hospital;

  @Column({ name: 'shape_type', type: 'varchar', length: 20, default: GeofenceShapeType.CIRCLE })
  shapeType: GeofenceShapeType;

  @Column({ name: 'center_lat', type: 'decimal', precision: 10, scale: 7 })
  centerLat: number;

  @Column({ name: 'center_lng', type: 'decimal', precision: 10, scale: 7 })
  centerLng: number;

  @Column({ name: 'radius_meters', type: 'int', nullable: true })
  radiusMeters: number | null;

  @OneToMany(() => HospitalGeofencePoint, (point) => point.geofence, { cascade: true })
  boundaryPoints: HospitalGeofencePoint[];
}
