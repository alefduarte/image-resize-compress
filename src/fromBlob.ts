import type { LegacyFormat, ResizeOptions } from './types';
import { InvalidImageError } from './errors';
import { resolveFromBlobArgs, type NormalizedOptions } from './options';
import { assertBrowserEnv, decode } from './decode';
import { processBitmap } from './pipeline';

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
function fromBlob(blob: Blob | File, options?: ResizeOptions): Promise<Blob>;
/**
 * @deprecated Use the options-object signature `fromBlob(blob, options)`.
 * The positional signature will be removed in v4.
 */
function fromBlob(
  blob: Blob | File,
  quality?: number,
  width?: number | 'auto',
  height?: number | 'auto',
  format?: LegacyFormat | null,
  backgroundColor?: string | null,
): Promise<Blob>;
async function fromBlob(
  blob: Blob | File,
  arg2?: ResizeOptions | number,
  arg3?: number | 'auto',
  arg4?: number | 'auto',
  arg5?: LegacyFormat | null,
  arg6?: string | null,
): Promise<Blob> {
  assertBrowserEnv();
  const opts = resolveFromBlobArgs(arg2, arg3, arg4, arg5, arg6);
  return processBlob(blob, opts);
}

export default fromBlob;
