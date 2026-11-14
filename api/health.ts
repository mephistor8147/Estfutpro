import { sendJson, type VercelReq, type VercelRes } from './_http.js';

export default function handler(req: VercelReq, res: VercelRes) {
  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'Method Not Allowed' });
    return;
  }
  sendJson(res, 200, { ok: true, runtime: 'vercel', timestamp: new Date().toISOString() });
}
