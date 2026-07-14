import { Entity, Column, OneToMany } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';
import { ProviderShape } from '../common/enums';
import { Ambulance } from '../ambulances/ambulance.entity';
import { User } from '../users/user.entity';

@Entity('providers')
export class Provider extends BaseEntity {
  @Column({ unique: true })
  name: string;

  @Column({ unique: true })
  code: string;

  @Column({ type: 'enum', enum: ProviderShape, default: ProviderShape.CIRCLE })
  shape: ProviderShape;

  @Column({ default: '#d93343' })
  color: string;

  @Column({ type: 'varchar', nullable: true })
  description: string | null;

  @OneToMany(() => Ambulance, (ambulance) => ambulance.provider)
  ambulances: Ambulance[];

  @OneToMany(() => User, (user) => user.provider)
  users: User[];
}
