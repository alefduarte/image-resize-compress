import type { ResizeOptions } from './types';
import { InvalidImageError, throwIfAborted } from './errors';
import { normalizeOptions, type NormalizedOptions } from './options';
import { assertBrowserEnv, decode } from './decode';
import { processBitmap } from './pipeline';
import { runInWorker } from './worker-host';

/**
 * Internal entry point shared with {@link fromURL}: takes an already-normalized
 * options object so the deprecation warning fires at most once per public call.
 */
export const processBlob = async (
  blob: Blob | File,
  opts: NormalizedOptions,
): Promise<Blob> => {
  if (!(blob instanceof Blob)) {
    throw new TypeError('Expected a Blob or File');
  }
  if (blob.size === 0) {
    throw new InvalidImageError('Image is empty (0 bytes)');
  }

  // A pre-aborted signal must reject before any worker involvement.
  throwIfAborted(opts.signal);

  // Opt-in worker path (spec 08). Returns null when the worker is unavailable,
  // so we transparently fall back to the main-thread pipeline below — a genuine
  // processing error rejects instead of falling back.
  if (opts.worker) {
    const viaWorker = runInWorker(blob, opts);
    if (viaWorker) return viaWorker;
  }

  const decoded = await decode(blob, opts.signal);
  try {
    return await processBitmap(decoded, { ...opts, inputType: blob.type });
  } finally {
    decoded.close();
  }
};

/**
 * Compress, resize, or convert an image Blob/File.
 *
 * @param blob The image blob to process.
 * @param options Resize/compress/convert options. See {@link ResizeOptions}.
 * @returns A promise resolving to the processed image blob.
 */
async function fromBlob(
  blob: Blob | File,
  options?: ResizeOptions,
): Promise<Blob> {
  assertBrowserEnv();
  return processBlob(blob, normalizeOptions(options));
}

export default fromBlob;
