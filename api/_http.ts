import type { IncomingMessage, ServerResponse } from 'http';

export interface VercelReq extends IncomingMessage {
  body?: unknown;
  query?: Record<string, string | string[]>;
}

export interface VercelRes extends ServerResponse {
  status?: (code: number) => VercelRes;
  json?: (data: unknown) => void;
}

export function sendJson(res: VercelRes, statusCode: number, data: unknown): void {
  if (typeof res.status === 'function') {
    const statusRes = res.status(statusCode);
    if (typeof statusRes?.json === 'function') {
      statusRes.json(data);
      return;
    }
  }
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}

export async function readJsonBody<T = Record<string, unknown>>(req: VercelReq): Promise<T> {
  if (req.body && typeof req.body === 'object') {
    return req.body as T;
  }
  if (typeof req.body === 'string' && req.body.trim()) {
    return JSON.parse(req.body) as T;
  }
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return {} as T;
  return JSON.parse(raw) as T;
}
