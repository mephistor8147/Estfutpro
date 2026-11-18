export interface PreparedUploadImage {
  dataUrl: string;
  base64: string;
  mimeType: string;
  width: number;
  height: number;
}

const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.86;

function readFileAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Não foi possível ler o arquivo de imagem.'));
      }
    };
    reader.onerror = () => reject(new Error('Erro ao ler o arquivo de imagem.'));
    reader.readAsDataURL(blob);
  });
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Formato de imagem não suportado pelo navegador.'));
    img.src = src;
  });
}

function extractBase64FromDataUrl(dataUrl: string, fallbackMime: string): {
  base64: string;
  mimeType: string;
} {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (match) {
    return { mimeType: match[1], base64: match[2] };
  }
  return { mimeType: fallbackMime || 'image/jpeg', base64: dataUrl };
}

/**
 * Compresses and scales an uploaded betting slip image proportionally so OCR
 * remains crisp while staying safely below serverless request size limits.
 */
export async function prepareBetSlipImageForUpload(
  file: Blob
): Promise<PreparedUploadImage> {
  if (!file.type.startsWith('image/') && file.type !== '') {
    throw new Error('Selecione um arquivo de imagem válido (PNG, JPG ou WebP).');
  }
  if (file.size > 15 * 1024 * 1024) {
    throw new Error('A imagem excede o limite de 15 MB. Tente um print ou foto menor.');
  }

  const rawDataUrl = await readFileAsDataUrl(file);

  try {
    const img = await loadImageElement(rawDataUrl);
    const origW = img.naturalWidth || img.width;
    const origH = img.naturalHeight || img.height;

    if (!origW || !origH) {
      const parsed = extractBase64FromDataUrl(rawDataUrl, file.type);
      return {
        dataUrl: rawDataUrl,
        base64: parsed.base64,
        mimeType: parsed.mimeType,
        width: 0,
        height: 0,
      };
    }

    const scale = Math.min(1, MAX_DIMENSION / Math.max(origW, origH));
    const targetW = Math.max(1, Math.round(origW * scale));
    const targetH = Math.max(1, Math.round(origH * scale));

    // Keep small PNG screenshots uncompressed if already compact (< 1.2MB)
    if (scale === 1 && file.size < 1_200_000 && (file.type === 'image/png' || file.type === 'image/webp')) {
      const parsed = extractBase64FromDataUrl(rawDataUrl, file.type);
      return {
        dataUrl: rawDataUrl,
        base64: parsed.base64,
        mimeType: parsed.mimeType,
        width: origW,
        height: origH,
      };
    }

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      const parsed = extractBase64FromDataUrl(rawDataUrl, file.type);
      return {
        dataUrl: rawDataUrl,
        base64: parsed.base64,
        mimeType: parsed.mimeType,
        width: origW,
        height: origH,
      };
    }

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, targetW, targetH);
    ctx.drawImage(img, 0, 0, targetW, targetH);

    const compressedDataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
    const parsed = extractBase64FromDataUrl(compressedDataUrl, 'image/jpeg');
    return {
      dataUrl: compressedDataUrl,
      base64: parsed.base64,
      mimeType: parsed.mimeType,
      width: targetW,
      height: targetH,
    };
  } catch {
    // Fallback to raw data URL if browser canvas cannot decode format
    const parsed = extractBase64FromDataUrl(rawDataUrl, file.type || 'image/jpeg');
    return {
      dataUrl: rawDataUrl,
      base64: parsed.base64,
      mimeType: parsed.mimeType,
      width: 0,
      height: 0,
    };
  }
}
