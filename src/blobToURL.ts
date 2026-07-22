import { InvalidImageError } from './errors';

/**
 * Convert a File or Blob to a data URL.
 *
 * @param blob The blob or file to convert.
 * @returns A promise resolving to a data URL string.
 */
const blobToURL = (blob: Blob | File): Promise<string> => {
  if (!(blob instanceof Blob)) {
    return Promise.reject(new TypeError('Expected a Blob or File'));
  }
  if (blob.size === 0) {
    return Promise.reject(new InvalidImageError('Image is empty (0 bytes)'));
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
