import {
  EnvironmentError,
  InvalidImageError,
  isAbortError,
  throwIfAborted,
} from './errors';

const DECODE_FAILED =
  'Failed to decode image; it may be corrupt or an unsupported format';

/** A decoded image ready to be drawn onto a canvas, plus its natural size. */
export interface DecodedImage {
  source: CanvasImageSource;
  width: number;
  height: number;
  /** Release resources: closes the ImageBitmap or revokes the object URL. */
  close(): void;
}

/**
 * SSR guard. Throws a single clear error instead of a cryptic
 * `document is not defined` when used outside a browser.
 */
export const assertBrowserEnv = (): void => {
  if (
    typeof document === 'undefined' &&
    typeof createImageBitmap === 'undefined'
  ) {
    throw new EnvironmentError(
      'image-resize-compress requires a browser environment',
    );
  }
};

const decodeViaBitmap = async (blob: Blob): Promise<DecodedImage> => {
  // `imageOrientation: 'from-image'` applies EXIF orientation for free.
  const bitmap = await createImageBitmap(blob, {
    imageOrientation: 'from-image',
  });
  return {
    source: bitmap,
    width: bitmap.width,
    height: bitmap.height,
    close: () => bitmap.close(),
  };
};

const decodeViaImage = async (blob: Blob): Promise<DecodedImage> => {
  const url = URL.createObjectURL(blob);
  const img = new Image();
  try {
    img.src = url;
    await img.decode();
  } catch (err) {
    URL.revokeObjectURL(url);
    throw new InvalidImageError(DECODE_FAILED, { cause: err });
  }
  return {
    source: img,
    width: img.naturalWidth,
    height: img.naturalHeight,
    // Keep the object URL alive until the caller has drawn the image.
    close: () => URL.revokeObjectURL(url),
  };
};

/**
 * Decode a blob into a drawable image. Prefers `createImageBitmap` (no base64,
 * off-main-thread decode, native EXIF orientation) and falls back to an object
 * URL + `HTMLImageElement`. Object URLs are always revoked.
 */
export const decode = async (
  blob: Blob,
  signal?: AbortSignal,
): Promise<DecodedImage> => {
  throwIfAborted(signal);

  if (typeof createImageBitmap === 'function') {
    try {
      return await decodeViaBitmap(blob);
    } catch (err) {
      if (isAbortError(err)) throw err;
      // Some browsers reject certain formats via createImageBitmap; try the
      // HTMLImageElement path before giving up.
      if (typeof document === 'undefined') {
        throw new InvalidImageError(DECODE_FAILED, { cause: err });
      }
    }
  }

  // Abort is re-checked at the top of processBitmap (inside the caller's
  // try/finally), so a post-decode abort still releases this resource.
  return decodeViaImage(blob);
};
