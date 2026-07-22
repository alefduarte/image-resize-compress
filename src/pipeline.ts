import {
  EnvironmentError,
  ImageTooLargeError,
  InvalidImageError,
  throwIfAborted,
} from './errors';
import { MAX_PIXELS, resolveSize } from './geometry';
import { encode, type AnyCanvas } from './encode';
import type { DecodedImage } from './decode';
import type { NormalizedOptions } from './options';

/**
 * The canvas creation abstraction. Uses `OffscreenCanvas` when available
 * (also the worker path in spec 08), otherwise an `HTMLCanvasElement`. This is
 * the ONLY place a canvas is created — no direct `document.createElement('canvas')`
 * calls exist elsewhere.
 */
export const makeCanvas = (width: number, height: number): AnyCanvas => {
  if (typeof OffscreenCanvas === 'function') {
    return new OffscreenCanvas(width, height);
  }
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }
  throw new EnvironmentError(
    'image-resize-compress requires a browser environment',
  );
};

/** Options accepted by {@link processBitmap} — resize options plus the source mime type. */
export interface PipelineOptions extends NormalizedOptions {
  inputType?: string;
}

const assertPixelLimit = (width: number, height: number): void => {
  if (width * height > MAX_PIXELS) {
    throw new ImageTooLargeError(
      `Image too large (${width}×${height}); exceeds ${MAX_PIXELS}px`,
    );
  }
};

/**
 * Resize + encode a decoded image. Enforces the pixel-count safety limit before
 * any canvas is allocated, applies optional background flattening, and uses
 * high-quality smoothing. Structured so spec 08's worker can call it directly.
 */
export const processBitmap = async (
  decoded: DecodedImage,
  opts: PipelineOptions,
): Promise<Blob> => {
  const { signal } = opts;
  throwIfAborted(signal);

  const natural = { width: decoded.width, height: decoded.height };
  assertPixelLimit(natural.width, natural.height);

  const target = resolveSize(natural, opts);
  assertPixelLimit(target.width, target.height);

  const canvas = makeCanvas(target.width, target.height);
  // Cast to HTMLCanvasElement for typing; OffscreenCanvas's 2D context shares
  // every member used below (fillStyle, fillRect, drawImage, smoothing).
  const ctx = (canvas as HTMLCanvasElement).getContext('2d');
  if (!ctx) {
    throw new InvalidImageError('No 2D canvas context');
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  if (opts.backgroundColor) {
    ctx.fillStyle = opts.backgroundColor;
    ctx.fillRect(0, 0, target.width, target.height);
  }

  ctx.drawImage(decoded.source, 0, 0, target.width, target.height);

  return encode(canvas, {
    format: opts.format,
    inputType: opts.inputType,
    quality: opts.quality,
    targetSize: opts.targetSize,
    signal,
  });
};
