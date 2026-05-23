# ADR 0001 — Vercel Serverless over a long-running Node server

- **Status:** Accepted
- **Date:** 2026-05-23
- **Deciders:** FindMySpot core

## Context

The product brief mandates deployment on Vercel. We need a place to run the
geocoding, Overpass, and groundingDino calls — these can't run in the browser
because (a) the HF Inference API token must stay server-side, and (b) Overpass
has CORS limitations and benefits from a single warm cache layer.

The two practical Vercel options are:

1. **Serverless Functions** (`api/*.ts`) — each route is its own bundled Node
   function, ≤250 MB unzipped, ≤30 s execution.
2. **A long-running Node server** running elsewhere (Fly.io, Render, etc.)
   reverse-proxied through Vercel.

## Decision

Use **Vercel Serverless Functions**, one per upstream concern (`geocode`,
`parking`, `detect-sign`).

## Consequences

**Positive**

- Zero ops: deploys + scales to zero with the frontend.
- Each function has its own bundle, isolating dependency weight.
- Edge cache headers (`s-maxage`) front each function for free, which suits
  slow-changing OSM data.
- Single repo, single deploy, single attribution surface.

**Negative**

- 250 MB hard limit per function rules out shipping a local PyTorch /
  transformers model for groundingDino — addressed in [ADR 0002](0002-grounding-dino-via-hf-inference-api.md).
- Cold starts add ~300-500 ms on the first request — acceptable for a search UX.
- No shared in-memory cache between invocations — fine because Vercel's edge
  cache handles the repeated-query case.

## Alternatives considered

- **Self-hosted Node server.** Adds an extra deploy target, an extra failure
  domain, and extra cost. Rejected for this scope.
- **Vercel Edge Functions (V8 isolates).** Faster cold start but no Node APIs
  and a tighter bundle limit. The HF/Mapillary flow uses `fetch` only so it
  would technically run, but we want the door open for Node-only deps (sharp,
  jsdom, etc.) later, so we stayed on the Node runtime.
