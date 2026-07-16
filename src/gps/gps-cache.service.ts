import { Injectable, OnModuleDestroy, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GpsLocation } from './gps-location.entity';
import { TransitsService } from '../transits/transits.service';

interface CachedLocation {
  ambulanceId: string;
  transitId?: string | null;
  latitude: number;
  longitude: number;
  speed: number;
  heading?: number | null;
  recordedAt: Date;
  etaMinutes?: number | null;
}

@Injectable()
export class GpsCacheService implements OnModuleDestroy {
  private cache = new Map<string, CachedLocation>();
  private writeBuffer: CachedLocation[] = [];
  private flushInterval: NodeJS.Timeout;

  constructor(
    @InjectRepository(GpsLocation) private readonly gpsRepo: Repository<GpsLocation>,
    @Inject(forwardRef(() => TransitsService))
    private readonly transitsService: TransitsService,
  ) {
    this.flushInterval = setInterval(() => this.flushBuffer(), 10000);
  }

  async update(loc: CachedLocation) {
    // 1. Update in-memory state for instant retrieval
    this.cache.set(loc.ambulanceId, loc);

    // 2. Queue for database batch writing
    this.writeBuffer.push(loc);

    // 3. Process geofencing / active transit state updates
    return this.transitsService.applyGpsUpdate(
      loc.ambulanceId,
      loc.latitude,
      loc.longitude,
      loc.speed,
      loc.etaMinutes,
    );
  }

  getLatest(ambulanceId: string): CachedLocation | undefined {
    return this.cache.get(ambulanceId);
  }

  async flushBuffer() {
    if (this.writeBuffer.length === 0) return;
    const batch = [...this.writeBuffer];
    this.writeBuffer = [];

    try {
      await this.gpsRepo.insert(batch.map((b) => ({
        ambulanceId: b.ambulanceId,
        transitId: b.transitId ?? null,
        latitude: b.latitude,
        longitude: b.longitude,
        speed: b.speed,
        heading: b.heading ?? null,
        recordedAt: b.recordedAt,
      })));
    } catch (err) {
      console.error('Failed to flush telemetry batch to DB', err);
      // Re-queue on failure
      this.writeBuffer.unshift(...batch);
    }
  }

  onModuleDestroy() {
    clearInterval(this.flushInterval);
  }
}
