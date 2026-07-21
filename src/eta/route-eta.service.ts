import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as turf from '@turf/turf';
import { EtaSnapshot } from './eta-snapshot.entity';

export type GpsPing = {
  transitId: string;
  lat: number;
  lng: number;
  timestamp?: number;
};

export type EtaResult = {
  transitId: string;
  remainingDistanceKm: number;
  rollingAvgSpeedKmh: number;
  etaSeconds: number;
  etaMinutes: number;
  etaTimestamp: number;
  snappedLat: number;
  snappedLng: number;
  offRouteMeters: number;
  needsReroute: boolean;
};

type SpeedSample = {
  timestamp: number;
  distanceAlongRouteKm: number;
};

const SPEED_WINDOW_MS = 90_000;
const MIN_SAMPLES_FOR_SPEED = 2;
const OFF_ROUTE_REROUTE_THRESHOLD_METERS = 150;
const FALLBACK_SPEED_KMH = 15;
const MIN_EFFECTIVE_SPEED_KMH = 3;
/** Only persist a snapshot when ETA drifts by more than this many seconds. */
const SNAPSHOT_ETA_DRIFT_SECONDS = 30;

@Injectable()
export class RouteEtaService {
  private readonly logger = new Logger(RouteEtaService.name);

  private speedBuffers = new Map<string, SpeedSample[]>();
  private routeCache = new Map<
    string,
    { line: ReturnType<typeof turf.lineString>; totalLengthKm: number }
  >();
  private lastPersistedEtaSeconds = new Map<string, number>();

  constructor(
    @InjectRepository(EtaSnapshot)
    private readonly etaSnapshotRepo: Repository<EtaSnapshot>,
  ) {}

  /**
   * Call when corridor starts / re-routes with OSRM [lng, lat] coordinates.
   */
  registerRoute(transitId: string, routeCoordsLngLat: [number, number][]) {
    if (!routeCoordsLngLat?.length) {
      this.logger.warn(`registerRoute skipped — empty geometry for ${transitId}`);
      return;
    }
    const line = turf.lineString(routeCoordsLngLat);
    const totalLengthKm = turf.length(line, { units: 'kilometers' });
    this.routeCache.set(transitId, { line, totalLengthKm });
    this.speedBuffers.set(transitId, []);
    this.lastPersistedEtaSeconds.delete(transitId);
    this.logger.log(
      `Registered route for transit ${transitId}: ${totalLengthKm.toFixed(2)} km (${routeCoordsLngLat.length} pts)`,
    );
  }

  /** Warm cache from DB-stored geometry (e.g. after backend restart). */
  ensureRouteCached(transitId: string, routeCoordsLngLat: [number, number][] | null | undefined) {
    if (this.routeCache.has(transitId)) return;
    if (!routeCoordsLngLat?.length) return;
    this.registerRoute(transitId, routeCoordsLngLat);
  }

  clearRoute(transitId: string) {
    this.routeCache.delete(transitId);
    this.speedBuffers.delete(transitId);
    this.lastPersistedEtaSeconds.delete(transitId);
  }

  async onGpsPing(ping: GpsPing): Promise<EtaResult | null> {
    const cached = this.routeCache.get(ping.transitId);
    if (!cached) return null;

    const { line, totalLengthKm } = cached;
    const timestamp = ping.timestamp ?? Date.now();

    const rawPoint = turf.point([ping.lng, ping.lat]);
    const snapped = turf.nearestPointOnLine(line, rawPoint, { units: 'kilometers' });

    const distanceAlongRouteKm = snapped.properties.location ?? 0;
    const offRouteMeters = (snapped.properties.dist ?? 0) * 1000;
    const needsReroute = offRouteMeters > OFF_ROUTE_REROUTE_THRESHOLD_METERS;
    const remainingDistanceKm = Math.max(totalLengthKm - distanceAlongRouteKm, 0);

    const buffer = this.speedBuffers.get(ping.transitId) ?? [];
    buffer.push({ timestamp, distanceAlongRouteKm });
    const cutoff = timestamp - SPEED_WINDOW_MS;
    const trimmed = buffer.filter((s) => s.timestamp >= cutoff);
    this.speedBuffers.set(ping.transitId, trimmed);

    const rollingAvgSpeedKmh = this.computeRollingSpeed(trimmed);
    const effectiveSpeedKmh =
      rollingAvgSpeedKmh > MIN_EFFECTIVE_SPEED_KMH ? rollingAvgSpeedKmh : FALLBACK_SPEED_KMH;
    const etaSeconds = Math.round((remainingDistanceKm / effectiveSpeedKmh) * 3600);
    const etaTimestamp = timestamp + etaSeconds * 1000;

    const result: EtaResult = {
      transitId: ping.transitId,
      remainingDistanceKm: Number(remainingDistanceKm.toFixed(3)),
      rollingAvgSpeedKmh: Number(rollingAvgSpeedKmh.toFixed(1)),
      etaSeconds,
      etaMinutes: Number((etaSeconds / 60).toFixed(2)),
      etaTimestamp,
      snappedLat: snapped.geometry.coordinates[1],
      snappedLng: snapped.geometry.coordinates[0],
      offRouteMeters: Number(offRouteMeters.toFixed(1)),
      needsReroute,
    };

    if (needsReroute) {
      this.logger.warn(
        `Transit ${ping.transitId} is ${offRouteMeters.toFixed(0)}m off route — recommend re-route`,
      );
    }

    await this.maybePersistSnapshot(result, timestamp);
    return result;
  }

  computeInitialPromisedMinutes(
    staticDurationSeconds: number,
    correctionFactor: number,
  ): number {
    const factor = correctionFactor > 0 ? correctionFactor : 1;
    return Math.max(1, Math.round((staticDurationSeconds * factor) / 60));
  }

  private computeRollingSpeed(samples: SpeedSample[]): number {
    if (samples.length < MIN_SAMPLES_FOR_SPEED) return 0;
    const first = samples[0];
    const last = samples[samples.length - 1];
    const deltaDistanceKm = last.distanceAlongRouteKm - first.distanceAlongRouteKm;
    const deltaTimeHours = (last.timestamp - first.timestamp) / (1000 * 3600);
    if (deltaTimeHours <= 0) return 0;
    return Math.max(deltaDistanceKm / deltaTimeHours, 0);
  }

  private async maybePersistSnapshot(result: EtaResult, timestamp: number): Promise<void> {
    const last = this.lastPersistedEtaSeconds.get(result.transitId);
    if (
      last != null &&
      Math.abs(result.etaSeconds - last) < SNAPSHOT_ETA_DRIFT_SECONDS
    ) {
      return;
    }
    try {
      await this.etaSnapshotRepo.insert({
        transitId: result.transitId,
        predictedAt: new Date(timestamp),
        etaSeconds: result.etaSeconds,
        etaTimestamp: new Date(result.etaTimestamp),
        remainingDistanceKm: result.remainingDistanceKm,
        rollingAvgSpeedKmh: result.rollingAvgSpeedKmh,
        offRouteMeters: result.offRouteMeters,
      });
      this.lastPersistedEtaSeconds.set(result.transitId, result.etaSeconds);
    } catch (err) {
      this.logger.warn(
        `Failed to persist ETA snapshot: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
