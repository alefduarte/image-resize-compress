import type { Size } from './types';

/**
 * PURE module: dimension math. Must not touch `document`, `window`, `fetch`,
 * or any DOM type at runtime.
 */

/**
 * Maximum allowed pixel count (16 384 × 16 384), aligned with common canvas
 * caps. Guards against decompression-bomb tab crashes.
 */
export const MAX_PIXELS = 268_435_456;

interface SizeOptions {
  width: number | 'auto';
  height: number | 'auto';
  maxWidthOrHeight?: number;
}

const round = (n: number): number => Math.max(1, Math.round(n));

/**
 * Resolve target dimensions from the natural size and the requested options.
 * Always returns positive integers (min 1×1). Never upscales for
 * `maxWidthOrHeight` — it only caps the longest edge.
 */
export const resolveSize = (natural: Size, opts: SizeOptions): Size => {
  const { width, height, maxWidthOrHeight } = opts;

  if (maxWidthOrHeight !== undefined) {
    const longest = Math.max(natural.width, natural.height);
    if (longest <= maxWidthOrHeight) {
      return { width: round(natural.width), height: round(natural.height) };
    }
    const scale = maxWidthOrHeight / longest;
    return {
      width: round(natural.width * scale),
      height: round(natural.height * scale),
    };
  }

  const autoW = width === 'auto';
  const autoH = height === 'auto';

  if (!autoW && !autoH) {
    return { width: round(width), height: round(height) };
  }
  if (!autoW) {
    return {
      width: round(width),
      height: round(natural.height * (width / natural.width)),
    };
  }
  if (!autoH) {
    return {
      width: round(natural.width * (height / natural.height)),
      height: round(height),
    };
  }
  return { width: round(natural.width), height: round(natural.height) };
};
