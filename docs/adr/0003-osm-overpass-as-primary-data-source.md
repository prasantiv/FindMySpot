# ADR 0003 — OpenStreetMap Overpass as primary parking data source

- **Status:** Accepted
- **Date:** 2026-05-23

## Context

We need a source of ADA-tagged parking lots inside Portland, OR. Candidates:

- **OpenStreetMap Overpass API.** Free, community-maintained, rich
  accessibility schema (`capacity:disabled`, `wheelchair=yes|designated`).
- **City of Portland Open Data (PortlandMaps).** Authoritative for
  city-managed lots, but doesn't cover private/commercial accessible parking.
- **Google Places API.** Comprehensive coverage but commercial license and
  paid quota.

## Decision

**Overpass** is the primary source. We query `amenity=parking` filtered to
either `capacity:disabled` (numeric) or `wheelchair=yes|designated|limited`,
bounded to the Portland bbox, on every request.

The query returns nodes, ways, and relations, projected to centroids via
Overpass's `out center;` so the client only handles point geometry.

## Consequences

**Positive**

- One free, well-documented endpoint covers both public and private lots.
- Accessibility tagging schema is rich and stable.
- Community can improve the data — we link to the OSM page on every result
  card, encouraging contribution.

**Negative**

- Data quality depends on community coverage; some accessible spots in
  Portland may be missing tags. Mitigated by surfacing both `capacity:disabled`
  AND `wheelchair=*` (broader than either alone).
- Overpass public endpoints have informal rate limits; we share the load by
  setting a 25 s upstream timeout and the Vercel function's edge cache
  (`s-maxage=120`).
- Bounding box is hardcoded to Portland for this MVP. A future ADR will cover
  multi-city expansion (likely via a config table keyed by city slug).

## Follow-ups

- Cross-check OSM coverage against PortlandMaps' published accessible-parking
  dataset; consider a periodic Overpass-warmed snapshot in Vercel Edge Config.
