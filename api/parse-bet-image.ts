import { parseBetSlipImageService, resolveApiError } from '../src/lib/analyzeService.js';
import { readJsonBody, sendJson, type VercelReq, type VercelRes } from './_http.js';

export default async function handler(req: VercelReq, res: VercelRes) {
  if (req.method === 'OPTIONS') {
    sendJson(res, 204, {});
    return;
  }
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method Not Allowed' });
    return;
  }

  try {
    const body = await readJsonBody<{
      imageBase64?: string;
      mimeType?: string;
      ocrText?: string;
    }>(req);

    const imageBase64 = String(body?.imageBase64 || '').trim();
    const ocrText =
      typeof body?.ocrText === 'string' ? body.ocrText.trim() : undefined;

    if (!imageBase64 && !ocrText) {
      sendJson(res, 400, { error: 'Envie uma imagem do bilhete de aposta.' });
      return;
    }

    const parsed = await parseBetSlipImageService({
      imageBase64: imageBase64 || undefined,
      mimeType: typeof body?.mimeType === 'string' ? body.mimeType : undefined,
      ocrText,
    });

    res.setHeader('Cache-Control', 'no-store');
    sendJson(res, 200, parsed);
  } catch (error: any) {
    if (error?.message === 'INVALID_IMAGE_TYPE') {
      sendJson(res, 400, {
        error: 'Formato de imagem não suportado. Use PNG, JPG ou WebP.',
      });
      return;
    }
    if (error?.message === 'IMAGE_TOO_LARGE') {
      sendJson(res, 413, {
        error: 'Imagem muito grande. Envie um arquivo menor ou print recortado.',
      });
      return;
    }
    const { status, message } = resolveApiError(
      error,
      'Não foi possível ler os dados do bilhete na imagem agora. Tente novamente ou preencha manualmente.'
    );
    console.error('Error parsing bet slip image:', error?.message || error);
    sendJson(res, status, { error: message });
  }
}
