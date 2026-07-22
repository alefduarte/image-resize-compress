import { assertBrowserEnv } from './decode';
import { InvalidImageError } from './errors';

/**
 * Convert a File or Blob to a data URL.
 *
 * @param blob The blob or file to convert.
 * @returns A promise resolving to a data URL string.
 */
const blobToURL = async (blob: Blob | File): Promise<string> => {
  // FileReader is browser-only; fail fast with EnvironmentError in SSR/Node
  // instead of a cryptic ReferenceError. `async` turns each throw into a
  // rejection, so no per-check Promise.reject wrapper is needed.
  assertBrowserEnv();
  if (!(blob instanceof Blob)) {
    throw new TypeError('Expected a Blob or File');
  }
  if (blob.size === 0) {
    throw new InvalidImageError('Image is empty (0 bytes)');
  }

  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new InvalidImageError('Failed to read blob'));
    };
    reader.onerror = () =>
      reject(
        new InvalidImageError('Failed to read blob', { cause: reader.error }),
      );
    reader.readAsDataURL(blob);
  });
};

export default blobToURL;
