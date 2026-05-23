/**
 * Shared domain types used on both client and server.
 * Keeping these in one place makes the API surface a single source of truth.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

/**
 * How precisely the geocoder pinpointed the address.
 * - `rooftop`     — exact building (Google `ROOFTOP`).
 * - `interpolated` — interpolated along a street segment (Google `RANGE_INTERPOLATED`).
 * - `approximate` — block / neighbourhood / city centroid; treat with low confidence.
 */
export type GeocodeConfidence = 'rooftop' | 'interpolated' | 'approximate';

export interface GeocodeResult {
  /** Original query string, echoed back for display. */
  query: string;
  /** Normalised, human-readable formatted address from the geocoder. */
  displayName: string;
  location: LatLng;
  /** Provider's view of how exact the match is. */
  confidence: GeocodeConfidence;
  /** Stable identifier from the geocoder, if any (e.g. Google place_id). Useful for caching. */
  placeId?: string;
}

export type AccessibilitySignal =
  /** OSM `capacity:disabled` tag with an integer value. */
  | { kind: 'osm:capacity_disabled'; value: number }
  /** OSM `wheelchair=yes` or similar. */
  | { kind: 'osm:wheelchair'; value: 'yes' | 'designated' | 'limited' }
  /** Result of running groundingDino on a Mapillary image. */
  | {
      kind: 'image:grounding_dino';
      confidence: number;
      label: string;
      imageUrl: string;
    };

export interface ParkingSpot {
  /** Stable OSM identifier — `node/12345`, `way/12345`, or `relation/12345`. */
  id: string;
  /** Human-readable name (street + nearest cross-street if available). */
  name: string;
  location: LatLng;
  /** Distance from the query address, in metres. */
  distanceMeters: number;
  /** Raw OSM tags, useful for power users and debugging. */
  tags: Record<string, string>;
  /** Aggregated accessibility evidence — at least one entry per result we return. */
  signals: AccessibilitySignal[];
  /** Optional street-level image near this spot (e.g., Mapillary thumbnail). */
  streetImageUrl?: string;
  /** Convenience link to view the spot on openstreetmap.org. */
  osmUrl: string;
}

export interface SearchResponse {
  geocoded: GeocodeResult;
  spots: ParkingSpot[];
  /** ISO timestamp of when the search was performed (server clock). */
  searchedAt: string;
  /** True if image-based detection was attempted; false if skipped (no keys, etc.). */
  detectionAttempted: boolean;
}

export interface ErrorEnvelope {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
