import type {
  ErrorEnvelope,
  GeocodeResult,
  ParkingSpot,
  SearchResponse,
} from '@shared/types';
import { logger } from './logger';

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

async function readJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ApiError(res.status, 'bad_json', `Non-JSON response from ${res.url}`);
  }
}

async function unwrap<T>(res: Response): Promise<T> {
  if (res.ok) return readJson<T>(res);
  const env = await readJson<ErrorEnvelope>(res).catch(() => null);
  const code = env?.error?.code ?? 'unknown_error';
  const message = env?.error?.message ?? res.statusText ?? 'Request failed';
  throw new ApiError(res.status, code, message);
}

export async function geocode(q: string): Promise<GeocodeResult> {
  const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
  return unwrap<GeocodeResult>(res);
}

export async function fetchParking(
  lat: number,
  lng: number,
  limit = 5,
): Promise<Omit<SearchResponse, 'geocoded'>> {
  const res = await fetch(`/api/parking?lat=${lat}&lng=${lng}&limit=${limit}`);
  return unwrap<Omit<SearchResponse, 'geocoded'>>(res);
}

export interface DetectionResult {
  detected: boolean;
  confidence?: number;
  label?: string;
  imageUrl?: string;
  reason?: string;
}

export async function detectSign(lat: number, lng: number): Promise<DetectionResult> {
  try {
    const res = await fetch('/api/detect-sign', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ lat, lng }),
    });
    return await unwrap<DetectionResult>(res);
  } catch (err) {
    // Never fail the whole search just because detection blew up.
    logger.warn('detect_failed_client', { err: (err as Error).message });
    return { detected: false, reason: 'client_exception' };
  }
}

/**
 * Orchestrates the full search: geocode → parking → optional sign detection.
 * Detection runs in parallel across the top-N spots; partial failures don't
 * fail the whole result.
 */
export async function search(query: string): Promise<SearchResponse> {
  const geocoded = await geocode(query);
  const parking = await fetchParking(geocoded.location.lat, geocoded.location.lng, 5);

  const enriched: ParkingSpot[] = await Promise.all(
    parking.spots.map(async (spot) => {
      const det = await detectSign(spot.location.lat, spot.location.lng);
      const withImage = det.imageUrl
        ? { ...spot, streetImageUrl: det.imageUrl }
        : spot;

      if (!det.detected || det.confidence == null || !det.label || !det.imageUrl) {
        return withImage;
      }
      return {
        ...withImage,
        signals: [
          ...withImage.signals,
          {
            kind: 'image:grounding_dino',
            confidence: det.confidence,
            label: det.label,
            imageUrl: det.imageUrl,
          },
        ],
      };
    }),
  );

  return {
    geocoded,
    spots: enriched,
    searchedAt: parking.searchedAt,
    detectionAttempted: true,
  };
}
