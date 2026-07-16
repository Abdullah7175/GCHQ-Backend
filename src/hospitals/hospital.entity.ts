import { Entity, Column, OneToMany, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';
import { City } from '../cities/city.entity';
import { Sector } from '../sectors/sector.entity';
import { Transit } from '../transits/transit.entity';
import { User } from '../users/user.entity';

@Entity('hospitals')
export class Hospital extends BaseEntity {
  @Column()
  name: string;

  @Column({ name: 'city_id' })
  cityId: string;

  @ManyToOne(() => City, (city) => city.hospitals, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'city_id' })
  city: City;

  @Column({ type: 'varchar', nullable: true })
  address: string | null;

  /** Required for driver shortest-path routing to this ER */
  @Column({ type: 'decimal', precision: 10, scale: 7 })
  latitude: number;

  @Column({ type: 'decimal', precision: 10, scale: 7 })
  longitude: number;

  @Column({ name: 'sector_id', nullable: true })
  sectorId: string | null;

  @ManyToOne(() => Sector, (sector) => sector.hospitals, { nullable: true })
  @JoinColumn({ name: 'sector_id' })
  sector: Sector | null;

  @Column({ type: 'simple-array', nullable: true })
  specialties: string[] | null;

  @OneToMany(() => Transit, (transit) => transit.hospital)
  transits: Transit[];

  @OneToMany(() => User, (user) => user.hospital)
  users: User[];
}
