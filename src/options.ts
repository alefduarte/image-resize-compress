import type { ImageFormat, ResizeOptions } from './types';
import { UnsupportedFormatError } from './errors';
import { TARGET_SIZE_PNG, unsupportedFormatMessage } from './mime';

/**
 * PURE module: option normalization and validation. Must not touch `document`,
 * `window`, `fetch`, or any DOM type at runtime. (`AbortSignal` appears only in
 * type positions.)
 */

/** Internal, fully-resolved options consumed by the pipeline. */
export interface NormalizedOptions {
  /** Quality on a 0–100 scale, or `undefined` for the encoder default. */
  quality?: number;
  width: number | 'auto';
  height: number | 'auto';
  maxWidthOrHeight?: number;
  fit?: 'stretch' | 'cover';
  format?: ImageFormat;
  backgroundColor?: string;
  targetSize?: number;
  signal?: AbortSignal;
  onProgress?: (progress: number) => void;
  worker: boolean;
}

const VALID_FORMATS: ReadonlySet<string> = new Set(['png', 'jpeg', 'webp']);

const isFinitePositive = (n: unknown): n is number =>
  typeof n === 'number' && Number.isFinite(n) && n > 0;

const normalizeDimension = (
  value: number | 'auto' | undefined,
  name: string,
): number | 'auto' => {
  if (value === undefined || value === 'auto') return 'auto';
  if (!isFinitePositive(value)) {
    throw new RangeError(`${name} must be 'auto' or a number > 0`);
  }
  return value;
};

/** Validate and normalize a new-style options object (pure). */
export const normalizeOptions = (
  options: ResizeOptions = {},
): NormalizedOptions => {
  const {
    quality,
    width,
    height,
    maxWidthOrHeight,
    fit,
    format,
    backgroundColor,
    targetSize,
    signal,
    onProgress,
    worker,
  } = options;

  if (quality !== undefined) {
    if (
      typeof quality !== 'number' ||
      !Number.isFinite(quality) ||
      quality <= 0 ||
      quality > 100
    ) {
      throw new RangeError('quality must be a number in (0, 100]');
    }
  }

  const w = normalizeDimension(width, 'width');
  const h = normalizeDimension(height, 'height');

  if (maxWidthOrHeight !== undefined) {
    if (!isFinitePositive(maxWidthOrHeight)) {
      throw new RangeError('maxWidthOrHeight must be a number > 0');
    }
    if (typeof w === 'number' || typeof h === 'number') {
      throw new RangeError(
        'maxWidthOrHeight cannot be combined with width/height',
      );
    }
  }

  if (format !== undefined && !VALID_FORMATS.has(format)) {
    throw new UnsupportedFormatError(unsupportedFormatMessage(String(format)));
  }

  if (targetSize !== undefined) {
    if (!isFinitePositive(targetSize)) {
      throw new RangeError('targetSize must be a number of bytes > 0');
    }
    if (format === 'png') {
      throw new RangeError(TARGET_SIZE_PNG);
    }
  }

  if (worker !== undefined && typeof worker !== 'boolean') {
    throw new TypeError('worker must be a boolean');
  }

  return {
    quality,
    width: w,
    height: h,
    maxWidthOrHeight,
    fit,
    format,
    backgroundColor: backgroundColor ?? undefined,
    targetSize,
    signal,
    onProgress,
    worker: worker ?? false,
  };
};
