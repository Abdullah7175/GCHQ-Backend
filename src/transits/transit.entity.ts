import {
  Entity,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';
import { PrepStatus, TransitStatus } from '../common/enums';
import { City } from '../cities/city.entity';
import { Ambulance } from '../ambulances/ambulance.entity';
import { Hospital } from '../hospitals/hospital.entity';
import { EmergencyType } from '../emergency-types/emergency-type.entity';
import { TriageCode } from '../triage-codes/triage-code.entity';
import { Sector } from '../sectors/sector.entity';
import { GpsLocation } from '../gps/gps-location.entity';
import { User } from '../users/user.entity';

@Entity('transits')
export class Transit extends BaseEntity {
  @Column({ name: 'transit_id' })
  transitId: string;

  @Column({ name: 'city_id' })
  cityId: string;

  @ManyToOne(() => City, (city) => city.transits, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'city_id' })
  city: City;

  @Column({ name: 'ambulance_id', nullable: true })
  ambulanceId: string | null;

  @ManyToOne(() => Ambulance, (ambulance) => ambulance.transits, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'ambulance_id' })
  ambulance: Ambulance | null;

  @Column({ name: 'hospital_id', nullable: true })
  hospitalId: string | null;

  @ManyToOne(() => Hospital, (hospital) => hospital.transits, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'hospital_id' })
  hospital: Hospital | null;

  @Column({ name: 'emergency_type_id' })
  emergencyTypeId: string;

  @ManyToOne(() => EmergencyType, (type) => type.transits)
  @JoinColumn({ name: 'emergency_type_id' })
  emergencyType: EmergencyType;

  @Column({ name: 'triage_code_id' })
  triageCodeId: string;

  @ManyToOne(() => TriageCode, (code) => code.transits)
  @JoinColumn({ name: 'triage_code_id' })
  triageCode: TriageCode;

  @Column({ name: 'sector_id', nullable: true })
  sectorId: string | null;

  @ManyToOne(() => Sector, (sector) => sector.transits, { nullable: true })
  @JoinColumn({ name: 'sector_id' })
  sector: Sector | null;

  @Column({
    type: 'enum',
    enum: TransitStatus,
    default: TransitStatus.PENDING,
  })
  status: TransitStatus;

  @Column({
    name: 'prep_status',
    type: 'enum',
    enum: PrepStatus,
    default: PrepStatus.PENDING,
  })
  prepStatus: PrepStatus;

  @Column({ name: 'paramedic_notes', type: 'text', nullable: true })
  paramedicNotes: string | null;

  @Column({ name: 'eta_minutes', type: 'decimal', precision: 6, scale: 2, nullable: true })
  etaMinutes: number | null;

  @Column({ name: 'origin_lat', type: 'decimal', precision: 10, scale: 7, nullable: true })
  originLat: number | null;

  @Column({ name: 'origin_lng', type: 'decimal', precision: 10, scale: 7, nullable: true })
  originLng: number | null;

  @Column({ name: 'current_lat', type: 'decimal', precision: 10, scale: 7, nullable: true })
  currentLat: number | null;

  @Column({ name: 'current_lng', type: 'decimal', precision: 10, scale: 7, nullable: true })
  currentLng: number | null;

  @Column({ name: 'current_speed', type: 'decimal', precision: 6, scale: 2, default: 0 })
  currentSpeed: number;

  @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
  startedAt: Date | null;

  @Column({ name: 'arrived_at', type: 'timestamptz', nullable: true })
  arrivedAt: Date | null;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  @Column({ name: 'baseline_eta_minutes', type: 'decimal', precision: 6, scale: 2, nullable: true })
  baselineEtaMinutes: number | null;

  /** CSR who claimed this green-corridor intimation */
  @Column({ name: 'claimed_by_id', nullable: true })
  claimedById: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'claimed_by_id' })
  claimedBy: User | null;

  @Column({ name: 'claimed_at', type: 'timestamptz', nullable: true })
  claimedAt: Date | null;

  @OneToMany(() => GpsLocation, (gps) => gps.transit)
  gpsLocations: GpsLocation[];
}
