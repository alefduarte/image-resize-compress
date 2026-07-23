import type { FromURLOptions } from './types';
import { InvalidImageError } from './errors';
import { normalizeOptions } from './options';
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
async function fromURL(url: string, options?: FromURLOptions): Promise<Blob> {
  assertBrowserEnv();

  const { fetchOptions, ...rest } = options ?? {};
  const resize = normalizeOptions(rest);
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
