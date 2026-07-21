/** Haversine distance in meters between two WGS84 coordinates. */
export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Destination point from origin, distance (m), bearing (degrees). */
export function destinationPoint(
  lat: number,
  lng: number,
  distanceM: number,
  bearingDeg: number,
): { latitude: number; longitude: number } {
  const R = 6371000;
  const brng = (bearingDeg * Math.PI) / 180;
  const lat1 = (lat * Math.PI) / 180;
  const lon1 = (lng * Math.PI) / 180;
  const d = distanceM / R;
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brng),
  );
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(brng) * Math.sin(d) * Math.cos(lat1),
      Math.cos(d) - Math.sin(lat1) * Math.sin(lat2),
    );
  return { latitude: (lat2 * 180) / Math.PI, longitude: (lon2 * 180) / Math.PI };
}

export function buildCircleBoundary(
  centerLat: number,
  centerLng: number,
  radiusMeters: number,
  segments = 36,
): { latitude: number; longitude: number }[] {
  const points: { latitude: number; longitude: number }[] = [];
  for (let i = 0; i < segments; i++) {
    const bearing = (i / segments) * 360;
    points.push(destinationPoint(centerLat, centerLng, radiusMeters, bearing));
  }
  return points;
}

export function isInsideCircle(
  lat: number,
  lng: number,
  centerLat: number,
  centerLng: number,
  radiusMeters: number,
): boolean {
  return haversineMeters(lat, lng, centerLat, centerLng) <= radiusMeters;
}

/** Ray-casting point-in-polygon test. */
export function pointInPolygon(
  lat: number,
  lng: number,
  polygon: { latitude: number; longitude: number }[],
): boolean {
  if (polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const yi = polygon[i].latitude;
    const xi = polygon[i].longitude;
    const yj = polygon[j].latitude;
    const xj = polygon[j].longitude;
    const intersect =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi + Number.EPSILON) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function polygonCentroid(polygon: { latitude: number; longitude: number }[]): {
  latitude: number;
  longitude: number;
} {
  if (!polygon.length) return { latitude: 0, longitude: 0 };
  const sum = polygon.reduce(
    (acc, p) => ({ latitude: acc.latitude + p.latitude, longitude: acc.longitude + p.longitude }),
    { latitude: 0, longitude: 0 },
  );
  return { latitude: sum.latitude / polygon.length, longitude: sum.longitude / polygon.length };
}

export function isInsideGeofence(
  lat: number,
  lng: number,
  geofence: {
    shapeType: string;
    centerLat: number;
    centerLng: number;
    radiusMeters: number | null;
    boundaryPoints?: { latitude: number; longitude: number }[];
  },
): boolean {
  const points = (geofence.boundaryPoints ?? []).map((p) => ({
    latitude: Number(p.latitude),
    longitude: Number(p.longitude),
  }));

  if (geofence.shapeType === 'circle' && geofence.radiusMeters != null) {
    return isInsideCircle(
      lat,
      lng,
      Number(geofence.centerLat),
      Number(geofence.centerLng),
      geofence.radiusMeters,
    );
  }

  if (points.length >= 3) {
    return pointInPolygon(lat, lng, points);
  }

  return false;
}
