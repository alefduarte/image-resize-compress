import type { ImageFormat } from './types';

/**
 * PURE module: format ↔ mime maps and encodability checks. Must not touch
 * `document`, `window`, `fetch`, or any DOM type at runtime.
 */

const FORMAT_TO_MIME: Record<ImageFormat, string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};

const ENCODABLE_MIMES = new Set<string>(Object.values(FORMAT_TO_MIME));

/** Map an {@link ImageFormat} to its canonical mime type. */
export const formatToMime = (format: ImageFormat): string =>
  FORMAT_TO_MIME[format];

/**
 * Normalize a mime type to a canonical encodable form, or `undefined` if it is
 * not an encodable image type. Handles the common `image/jpg` alias.
 */
export const normalizeMime = (mime: string | undefined): string | undefined => {
  if (!mime) return undefined;
  const lower = mime.toLowerCase();
  const canonical = lower === 'image/jpg' ? 'image/jpeg' : lower;
  return ENCODABLE_MIMES.has(canonical) ? canonical : undefined;
};

/**
 * Resolve the output mime type from the requested format, else the input type,
 * else png. Called on the main thread / worker host (never inside the
 * self-contained `core.ts` pipeline) so these maps live in the bundle once.
 */
export const resolveOutputMime = (
  format: ImageFormat | undefined,
  inputType: string | undefined,
): string =>
  format ? formatToMime(format) : (normalizeMime(inputType) ?? 'image/png');

/** `true` if the mime type looks like an image (`image/*`). */
export const isImageMime = (mime: string | undefined): boolean =>
  typeof mime === 'string' && mime.toLowerCase().startsWith('image/');

/** Shared error message text (deduplicated across modules to save bundle size). */
export const unsupportedFormatMessage = (format: string): string =>
  `Unsupported format '${format}'; use png, jpeg, or webp`;

export const TARGET_SIZE_PNG = 'targetSize requires jpeg/webp output';
