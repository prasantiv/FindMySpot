# ADR 0002 — groundingDino via Hugging Face Inference API

- **Status:** Accepted
- **Date:** 2026-05-23

## Context

The brief asks for `groundingDino` (from Hugging Face transformers) to detect
ADA parking signs in imagery. groundingDino-tiny weights are ~700 MB and the
full Python `transformers` + `torch` install pushes ~1 GB. Our deploy target
(Vercel Serverless, per [ADR 0001](0001-vercel-serverless-over-long-running-server.md))
caps unzipped bundle size at 250 MB and execution time at 30 s.

We need a way to run groundingDino without packaging the model into the
function.

## Options

1. **Hugging Face Inference API (serverless, free tier).**
   POST an image, receive detections. No infra to manage. Rate-limited; cold
   starts can be 10–20 s. Suitable for low-volume / hobby usage.
2. **Hugging Face Inference Endpoints (dedicated).**
   Reserve a GPU/CPU endpoint. Predictable latency. Costs ~$0.06–$0.60/hr while
   running. Overkill for the MVP but trivial to swap into.
3. **Replicate.**
   Pay-per-call, ~$0.0023 per image for grounding-dino. No idle cost.
4. **Self-host on Fly.io / Cloud Run.**
   Most control, most ops. Out of scope.

## Decision

Use the **Hugging Face Inference API** with `IDEA-Research/grounding-dino-tiny`.
The endpoint is hardcoded in `api/detect-sign.ts` so swapping the model (or
the provider) is a one-line change behind the same `/api/detect-sign` contract.

If either `HUGGINGFACE_API_TOKEN` or `MAPILLARY_CLIENT_TOKEN` is missing, the
route returns `{ detected: false, reason: 'missing_credentials' }` with HTTP
200 — the UI keeps rendering OSM-tag-based results. This keeps the demo path
zero-config.

## Consequences

**Positive**

- Zero infra. Works the moment a token is set.
- Easy to upgrade to dedicated Inference Endpoints by changing one URL.
- The `/api/detect-sign` contract (`{ lat, lng } → { detected, confidence,
  label, imageUrl }`) abstracts the provider, so swapping to Replicate is
  isolated to one file.

**Negative**

- Cold starts on the free tier can take 20+ seconds (we set
  `x-wait-for-model: true` to handle this, and the request has a 20s upstream
  timeout inside Vercel's 30s budget).
- Free-tier rate limits will throttle high-volume traffic.
- Latency is unpredictable; we mitigate by running OSM lookup synchronously
  and treating image detection as enrichment (results render either way).

## Follow-ups

- Add a feature flag to disable image detection entirely (e.g. for cost
  control or when HF is degraded).
- Consider caching detections in a KV store keyed by `(lat, lng)` rounded to
  ~10 m so repeat searches on the same lot don't re-run inference.
