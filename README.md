# FindMySpot

Find the 5 closest ADA-accessible parking spots near any address in Portland, Oregon.

Built as a React + Vercel Serverless application that combines OpenStreetMap data with optional street-imagery sign verification via the Hugging Face Inference API (`IDEA-Research/grounding-dino-tiny`).

## Architecture at a glance

```
┌─────────────────────┐        ┌──────────────────────┐
│  React (Vite, TS)   │ ─────► │ /api/geocode         │ ──► Nominatim (OSM)
│  Tailwind + WCAG    │        │ /api/parking         │ ──► Overpass (OSM)
│  src/, lib/shared/  │ ─────► │ /api/detect-sign     │ ──► Mapillary + HF Inference
└─────────────────────┘        └──────────────────────┘
                                 Vercel Serverless (Node 20)
```

- `src/` — React app (loosely-coupled, presentational components)
- `api/` — Vercel serverless handlers, one per upstream concern
- `lib/shared/` — types & geo helpers used by both client and server
- `lib/server/` — server-only helpers (centralised logger, fetch-with-timeout)
- `docs/adr/` — Architecture Decision Records

The three serverless routes are independent and fail soft. If Mapillary or Hugging Face is unavailable (or no API keys are configured), search results still render with OpenStreetMap accessibility tags.

## Tech stack

| Layer       | Choice                                        |
| ----------- | --------------------------------------------- |
| Frontend    | React 18, TypeScript, Vite, Tailwind CSS      |
| Backend     | Vercel Serverless Functions (Node 20, TS)     |
| Geocoding   | Google Maps Geocoding API (see ADR-0004)      |
| Parking data| Overpass API (OSM, bounded to Portland)       |
| Imagery     | Mapillary v4 (free with token)                |
| ML          | Hugging Face Inference API — groundingDino    |

No persistent database — every search hits live upstream data and benefits from Vercel's edge cache.

## Accessibility

- All form inputs are programmatically labelled and announce errors via `role="alert"`.
- Results region has a visible focus ring and receives keyboard focus after a search.
- High-contrast brand colours (≥4.5:1 against backgrounds, WCAG 2.1 AA).
- `prefers-reduced-motion` honoured throughout.
- Skip-link to `<main>` for keyboard users.
- Semantic landmarks (`<header>`, `<main>`, `<footer>`, `role="status"`, `role="alert"`).

## Local development

```bash
npm install

# Copy the env template and fill in any keys you have.
# All keys are OPTIONAL — leave blank to fall back to OSM-tag-only results.
cp .env.example .env

# Starts local Node API server (3000) + Vite dev server (5173)
npm run dev
```

Open <http://localhost:5173>.

If you want to run each process separately:

```bash
# Terminal 1: local API server
npm run dev:api

# Terminal 2: Vite dev server (proxies /api -> localhost:3000)
npm run dev:web
```

For production-parity testing with Vercel's local runtime:

```bash
npm run dev:api:vercel
```

That command may require `vercel login`.

## Deploying to Vercel

```bash
npx vercel link        # one-time
npx vercel env add HUGGINGFACE_API_TOKEN   # optional but recommended
npx vercel env add MAPILLARY_CLIENT_TOKEN  # optional but recommended
npx vercel --prod
```

Vercel auto-detects Vite via `vercel.json` and bundles each `api/*.ts` as a serverless function (Node 20, 512 MB, 30 s).

## Environment variables

| Variable                    | Purpose                                              | Required |
| --------------------------- | ---------------------------------------------------- | -------- |
| `GOOGLE_GEOCODING_API_KEY`  | Address → coordinate lookups via Google Geocoding    | **yes**  |
| `HUGGINGFACE_API_TOKEN`     | Calls hosted `IDEA-Research/grounding-dino-tiny`     | optional |
| `MAPILLARY_CLIENT_TOKEN`    | Fetches street-level images near each parking spot   | optional |

Without `GOOGLE_GEOCODING_API_KEY`, `/api/geocode` returns HTTP 503 and the UI surfaces a clear error. The ML keys remain optional — when missing, `/api/detect-sign` returns `{ detected: false, reason: 'missing_credentials' }` and the UI falls back to OSM-tag-based accessibility info.

**Google API key setup.** Create a key at <https://console.cloud.google.com/google/maps-apis/credentials>, enable the *Geocoding API* on the project, and restrict the key to that single API. Keep the key server-side only — Vercel serverless IPs rotate, so don't bother with an IP allow-list; rely on API restriction + billing alerts.

**Why Google?** See [ADR-0004](docs/adr/0004-google-geocoding-over-nominatim.md). Tl;dr: better address parsing, a real precision signal we surface in the UI, and no usage-policy compliance work. Costs ~US$5 / 1,000 requests after the US$200/month free credit.

## Project commands

```bash
npm run dev        # API (3000) + Vite dev server (5173)
npm run dev:web    # Vite only
npm run dev:api    # Local Node API server only (no Vercel login)
npm run dev:api:vercel  # Vercel serverless runtime (parity mode)
npm run typecheck  # tsc -b --noEmit across all 3 tsconfig projects
npm run build      # type-check + production build into dist/
npm run preview    # serve the built output locally
```

## License & attribution

Application code: MIT (see `LICENSE` if added).
Parking & address data © OpenStreetMap contributors, licensed [ODbL](https://www.openstreetmap.org/copyright).
Street-level imagery © Mapillary contributors (CC BY-SA 4.0).

© 2026 Uplift Sols™
