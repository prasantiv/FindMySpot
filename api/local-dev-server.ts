import 'dotenv/config';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import geocodeHandler from './geocode.js';
import parkingHandler from './parking.js';
import detectSignHandler from './detect-sign.js';

type QueryValue = string | string[];
type Query = Record<string, QueryValue>;

type HandlerReq = {
  method: string;
  query: Query;
  body: unknown;
  headers: IncomingMessage['headers'];
};

type HandlerRes = {
  status(code: number): HandlerRes;
  setHeader(name: string, value: number | string | readonly string[]): HandlerRes;
  send(payload: unknown): void;
  json(payload: unknown): void;
};

type RouteHandler = (req: HandlerReq, res: HandlerRes) => Promise<void> | void;

const PORT = Number(process.env.API_PORT ?? 3000);

const routes: Record<string, RouteHandler> = {
  '/api/geocode': geocodeHandler as unknown as RouteHandler,
  '/api/parking': parkingHandler as unknown as RouteHandler,
  '/api/detect-sign': detectSignHandler as unknown as RouteHandler,
};

function toQuery(url: URL): Query {
  const query: Query = {};
  for (const [key, value] of url.searchParams.entries()) {
    const current = query[key];
    if (current == null) {
      query[key] = value;
    } else if (Array.isArray(current)) {
      current.push(value);
    } else {
      query[key] = [current, value];
    }
  }
  return query;
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  if (chunks.length === 0) return undefined;

  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw.trim()) return undefined;

  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function createResponse(res: ServerResponse): HandlerRes {
  let statusCode = 200;

  const apiRes: HandlerRes = {
    status(code: number) {
      statusCode = code;
      return apiRes;
    },
    setHeader(name: string, value: number | string | readonly string[]) {
      res.setHeader(name, value);
      return apiRes;
    },
    send(payload: unknown) {
      if (res.writableEnded) return;
      res.statusCode = statusCode;

      if (typeof payload === 'string' || payload instanceof Uint8Array) {
        res.end(payload);
        return;
      }

      if (!res.hasHeader('content-type')) {
        res.setHeader('content-type', 'application/json');
      }
      res.end(JSON.stringify(payload));
    },
    json(payload: unknown) {
      if (!res.hasHeader('content-type')) {
        res.setHeader('content-type', 'application/json');
      }
      apiRes.send(payload);
    },
  };

  return apiRes;
}

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(payload));
}

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? `localhost:${PORT}`}`);
  const handler = routes[url.pathname];

  if (!handler) {
    sendJson(res, 404, {
      error: {
        code: 'not_found',
        message: `No route for ${url.pathname}`,
      },
    });
    return;
  }

  const body = await readBody(req);

  const handlerReq: HandlerReq = {
    method: req.method ?? 'GET',
    query: toQuery(url),
    body,
    headers: req.headers,
  };

  const handlerRes = createResponse(res);

  try {
    await handler(handlerReq, handlerRes);
  } catch (err) {
    console.error(
      JSON.stringify({
        level: 'error',
        ts: new Date().toISOString(),
        ns: 'api:local-server',
        msg: 'unhandled_exception',
        ctx: { err: (err as Error).message, path: url.pathname },
      }),
    );

    if (!res.writableEnded) {
      sendJson(res, 500, {
        error: {
          code: 'internal_error',
          message: 'Unexpected local server error.',
        },
      });
    }
  }
}).listen(PORT, () => {
  console.log(
    JSON.stringify({
      level: 'info',
      ts: new Date().toISOString(),
      ns: 'api:local-server',
      msg: 'listening',
      ctx: { port: PORT },
    }),
  );
});
