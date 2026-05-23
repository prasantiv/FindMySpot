/**
 * Client-side logger. Loud in dev, silent in production. Replace with a hosted
 * RUM SDK later without touching the call sites.
 */
const isDev = import.meta.env.DEV;

function format(level: string, msg: string, ctx?: Record<string, unknown>) {
  if (!isDev) return; // No-op in prod; we don't want PII in browser logs.
  // eslint-disable-next-line no-console
  console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](
    `[${level}] ${msg}`,
    ctx ?? '',
  );
}

export const logger = {
  debug: (msg: string, ctx?: Record<string, unknown>) => format('debug', msg, ctx),
  info: (msg: string, ctx?: Record<string, unknown>) => format('info', msg, ctx),
  warn: (msg: string, ctx?: Record<string, unknown>) => format('warn', msg, ctx),
  error: (msg: string, ctx?: Record<string, unknown>) => format('error', msg, ctx),
};
