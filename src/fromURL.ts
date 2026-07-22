import type { FromURLOptions, LegacyFormat } from './types';
import { InvalidImageError } from './errors';
import { resolveFromURLArgs } from './options';
import { isImageMime } from './mime';
import { assertBrowserEnv } from './decode';
import { processBlob } from './fromBlob';
import { fetchImage } from './urlToBlob';

/**
 * Compress, resize, or convert an image fetched from a URL.
 *
 * @param url The image URL.
 * @param options Resize options plus `fetchOptions`. See {@link FromURLOptions}.
 * @returns A promise resolving to the processed image blob.
 */
function fromURL(url: string, options?: FromURLOptions): Promise<Blob>;
/**
 * @deprecated Use the options-object signature `fromURL(url, options)`.
 * The positional signature will be removed in v4.
 */
function fromURL(
  url: string,
  quality?: number,
  width?: number | 'auto',
  height?: number | 'auto',
  format?: LegacyFormat | null,
  fetchOptions?: RequestInit,
): Promise<Blob>;
async function fromURL(
  url: string,
  arg2?: FromURLOptions | number,
  arg3?: number | 'auto',
  arg4?: number | 'auto',
  arg5?: LegacyFormat | null,
  arg6?: RequestInit,
): Promise<Blob> {
  assertBrowserEnv();

  const { resize, fetchOptions } = resolveFromURLArgs(
    arg2,
    arg3,
    arg4,
    arg5,
    arg6,
  );
  const signal = resize.signal ?? fetchOptions?.signal ?? undefined;

  const response = await fetchImage(url, { ...fetchOptions, signal });
  const blob = await response.blob();

  // A 200 HTML error page should fail clearly, not as a cryptic decode error.
  // Empty/generic types fall through to decode(), which throws InvalidImageError.
  if (blob.type && !isImageMime(blob.type)) {
    throw new InvalidImageError(
      `URL did not return an image (got ${blob.type})`,
    );
  }

  return processBlob(blob, { ...resize, signal });
}

export default fromURL;
