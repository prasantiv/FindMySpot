/**
 * Tiny structured logger. Centralising it gives us one place to redact secrets
 * and one place to swap in a hosted log sink later (e.g. Vercel Log Drains).
 *
 * Intentionally dependency-free — every byte counts inside a serverless bundle.
 */

type Level = 'debug' | 'info' | 'warn' | 'error';

const REDACT_KEYS = new Set(['token', 'authorization', 'apikey', 'api_key']);

function redact(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(redact);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = REDACT_KEYS.has(k.toLowerCase()) ? '***' : redact(v);
  }
  return out;
}

function emit(level: Level, namespace: string, message: string, context?: Record<string, unknown>): void {
  const payload = {
    level,
    ts: new Date().toISOString(),
    ns: namespace,
    msg: message,
    ...(context ? { ctx: redact(context) as Record<string, unknown> } : {}),
  };
  // Vercel ingests stdout/stderr as logs; pick the right stream per level.
  const line = JSON.stringify(payload);
  if (level === 'error' || level === 'warn') {
    console.error(line);
  } else {
    console.log(line);
  }
}

export function createLogger(namespace: string) {
  return {
    debug: (msg: string, ctx?: Record<string, unknown>) => emit('debug', namespace, msg, ctx),
    info: (msg: string, ctx?: Record<string, unknown>) => emit('info', namespace, msg, ctx),
    warn: (msg: string, ctx?: Record<string, unknown>) => emit('warn', namespace, msg, ctx),
    error: (msg: string, ctx?: Record<string, unknown>) => emit('error', namespace, msg, ctx),
  };
}

export type Logger = ReturnType<typeof createLogger>;
