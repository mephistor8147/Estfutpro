export interface LocalOcrResult {
  text: string;
  confidence: number;
}

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Não foi possível decodificar a imagem para OCR.'));
    img.src = src;
  });
}

/**
 * Prepares a high-contrast grayscale bitmap for Tesseract OCR.
 * Automatically detects dark-theme betting apps (Bet365, Betano dark mode, Superbet, etc.)
 * and inverts them to crisp dark text on white background.
 */
async function preprocessImageForOcr(dataUrl: string): Promise<string> {
  try {
    const img = await loadImg(dataUrl);
    const origW = img.naturalWidth || img.width;
    const origH = img.naturalHeight || img.height;
    if (!origW || !origH) return dataUrl;

    // Scale small screenshots up slightly for sharper glyph recognition, cap large ones
    let scale = 1;
    if (origW < 1000) {
      scale = Math.min(2, 1200 / origW);
    } else if (Math.max(origW, origH) > 1800) {
      scale = 1800 / Math.max(origW, origH);
    }

    const w = Math.max(1, Math.round(origW * scale));
    const h = Math.max(1, Math.round(origH * scale));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return dataUrl;

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);

    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;

    // Estimate average luminance to detect dark-mode sportsbook screenshots
    let lumSum = 0;
    const sampleStep = 16;
    let samples = 0;
    for (let i = 0; i < data.length; i += 4 * sampleStep) {
      lumSum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      samples += 1;
    }
    const isDarkTheme = samples > 0 && lumSum / samples < 125;

    // Convert to grayscale + auto-invert dark theme + boost contrast
    const contrast = 1.35;
    for (let i = 0; i < data.length; i += 4) {
      let gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      if (isDarkTheme) {
        gray = 255 - gray;
      }
      gray = (gray - 128) * contrast + 128;
      const clamped = gray < 0 ? 0 : gray > 255 ? 255 : gray;
      data[i] = clamped;
      data[i + 1] = clamped;
      data[i + 2] = clamped;
      data[i + 3] = 255;
    }

    ctx.putImageData(imgData, 0, 0);
    return canvas.toDataURL('image/png');
  } catch {
    return dataUrl;
  }
}

/**
 * Runs real client-side OCR using Tesseract.js (Portuguese) directly in the browser.
 * Dynamically imported so it adds zero bytes to the initial application bundle.
 */
export async function extractTextFromBetSlipImage(
  dataUrl: string,
  onProgress?: (pct: number) => void
): Promise<LocalOcrResult> {
  onProgress?.(5);
  const processedUrl = await preprocessImageForOcr(dataUrl);
  onProgress?.(15);

  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('por', 1, {
    logger: (msg: { status?: string; progress?: number }) => {
      if (msg.status === 'recognizing text' && typeof msg.progress === 'number') {
        onProgress?.(Math.min(98, Math.round(25 + msg.progress * 73)));
      }
    },
  });

  try {
    const result = await worker.recognize(processedUrl);
    onProgress?.(100);
    return {
      text: result?.data?.text || '',
      confidence: typeof result?.data?.confidence === 'number' ? result.data.confidence : 0,
    };
  } finally {
    await worker.terminate();
  }
}
