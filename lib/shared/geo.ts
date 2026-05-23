import type { LatLng } from './types.js';

/** Portland, OR bounding box (south, west, north, east) — used to constrain queries. */
export const PORTLAND_BBOX = Object.freeze({
  south: 45.432,
  west: -122.836,
  north: 45.653,
  east: -122.472,
});

export function isInsidePortland({ lat, lng }: LatLng): boolean {
  return (
    lat >= PORTLAND_BBOX.south &&
    lat <= PORTLAND_BBOX.north &&
    lng >= PORTLAND_BBOX.west &&
    lng <= PORTLAND_BBOX.east
  );
}

/**
 * Great-circle distance between two coordinates using the haversine formula.
 * Returns metres. Accurate to within ~0.5% across Portland's footprint.
 */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const R = 6_371_000; // Earth radius in metres
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h =
    sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(meters < 10_000 ? 2 : 1)} km`;
}
