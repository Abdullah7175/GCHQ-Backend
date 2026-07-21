import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Transit } from '../transits/transit.entity';

@Entity('eta_snapshots')
@Index('IDX_eta_snapshots_transit_predicted', ['transitId', 'predictedAt'])
export class EtaSnapshot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'transit_id' })
  transitId: string;

  @ManyToOne(() => Transit, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'transit_id' })
  transit: Transit;

  @Column({ name: 'predicted_at', type: 'timestamptz' })
  predictedAt: Date;

  @Column({ name: 'eta_seconds', type: 'int' })
  etaSeconds: number;

  @Column({ name: 'eta_timestamp', type: 'timestamptz' })
  etaTimestamp: Date;

  @Column({ name: 'remaining_distance_km', type: 'float' })
  remainingDistanceKm: number;

  @Column({ name: 'rolling_avg_speed_kmh', type: 'float' })
  rollingAvgSpeedKmh: number;

  @Column({ name: 'off_route_meters', type: 'float', default: 0 })
  offRouteMeters: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
