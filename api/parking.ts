import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createLogger } from '../lib/server/logger.js';
import { fetchWithTimeout, sendError, setCacheHeaders } from '../lib/server/http.js';
import {
  PORTLAND_BBOX,
  haversineMeters,
  isInsidePortland,
} from '../lib/shared/geo.js';
import type {
  AccessibilitySignal,
  LatLng,
  ParkingSpot,
  SearchResponse,
} from '../lib/shared/types.js';

const log = createLogger('api:parking');
const OVERPASS_ENDPOINT = 'https://overpass-api.de/api/interpreter';
const DEFAULT_LIMIT = 5;
const OVERPASS_USER_AGENT = process.env.OVERPASS_USER_AGENT ?? 'FindMySpot/0.1 (local-dev)';

/**
 * Overpass QL: any element tagged amenity=parking inside Portland that either
 *   - declares `capacity:disabled` (>=1), or
 *   - declares `wheelchair=yes|designated|limited`.
 *
 * We pull nodes, ways, and relations and project everything to their centroid
 * via `out center;` so the client only deals with point geometry.
 */
function buildOverpassQuery(bbox: typeof PORTLAND_BBOX): string {
  const b = `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`;
  return `
[out:json][timeout:25];
(
  node["amenity"="parking"]["capacity:disabled"](${b});
  way["amenity"="parking"]["capacity:disabled"](${b});
  relation["amenity"="parking"]["capacity:disabled"](${b});
  node["amenity"="parking"]["wheelchair"~"yes|designated|limited"](${b});
  way["amenity"="parking"]["wheelchair"~"yes|designated|limited"](${b});
  relation["amenity"="parking"]["wheelchair"~"yes|designated|limited"](${b});
);
out center tags;
`.trim();
}

interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

function elementCoords(el: OverpassElement): LatLng | null {
  if (el.type === 'node' && el.lat != null && el.lon != null) {
    return { lat: el.lat, lng: el.lon };
  }
  if (el.center) return { lat: el.center.lat, lng: el.center.lon };
  return null;
}

function deriveSignals(tags: Record<string, string>): AccessibilitySignal[] {
  const signals: AccessibilitySignal[] = [];
  const capStr = tags['capacity:disabled'];
  if (capStr) {
    const n = Number.parseInt(capStr, 10);
    if (Number.isFinite(n) && n > 0) {
      signals.push({ kind: 'osm:capacity_disabled', value: n });
    }
  }
  const wheelchair = tags['wheelchair'];
  if (wheelchair === 'yes' || wheelchair === 'designated' || wheelchair === 'limited') {
    signals.push({ kind: 'osm:wheelchair', value: wheelchair });
  }
  return signals;
}

function deriveName(tags: Record<string, string>): string {
  return (
    tags['name'] ??
    tags['operator'] ??
    ([tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' ') ||
      'Parking lot')
  );
}

/**
 * GET /api/parking?lat=<n>&lng=<n>&limit=<n>
 *
 * Returns the N closest ADA-accessible parking spots to (lat, lng), ranked by
 * straight-line distance. Response is a partial SearchResponse — the caller is
 * expected to merge in the geocoded address before sending to the UI.
 */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'GET') {
    sendError(res, 405, 'method_not_allowed', 'Use GET.');
    return;
  }

  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  const limit = Math.min(Math.max(Number(req.query.limit) || DEFAULT_LIMIT, 1), 25);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    sendError(res, 400, 'bad_coords', 'lat and lng must be finite numbers.');
    return;
  }
  const origin: LatLng = { lat, lng };
  if (!isInsidePortland(origin)) {
    sendError(res, 422, 'out_of_bounds', 'Origin must be inside the Portland, OR bounding box.');
    return;
  }

  const body = `data=${encodeURIComponent(buildOverpassQuery(PORTLAND_BBOX))}`;

  try {
    const upstream = await fetchWithTimeout(
      OVERPASS_ENDPOINT,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          accept: 'application/json,text/plain,*/*',
          'user-agent': OVERPASS_USER_AGENT,
        },
        body,
      },
      20_000,
    );

    if (!upstream.ok) {
      log.warn('overpass_non_ok', { status: upstream.status });
      sendError(res, 502, 'upstream_error', `Overpass returned ${upstream.status}.`);
      return;
    }

    const payload = (await upstream.json()) as { elements: OverpassElement[] };
    const spots: ParkingSpot[] = [];

    for (const el of payload.elements) {
      const coords = elementCoords(el);
      if (!coords) continue;
      const tags = el.tags ?? {};
      const signals = deriveSignals(tags);
      if (signals.length === 0) continue;

      spots.push({
        id: `${el.type}/${el.id}`,
        name: deriveName(tags),
        location: coords,
        distanceMeters: haversineMeters(origin, coords),
        tags,
        signals,
        osmUrl: `https://www.openstreetmap.org/${el.type}/${el.id}`,
      });
    }

    spots.sort((a, b) => a.distanceMeters - b.distanceMeters);
    const topSpots = spots.slice(0, limit);

    log.info('overpass_ok', { rawCount: payload.elements.length, kept: spots.length, returned: topSpots.length });

    const response: Omit<SearchResponse, 'geocoded'> = {
      spots: topSpots,
      searchedAt: new Date().toISOString(),
      detectionAttempted: false,
    };

    setCacheHeaders(res, 120);
    res.status(200).json(response);
  } catch (err) {
    log.error('parking_failed', { err: (err as Error).message });
    sendError(res, 504, 'timeout', 'Overpass query timed out. Try again in a moment.');
  }
}
