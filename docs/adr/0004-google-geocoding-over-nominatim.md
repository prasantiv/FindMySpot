# ADR 0004 — Google Geocoding API over OpenStreetMap Nominatim

- **Status:** Accepted (supersedes the geocoding portion of [ADR 0003](0003-osm-overpass-as-primary-data-source.md))
- **Date:** 2026-05-23

## Context

The initial implementation used OpenStreetMap Nominatim for address →
coordinate lookups. Nominatim is free and aligns naturally with our use of
Overpass for parking data, but real-world usage exposed three weaknesses:

1. **Address parsing.** Nominatim is unforgiving of typos, abbreviations, and
   business-name queries ("Powell's", "PSU"). For a public-facing app, the
   first interaction is a freeform text field — getting that wrong is the
   worst possible UX failure mode.
2. **Confidence signal.** Nominatim returns a single result with no
   well-defined precision indicator, so the UI cannot warn the user when
   their address only resolved to a block or neighbourhood centroid.
3. **Operational policy.** The public Nominatim endpoint is rate-limited to
   ~1 request/second and asks heavy users to self-host. Acceptable for a
   demo, but a real production deployment would need to stand up its own
   Nominatim instance — a non-trivial ops burden.

## Decision

Replace Nominatim with the **Google Maps Platform Geocoding API**.

The `/api/geocode` contract is unchanged from the client's perspective; the
`GeocodeResult` shape gains two fields:

- `confidence: 'rooftop' | 'interpolated' | 'approximate'` — mapped from
  Google's `location_type` so the UI can surface a low-confidence warning
  banner.
- `placeId?: string` — Google's stable identifier, kept for future caching
  or favourites work.

## Consequences

**Positive**

- Higher-quality matches across typos, abbreviations, and POI names.
- A real precision signal we surface in the UI when an address only resolved
  approximately.
- No usage-policy compliance work (no User-Agent rules, no self-host ask).

**Negative**

- **Cost.** US$5 per 1,000 requests after a US$200/month free credit (~40k
  requests/month free). Acceptable for the expected MVP volume; will require
  attention if traffic grows.
- **Attribution constraint.** Google Maps Platform ToS §3.2.3(b) require
  data returned by the Geocoding API to be displayed on a Google Map. We
  therefore route the per-spot "Directions" link in `ParkingCard.tsx` to
  google.com/maps instead of openstreetmap.org. Parking *data* (which comes
  from Overpass, not Google) continues to credit OSM contributors in the
  footer.
- **Setup friction.** Contributors now need a Google Cloud project with
  billing enabled before they can run the app locally. We considered keeping
  Nominatim as a fallback (see "Alternatives" below) but rejected it for
  simplicity.
- **Bounds is a bias, not a hard filter.** We still validate every result
  against `PORTLAND_BBOX` in `geo.ts` and reject anything outside.

## Alternatives considered

- **Keep Nominatim + add Google as opt-in.** A `geocoder` strategy pattern
  selecting based on `GOOGLE_GEOCODING_API_KEY` presence. Rejected: two code
  paths to test, two answer qualities for the same input, and the cheaper
  path is the one we don't want as the default. Easy to add later if needed.
- **Mapbox Geocoding.** Comparable quality and cheaper per-request, but
  Mapbox terms also require map display attribution, so it offers no
  practical attribution win over Google and adds a fourth provider to the
  stack.
- **AWS Location Service.** Cheaper still, but the precision indicators are
  weaker than Google's `location_type`.

## Rollback plan

Reverting is a single-file change — restore the previous `api/geocode.ts`
from git and drop the `confidence` field from `GeocodeResult`. The frontend
gracefully no-ops the low-confidence banner because the field becomes
`undefined`, but a type-level update is required for strict mode.
