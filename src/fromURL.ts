import fromBlob from './fromBlob';
import { ImageFormat } from './types';

/**
 * Compress, resize, or convert an image from a URL.
 *
 * @param {string} url The image URL.
 * @param {number} [quality=100] Image quality for conversion.
 * @param {(number | 'auto')} [width='auto'] Desired image width. If `'auto'`, calculates based on height scale.
 * @param {(number | 'auto')} [height='auto'] Desired image height. If `'auto'`, calculates based on width scale.
 * @param {ImageFormat} [format] Desired image format [png, webp, bmp, jpeg].
 * @param {RequestInit} [options] Fetch options for the URL.
 * @returns {Promise<Blob>} Promise resolving to the processed image blob.
 */
const fromURL = async (
  url: string,
  quality: number = 100,
  width: number | 'auto' = 'auto',
  height: number | 'auto' = 'auto',
  format?: ImageFormat,
  options?: RequestInit,
): Promise<Blob> => {
  try {
    const response = await fetch(url, options);
    if (!response.ok)
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    const blob = await response.blob();
    return await fromBlob(blob, quality, width, height, format);
  } catch (error) {
    throw new Error(
      `Failed to process the image from URL. Check CORS or network issues. Error: ${error}`,
    );
  }
};

export default fromURL;
