import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { User } from '../users/user.entity';

@Entity('user_presence')
export class UserPresence {
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'last_heartbeat_at', type: 'timestamptz' })
  lastHeartbeatAt: Date;

  @Column({ name: 'last_login_at', type: 'timestamptz', nullable: true })
  lastLoginAt: Date | null;

  @Column({ name: 'disconnect_detected_at', type: 'timestamptz', nullable: true })
  disconnectDetectedAt: Date | null;

  @Column({ name: 'open_breach_record_id', type: 'uuid', nullable: true })
  openBreachRecordId: string | null;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
