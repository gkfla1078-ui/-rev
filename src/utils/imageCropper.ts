/**
 * Crop an image from a data URL using normalized [ymin, xmin, ymax, xmax] (0~1000) coordinates.
 */
export async function cropImageWithBox(
  imageDataUrl: string,
  box: [number, number, number, number]
): Promise<{ croppedUrl: string; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const naturalWidth = img.naturalWidth || img.width;
        const naturalHeight = img.naturalHeight || img.height;

        const [ymin, xmin, ymax, xmax] = box;

        // Calculate actual pixel coordinates
        const cropX = Math.max(0, Math.floor((xmin * naturalWidth) / 1000));
        const cropY = Math.max(0, Math.floor((ymin * naturalHeight) / 1000));
        const cropW = Math.max(10, Math.floor(((xmax - xmin) * naturalWidth) / 1000));
        const cropH = Math.max(10, Math.floor(((ymax - ymin) * naturalHeight) / 1000));

        // Limit within boundary
        const safeW = Math.min(cropW, naturalWidth - cropX);
        const safeH = Math.min(cropH, naturalHeight - cropY);

        const canvas = document.createElement('canvas');
        canvas.width = safeW;
        canvas.height = safeH;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          throw new Error('Canvas 2D context not available');
        }

        // Enable high quality image smoothing
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        ctx.drawImage(
          img,
          cropX,
          cropY,
          safeW,
          safeH,
          0,
          0,
          safeW,
          safeH
        );

        // Always use lossless PNG format for cropped plates to preserve 100% crystal-clear resolution
        // for colonies, handwriting points (-1, -2), and test dates in both UI and Word reports
        const croppedUrl = canvas.toDataURL('image/png');

        resolve({ croppedUrl, width: safeW, height: safeH });
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error('Failed to load image for cropping'));
    img.src = imageDataUrl;
  });
}

/**
 * Read File as Data URL
 */
export function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/**
 * Get Image Dimensions
 */
export function getImageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth || img.width, height: img.naturalHeight || img.height });
    img.onerror = () => reject(new Error('Failed to read image dimensions'));
    img.src = dataUrl;
  });
}

/**
 * Optimize an image for AI analysis by scaling down to a max dimension (2400px)
 * while preserving aspect ratio and high resolution for small handwriting & dates.
 */
export async function optimizeImageForAnalysis(dataUrl: string, maxDim: number = 2400): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;

        if (w <= maxDim && h <= maxDim && dataUrl.length < 3500000) {
          // Already compact enough, keep original high quality
          resolve(dataUrl);
          return;
        }

        let newW = w;
        let newH = h;
        if (w > h && w > maxDim) {
          newW = maxDim;
          newH = Math.round((h * maxDim) / w);
        } else if (h > maxDim) {
          newH = maxDim;
          newW = Math.round((w * maxDim) / h);
        }

        const canvas = document.createElement('canvas');
        canvas.width = newW;
        canvas.height = newH;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, newW, newH);
        const optimized = canvas.toDataURL('image/jpeg', 0.95);
        resolve(optimized);
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}
