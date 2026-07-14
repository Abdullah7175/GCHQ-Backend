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

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  latitude: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  longitude: number | null;

  @Column({ name: 'sector_id', nullable: true })
  sectorId: string | null;

  @ManyToOne(() => Sector, (sector) => sector.hospitals, { nullable: true })
  @JoinColumn({ name: 'sector_id' })
  sector: Sector | null;

  @Column({ name: 'bed_capacity', default: 0 })
  bedCapacity: number;

  @Column({ name: 'er_bays', default: 0 })
  erBays: number;

  @OneToMany(() => Transit, (transit) => transit.hospital)
  transits: Transit[];

  @OneToMany(() => User, (user) => user.hospital)
  users: User[];
}
