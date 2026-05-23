import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createLogger } from '../lib/server/logger.js';
import { fetchWithTimeout, sendError } from '../lib/server/http.js';

const log = createLogger('api:detect-sign');

const HF_TOKEN = process.env.HUGGINGFACE_API_TOKEN;
const MAPILLARY_TOKEN = process.env.MAPILLARY_CLIENT_TOKEN;
const GROUNDING_DINO_MODEL = 'IDEA-Research/grounding-dino-tiny';
const TEXT_PROMPT = 'ADA accessible parking sign. wheelchair parking sign. handicap parking sign.';

/**
 * POST /api/detect-sign  { lat: number, lng: number }
 *
 * 1. Calls Mapillary's `/images` endpoint to find the closest street-level photo.
 * 2. Downloads that image and forwards it to Hugging Face's hosted groundingDino.
 * 3. Returns the highest-confidence detection, or `{ detected: false, imageUrl }`
 *    when only imagery is available.
 *
 * Designed to fail soft — any upstream issue yields `{ detected: false, reason }`
 * with a 200 so the UI can keep rendering OSM-tag-based info.
 */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    sendError(res, 405, 'method_not_allowed', 'Use POST.');
    return;
  }

  if (!MAPILLARY_TOKEN) {
    res.status(200).json({ detected: false, reason: 'missing_mapillary_token' });
    return;
  }

  const body = (req.body ?? {}) as { lat?: number; lng?: number };
  const { lat, lng } = body;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    sendError(res, 400, 'bad_coords', 'Provide finite lat and lng in the JSON body.');
    return;
  }

  // ~50m bbox around the point — wide enough to find a nearby Mapillary frame
  // but tight enough that the frame is actually facing the lot.
  const d = 0.0005;
  const bbox = [lng! - d, lat! - d, lng! + d, lat! + d].join(',');

  try {
    const mapillaryUrl = new URL('https://graph.mapillary.com/images');
    mapillaryUrl.searchParams.set('access_token', MAPILLARY_TOKEN);
    mapillaryUrl.searchParams.set('fields', 'id,thumb_1024_url,captured_at');
    mapillaryUrl.searchParams.set('bbox', bbox);
    mapillaryUrl.searchParams.set('limit', '1');

    const mapRes = await fetchWithTimeout(mapillaryUrl.toString(), {}, 6_000);
    if (!mapRes.ok) {
      log.warn('mapillary_non_ok', { status: mapRes.status });
      res.status(200).json({ detected: false, reason: 'mapillary_unavailable' });
      return;
    }
    const mapPayload = (await mapRes.json()) as {
      data?: Array<{ id: string; thumb_1024_url?: string }>;
    };
    const imageUrl = mapPayload.data?.[0]?.thumb_1024_url;
    if (!imageUrl) {
      res.status(200).json({ detected: false, reason: 'no_imagery' });
      return;
    }

    if (!HF_TOKEN) {
      res.status(200).json({ detected: false, reason: 'missing_hf_token', imageUrl });
      return;
    }

    // groundingDino on HF Inference accepts a binary image body + a `inputs.text`
    // prompt. The HF JS client would also work but adds bundle weight.
    const imgRes = await fetchWithTimeout(imageUrl, {}, 8_000);
    if (!imgRes.ok) {
      res.status(200).json({ detected: false, reason: 'image_fetch_failed' });
      return;
    }
    const imageBytes = new Uint8Array(await imgRes.arrayBuffer());

    const hfRes = await fetchWithTimeout(
      `https://api-inference.huggingface.co/models/${GROUNDING_DINO_MODEL}`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${HF_TOKEN}`,
          'content-type': 'application/octet-stream',
          'x-wait-for-model': 'true',
          'x-use-cache': 'true',
        },
        body: imageBytes,
      },
      20_000,
    );

    if (!hfRes.ok) {
      log.warn('hf_non_ok', { status: hfRes.status });
      res.status(200).json({ detected: false, reason: 'inference_error', imageUrl });
      return;
    }

    // HF zero-shot object detection returns Array<{score, label, box}>.
    // (Some HF wrappers return {predictions: [...]} — handle both.)
    const hfPayload = (await hfRes.json()) as
      | Array<{ score: number; label: string }>
      | { predictions?: Array<{ score: number; label: string }> };
    const predictions = Array.isArray(hfPayload)
      ? hfPayload
      : hfPayload.predictions ?? [];

    if (predictions.length === 0) {
      res.status(200).json({ detected: false, reason: 'no_detections', imageUrl, prompt: TEXT_PROMPT });
      return;
    }

    const top = predictions.reduce((best, cur) => (cur.score > best.score ? cur : best));
    res.status(200).json({
      detected: true,
      confidence: top.score,
      label: top.label,
      imageUrl,
      prompt: TEXT_PROMPT,
    });
  } catch (err) {
    log.error('detect_failed', { err: (err as Error).message });
    res.status(200).json({ detected: false, reason: 'exception' });
  }
}
