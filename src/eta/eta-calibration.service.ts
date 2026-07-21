import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EtaCorrectionFactor } from './eta-correction-factor.entity';
import { Transit } from '../transits/transit.entity';
import { TransitStatus } from '../common/enums';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const MIN_SAMPLES = 10;

@Injectable()
export class EtaCalibrationService implements OnModuleInit {
  private readonly logger = new Logger(EtaCalibrationService.name);

  constructor(
    @InjectRepository(EtaCorrectionFactor)
    private readonly factorRepo: Repository<EtaCorrectionFactor>,
    @InjectRepository(Transit)
    private readonly transitRepo: Repository<Transit>,
  ) {}

  onModuleInit() {
    // First run after 2 minutes (let schema settle), then weekly.
    setTimeout(() => void this.recomputeCorrectionFactors(), 120_000);
    setInterval(() => void this.recomputeCorrectionFactors(), WEEK_MS);
  }

  async getCorrectionFactor(cityId: string, hourOfDay: number): Promise<number> {
    const row = await this.factorRepo.findOne({ where: { cityId, hourOfDay } });
    if (!row || row.sampleSize < MIN_SAMPLES) return 1.0;
    return Number(row.correctionFactor) || 1.0;
  }

  async recomputeCorrectionFactors(): Promise<void> {
    this.logger.log('Recomputing ETA correction factors from completed trips');

    const since = new Date(Date.now() - 56 * 24 * 60 * 60 * 1000);
    const trips = await this.transitRepo
      .createQueryBuilder('t')
      .where('t.status = :status', { status: TransitStatus.COMPLETED })
      .andWhere('t.started_at IS NOT NULL')
      .andWhere('t.arrived_at IS NOT NULL')
      .andWhere('t.static_duration_seconds IS NOT NULL')
      .andWhere('t.static_duration_seconds > 0')
      .andWhere('t.started_at >= :since', { since })
      .select([
        't.id AS id',
        't.city_id AS "cityId"',
        't.started_at AS "startedAt"',
        't.arrived_at AS "arrivedAt"',
        't.static_duration_seconds AS "staticDurationSeconds"',
      ])
      .getRawMany<{
        cityId: string;
        startedAt: Date;
        arrivedAt: Date;
        staticDurationSeconds: number;
      }>();

    const buckets = new Map<string, number[]>();

    for (const trip of trips) {
      const staticSec = Number(trip.staticDurationSeconds);
      if (!staticSec || staticSec <= 0) continue;
      const started = new Date(trip.startedAt);
      const arrived = new Date(trip.arrivedAt);
      const actualSec = (arrived.getTime() - started.getTime()) / 1000;
      if (actualSec <= 0) continue;

      const ratio = actualSec / staticSec;
      if (ratio < 0.5 || ratio > 4) continue;

      const hour = started.getHours();
      const key = `${trip.cityId}:${hour}`;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push(ratio);
    }

    for (const [key, ratios] of buckets) {
      const [cityId, hourStr] = key.split(':');
      const hourOfDay = Number(hourStr);
      const sorted = [...ratios].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];

      const existing = await this.factorRepo.findOne({ where: { cityId, hourOfDay } });
      if (existing) {
        await this.factorRepo.update(existing.id, {
          correctionFactor: Number(median.toFixed(3)),
          sampleSize: ratios.length,
        });
      } else {
        await this.factorRepo.save({
          cityId,
          hourOfDay,
          correctionFactor: Number(median.toFixed(3)),
          sampleSize: ratios.length,
        });
      }
    }

    this.logger.log(
      `Updated ${buckets.size} (city, hour) correction buckets from ${trips.length} trips`,
    );
  }
}
