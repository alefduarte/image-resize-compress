import { UnsupportedFormatError, InvalidImageError, throwIfAborted } from './errors';
import { formatToMime, normalizeMime, TARGET_SIZE_PNG } from './mime';
import type { ImageFormat } from './types';

/** Either canvas surface the pipeline may produce. */
export type AnyCanvas = HTMLCanvasElement | OffscreenCanvas;

export interface EncodeOptions {
  /** Explicitly requested output format, or `undefined` to derive from the input. */
  format?: ImageFormat;
  /** Mime type of the source blob, used to derive the output format when `format` is omitted. */
  inputType?: string;
  /** Quality on a 0–100 scale, or `undefined` for the encoder default. */
  quality?: number;
  /** Best-effort maximum output size in bytes (jpeg/webp only). */
  targetSize?: number;
  signal?: AbortSignal;
}

const MAX_TARGET_SIZE_ITERATIONS = 8;

/** Low-level canvas → blob, transparently handling OffscreenCanvas and HTMLCanvasElement. */
const canvasToBlob = (canvas: AnyCanvas, mime: string, quality?: number): Promise<Blob> => {
  if ('convertToBlob' in canvas) {
    return canvas.convertToBlob({ type: mime, quality });
  }
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new InvalidImageError('Canvas produced no blob'))),
      mime,
      quality,
    );
  });
};

/**
 * Encode and verify the format capability. `canvas.toBlob`/`convertToBlob`
 * silently fall back to `image/png` for unsupported types; we detect the
 * mismatch and throw instead of returning a mislabeled blob.
 */
const encodeChecked = async (canvas: AnyCanvas, mime: string, quality?: number): Promise<Blob> => {
  const blob = await canvasToBlob(canvas, mime, quality);
  if (blob.type !== mime) {
    throw new UnsupportedFormatError(
      `Encoder does not support '${mime}' (got '${blob.type || 'unknown'}')`,
    );
  }
  return blob;
};

/** Resolve the output mime type from the requested format or the input type. */
const resolveOutputMime = (opts: EncodeOptions): string => {
  if (opts.format) return formatToMime(opts.format);
  return normalizeMime(opts.inputType) ?? 'image/png';
};

/**
 * Encode a drawn canvas to a blob. When `targetSize` is set, binary-searches
 * quality (jpeg/webp only) over at most 8 encodes. Returns the encoder's blob
 * as-is — never re-wraps it.
 */
export const encode = async (canvas: AnyCanvas, opts: EncodeOptions): Promise<Blob> => {
  const mime = resolveOutputMime(opts);
  const { signal, quality, targetSize } = opts;

  if (targetSize === undefined) {
    throwIfAborted(signal);
    return encodeChecked(canvas, mime, quality === undefined ? undefined : quality / 100);
  }

  if (mime === 'image/png') {
    throw new RangeError(TARGET_SIZE_PNG);
  }

  // Binary search over quality (0–100 scale), max 8 encodes.
  let lo = 1;
  let hi = Math.min(quality ?? 92, 100);
  let best: Blob | null = null;
  let smallest: Blob | null = null;

  for (let i = 0; i < MAX_TARGET_SIZE_ITERATIONS; i += 1) {
    throwIfAborted(signal);
    const q = (lo + hi) / 2;
    const blob = await encodeChecked(canvas, mime, q / 100);
    if (!smallest || blob.size < smallest.size) smallest = blob;
    if (blob.size <= targetSize) {
      best = blob;
      lo = q; // try higher quality
    } else {
      hi = q;
    }
    if (hi - lo <= 1) break;
  }

  // `smallest` is always set after the loop (at least one encode ran).
  return best ?? (smallest as Blob);
};
