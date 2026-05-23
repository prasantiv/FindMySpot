import type { VercelResponse } from '@vercel/node';
import type { ErrorEnvelope } from '../shared/types.js';

/**
 * fetch wrapped with an abort timeout. Every upstream call from our serverless
 * functions MUST use this — otherwise a slow OSM mirror can pin the function
 * until Vercel's hard timeout fires, blowing the user's request budget.
 */
export async function fetchWithTimeout(
  input: string,
  init: RequestInit = {},
  timeoutMs = 8_000,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Uniform JSON error response so the client can parse a single shape. */
export function sendError(
  res: VercelResponse,
  status: number,
  code: string,
  message: string,
  details?: unknown,
): void {
  const body: ErrorEnvelope = { error: { code, message, ...(details ? { details } : {}) } };
  res.status(status).setHeader('content-type', 'application/json').send(JSON.stringify(body));
}

/** Cache for 5 minutes at the edge — OSM/Nominatim data changes slowly. */
export function setCacheHeaders(res: VercelResponse, seconds = 300): void {
  res.setHeader('cache-control', `public, s-maxage=${seconds}, stale-while-revalidate=${seconds * 2}`);
}
