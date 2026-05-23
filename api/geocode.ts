import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createLogger } from '../lib/server/logger.js';
import { fetchWithTimeout, sendError, setCacheHeaders } from '../lib/server/http.js';
import { PORTLAND_BBOX, isInsidePortland } from '../lib/shared/geo.js';
import type { GeocodeConfidence, GeocodeResult } from '../lib/shared/types.js';

const log = createLogger('api:geocode');
const GOOGLE_KEY = process.env.GOOGLE_GEOCODING_API_KEY;
const GOOGLE_ENDPOINT = 'https://maps.googleapis.com/maps/api/geocode/json';

/** Google's `location_type` enum mapped onto our coarser confidence ladder. */
function mapLocationType(lt: string | undefined): GeocodeConfidence {
  switch (lt) {
    case 'ROOFTOP':
      return 'rooftop';
    case 'RANGE_INTERPOLATED':
      return 'interpolated';
    default:
      // GEOMETRIC_CENTER and APPROXIMATE both indicate a centroid, not a precise point.
      return 'approximate';
  }
}

interface GoogleGeocodeResponse {
  status: string;
  error_message?: string;
  results: Array<{
    formatted_address: string;
    place_id: string;
    geometry: {
      location: { lat: number; lng: number };
      location_type: string;
    };
  }>;
}

/**
 * GET /api/geocode?q=<address>
 *
 * Wraps the Google Maps Geocoding API, biased to the Portland, OR viewport.
 * Note: Google's `bounds` parameter is a *bias*, not a hard filter — we
 * therefore validate the resulting coordinate against PORTLAND_BBOX server-
 * side and reject anything outside.
 *
 * Per Google Maps Platform Terms of Service §3.2.3(b), data returned by the
 * Geocoding API must be displayed on a Google Map. The frontend complies by
 * pointing its "Directions" link at google.com/maps. See ADR-0004.
 */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'GET') {
    sendError(res, 405, 'method_not_allowed', 'Use GET.');
    return;
  }

  if (!GOOGLE_KEY) {
    sendError(
      res,
      503,
      'missing_credentials',
      'Server is missing GOOGLE_GEOCODING_API_KEY. See .env.example.',
    );
    return;
  }

  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (!q) {
    sendError(res, 400, 'missing_query', 'Provide an address via the `q` query parameter.');
    return;
  }

  // Google `bounds` is "southwest|northeast" as "lat,lng|lat,lng".
  const bounds = `${PORTLAND_BBOX.south},${PORTLAND_BBOX.west}|${PORTLAND_BBOX.north},${PORTLAND_BBOX.east}`;

  const url = new URL(GOOGLE_ENDPOINT);
  url.searchParams.set('address', q);
  url.searchParams.set('bounds', bounds);
  url.searchParams.set('region', 'us');
  url.searchParams.set('components', 'administrative_area:OR|country:US');
  url.searchParams.set('key', GOOGLE_KEY);

  try {
    const upstream = await fetchWithTimeout(url.toString(), {}, 6_000);

    if (!upstream.ok) {
      log.warn('google_non_ok', { status: upstream.status });
      sendError(res, 502, 'upstream_error', `Google Geocoding returned ${upstream.status}.`);
      return;
    }

    const payload = (await upstream.json()) as GoogleGeocodeResponse;

    // Google embeds errors in the JSON body even on HTTP 200.
    if (payload.status !== 'OK' && payload.status !== 'ZERO_RESULTS') {
      log.warn('google_status', { status: payload.status, error: payload.error_message });
      const code = payload.status === 'REQUEST_DENIED' ? 'request_denied' : 'upstream_error';
      const httpCode = payload.status === 'OVER_QUERY_LIMIT' ? 429 : 502;
      sendError(res, httpCode, code, payload.error_message ?? `Google returned ${payload.status}.`);
      return;
    }

    if (payload.status === 'ZERO_RESULTS' || payload.results.length === 0) {
      sendError(
        res,
        404,
        'no_match',
        'No address match was found. Try adding "Portland, OR" to your query.',
      );
      return;
    }

    const top = payload.results[0]!;
    const result: GeocodeResult = {
      query: q,
      displayName: top.formatted_address,
      location: { lat: top.geometry.location.lat, lng: top.geometry.location.lng },
      confidence: mapLocationType(top.geometry.location_type),
      placeId: top.place_id,
    };

    if (!isInsidePortland(result.location)) {
      sendError(
        res,
        422,
        'out_of_bounds',
        'That address resolved outside the Portland, OR bounding box.',
        { location: result.location },
      );
      return;
    }

    setCacheHeaders(res, 600);
    res.status(200).json(result);
  } catch (err) {
    log.error('geocode_failed', { err: (err as Error).message });
    sendError(res, 504, 'timeout', 'Geocoding timed out.');
  }
}
