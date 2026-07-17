import { Entity, Column, OneToMany, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';
import { UserRole } from '../common/enums';
import { City } from '../cities/city.entity';
import { Hospital } from '../hospitals/hospital.entity';
import { Provider } from '../providers/provider.entity';
import { Sector } from '../sectors/sector.entity';
import { Ambulance } from '../ambulances/ambulance.entity';

@Entity('users')
export class User extends BaseEntity {
  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column()
  name: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.HOSPITAL })
  role: UserRole;

  @Column({ name: 'city_id', nullable: true })
  cityId: string | null;

  @ManyToOne(() => City, (city) => city.users, { nullable: true })
  @JoinColumn({ name: 'city_id' })
  city: City | null;

  @Column({ name: 'hospital_id', nullable: true })
  hospitalId: string | null;

  @ManyToOne(() => Hospital, { nullable: true })
  @JoinColumn({ name: 'hospital_id' })
  hospital: Hospital | null;

  @Column({ name: 'provider_id', nullable: true })
  providerId: string | null;

  @ManyToOne(() => Provider, { nullable: true })
  @JoinColumn({ name: 'provider_id' })
  provider: Provider | null;

  /** 1122 HQ sector CSR assignment — null means not sector-bound */
  @Column({ name: 'sector_id', nullable: true })
  sectorId: string | null;

  @ManyToOne(() => Sector, { nullable: true })
  @JoinColumn({ name: 'sector_id' })
  sector: Sector | null;

  /** City overseer watches all sectors; does not claim/guide corridors */
  @Column({ name: 'is_city_overseer', default: false })
  isCityOverseer: boolean;

  @OneToMany(() => Ambulance, (ambulance) => ambulance.driver)
  ambulances: Ambulance[];

  /** For HQ/SafeCity: if populated, user can only see these providers' fleets/transits */
  @Column('simple-array', { name: 'permitted_provider_ids', nullable: true })
  permittedProviderIds: string[] | null;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'api_key', type: 'varchar', unique: true, nullable: true })
  apiKey: string | null;

  /** Failed login counter — reset on successful login (OWASP brute-force control) */
  @Column({ name: 'failed_login_attempts', type: 'int', default: 0 })
  failedLoginAttempts: number;

  /** Soft lock until this timestamp after too many failed logins */
  @Column({ name: 'locked_until', type: 'timestamptz', nullable: true })
  lockedUntil: Date | null;

  /** Bumped on logout / password change so outstanding JWTs become invalid */
  @Column({ name: 'token_version', type: 'int', default: 0 })
  tokenVersion: number;
}

