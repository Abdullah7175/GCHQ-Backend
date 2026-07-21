/**
 * Fetches driving route geometry + static duration from OSRM (self-hosted or public).
 * Set OSRM_URL e.g. http://localhost:5000 — defaults to the public demo server.
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type OsrmRouteResult = {
  /** [lng, lat] coordinates (GeoJSON / OSRM order) */
  coordinatesLngLat: [number, number][];
  durationSeconds: number;
  distanceMeters: number;
};

@Injectable()
export class OsrmRoutingService {
  private readonly logger = new Logger(OsrmRoutingService.name);
  private readonly baseUrl: string;

  constructor(config: ConfigService) {
    this.baseUrl = (
      config.get<string>('OSRM_URL') || 'https://router.project-osrm.org'
    ).replace(/\/$/, '');
  }

  async getDrivingRoute(
    fromLat: number,
    fromLng: number,
    toLat: number,
    toLng: number,
  ): Promise<OsrmRouteResult | null> {
    const url =
      `${this.baseUrl}/route/v1/driving/` +
      `${fromLng},${fromLat};${toLng},${toLat}` +
      `?overview=full&geometries=geojson`;

    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(8_000),
      });
      if (!res.ok) {
        this.logger.warn(`OSRM HTTP ${res.status} for ${fromLat},${fromLng} → ${toLat},${toLng}`);
        return null;
      }
      const data = (await res.json()) as {
        code?: string;
        routes?: Array<{
          duration: number;
          distance: number;
          geometry?: { coordinates?: [number, number][] };
        }>;
      };
      const route = data.routes?.[0];
      const coords = route?.geometry?.coordinates;
      if (data.code !== 'Ok' || !route || !coords?.length) {
        this.logger.warn(`OSRM no route: code=${data.code}`);
        return null;
      }
      return {
        coordinatesLngLat: coords,
        durationSeconds: Math.round(route.duration),
        distanceMeters: Math.round(route.distance),
      };
    } catch (err) {
      this.logger.warn(
        `OSRM request failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }
}
