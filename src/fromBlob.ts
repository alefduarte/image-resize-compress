import { ImageFormat, Size } from './types';

/**
 * Returns the mime type given a string
 *
 * @param {ImageFormat} format - Image format [png, webp, bmp, jpeg, gif].
 * @returns {string} Returns mime type - defaults to 'image/jpeg' for unsupported formats.
 */
const getMimeType = (format: ImageFormat): string => {
  const mimeTypes: Record<ImageFormat, string> = {
    png: 'image/png',
    webp: 'image/webp',
    bmp: 'image/bmp',
    gif: 'image/gif',
    jpeg: 'image/jpeg',
  };
  return mimeTypes[format] || 'image/jpeg';
};

/**
 * Get the width and height of an image based on desired dimensions.
 *
 * @param {HTMLImageElement} img - The image element for reference.
 * @param {(number | 'auto')} [width='auto'] - Desired width. Auto-calculated if set to `'auto'` or `0`.
 * @param {(number | 'auto')} [height='auto'] - Desired height. Auto-calculated if set to `'auto'` or `0`.
 * @returns {Size} The calculated width and height.
 */
const getHeightWidth = (
  img: HTMLImageElement,
  width: number | 'auto' = 'auto',
  height: number | 'auto' = 'auto',
): Size => {
  const isWidthAuto = width === 'auto' || width === 0;
  const isHeightAuto = height === 'auto' || height === 0;

  if (!isWidthAuto && !isHeightAuto) {
    return { width: img.naturalWidth, height: img.naturalHeight };
  }

  if (!isWidthAuto) {
    const ratio = img.naturalWidth / width;
    return {
      width,
      height:
        Math.round((img.naturalHeight / ratio + Number.EPSILON) * 100) / 100,
    };
  }

  if (!isHeightAuto) {
    const ratio = img.naturalHeight / height;
    return {
      width:
        Math.round((img.naturalWidth / ratio + Number.EPSILON) * 100) / 100,
      height,
    };
  }

  return { width: img.naturalWidth, height: img.naturalHeight };
};

/**
 * Compress, resize, or convert an image Blob/File.
 *
 * @param {Blob | File} imgBlob The image blob to manipulate.
 * @param {number} [quality=100] The image quality for JPEG/PNG (0-100).
 * @param {number | 'auto'} [width='auto] The desired width (`'auto'` for original).
 * @param {number | 'auto'} [height='auto] The desired height (`'auto'` for original).
 * @param {ImageFormat | null} [format=null] The desired image format (defaults to original format).
 * @param {string | null} [backgroundColor=null] Background color for PNG images (e.g., "#FFFFFF").
 * @returns {Promise<Blob>} A promise resolving to the processed image Blob.
 */
const fromBlob = async (
  imgBlob: Blob | File,
  quality: number = 100,
  width: number | 'auto' = 'auto',
  height: number | 'auto' = 'auto',
  format: ImageFormat | null = null,
  backgroundColor: string | null = null,
): Promise<Blob> => {
  if (!(imgBlob instanceof Blob)) {
    throw new TypeError(`Expected a Blob or File, but got ${typeof imgBlob}.`);
  }

  if (imgBlob.size === 0) {
    throw new Error(
      'Failed to load the image. The file might be corrupt or empty.',
    );
  }

  if (quality <= 0) {
    throw new RangeError('Quality must be greater than 0.');
  }

  if (
    (typeof width === 'number' && width < 0) ||
    (typeof height === 'number' && height < 0)
  ) {
    throw new RangeError('Invalid width or height value!');
  }

  const mimeType = format ? getMimeType(format) : imgBlob.type;
  const imgQuality = quality < 1 ? quality : quality / 100;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const img = new Image();
      img.src = reader.result as string;

      img.onload = () => {
        const canvas = document.createElement('canvas');
        const size = getHeightWidth(img, width, height);
        canvas.width = size.width;
        canvas.height = size.height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context.'));
          return;
        }

        if (backgroundColor && mimeType === 'image/png') {
          ctx.fillStyle = backgroundColor;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        canvas.toBlob(
          (blob) => {
            if (blob === null) {
              return reject(new Error('Failed to generate image blob.'));
            }
            resolve(
              new Blob([blob], {
                type: mimeType,
              }),
            );
          },
          mimeType,
          imgQuality,
        );
      };

      img.onerror = () => {
        reject(
          new Error(
            'Failed to load the image. The file might be corrupt or empty.',
          ),
        );
      };
    };

    reader.onerror = () =>
      reject(new Error('Failed to read the blob as a Data URL.'));
    reader.readAsDataURL(imgBlob);
  });
};

export default fromBlob;
