import type {
  ImageFormat,
  LegacyFormat,
  ResizeOptions,
  FromURLOptions,
} from './types';
import { UnsupportedFormatError } from './errors';
import { TARGET_SIZE_PNG, unsupportedFormatMessage } from './mime';

/**
 * PURE module: option normalization, validation, and legacy-argument mapping.
 * Must not touch `document`, `window`, `fetch`, or any DOM type at runtime.
 * (`AbortSignal` appears only in type positions; `console` is a host global,
 * not a DOM type.)
 */

/** Internal, fully-resolved options consumed by the pipeline. */
export interface NormalizedOptions {
  /** Quality on a 0–100 scale, or `undefined` for the encoder default. */
  quality?: number;
  width: number | 'auto';
  height: number | 'auto';
  maxWidthOrHeight?: number;
  format?: ImageFormat;
  backgroundColor?: string;
  targetSize?: number;
  signal?: AbortSignal;
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
    format,
    backgroundColor,
    targetSize,
    signal,
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
    format,
    backgroundColor: backgroundColor ?? undefined,
    targetSize,
    signal,
    worker: worker ?? false,
  };
};

let deprecationWarned = false;

const warnDeprecated = (): void => {
  if (deprecationWarned) return;
  deprecationWarned = true;
  console.warn(
    'image-resize-compress: Positional arguments are deprecated; pass an options object.',
  );
};

/** Map a legacy positional `quality` (v2 dual-scale) onto the 0–100 scale. */
const mapLegacyQuality = (quality: number | undefined): number | undefined => {
  if (quality === undefined) return undefined;
  if (
    typeof quality !== 'number' ||
    !Number.isFinite(quality) ||
    quality <= 0
  ) {
    throw new RangeError('quality must be > 0');
  }
  // v2 semantics: `q < 1` was already a 0–1 fraction; otherwise it was 0–100.
  // Clamp to 100 so a legacy `quality > 100` stays lenient (v2 never threw).
  return Math.min(quality < 1 ? quality * 100 : quality, 100);
};

/** Map a legacy positional dimension: v2 treated `0` as 'auto'. */
const mapLegacyDimension = (
  value: number | 'auto' | undefined,
): number | 'auto' | undefined => (value === 0 ? 'auto' : value);

/** Map a legacy positional `format` onto {@link ImageFormat}, throwing for bmp/gif. */
const mapLegacyFormat = (
  format: LegacyFormat | null | undefined,
): ImageFormat | undefined => {
  if (format === null || format === undefined) return undefined;
  if (format === 'bmp' || format === 'gif') {
    throw new UnsupportedFormatError(unsupportedFormatMessage(format));
  }
  return format;
};

const isOptionsArg = (arg: unknown): arg is ResizeOptions =>
  typeof arg === 'object' && arg !== null;

/**
 * Resolve `fromBlob` arguments from either the new options-object signature or
 * the deprecated positional signature. Emits a one-time deprecation warning for
 * the legacy path.
 */
const isLegacyCall = (
  arg2: unknown,
  arg3: unknown,
  arg4: unknown,
  arg5: unknown,
  arg6: unknown,
): boolean =>
  typeof arg2 === 'number' ||
  arg3 !== undefined ||
  arg4 !== undefined ||
  arg5 !== undefined ||
  arg6 !== undefined;

/** Map the shared legacy positional args (quality/width/height/format) into ResizeOptions. */
const mapLegacyResize = (
  arg2: number | object | undefined,
  arg3: number | 'auto' | undefined,
  arg4: number | 'auto' | undefined,
  arg5: LegacyFormat | null | undefined,
): ResizeOptions => {
  warnDeprecated();
  return {
    quality: mapLegacyQuality(typeof arg2 === 'number' ? arg2 : undefined),
    width: mapLegacyDimension(arg3),
    height: mapLegacyDimension(arg4),
    format: mapLegacyFormat(arg5),
  };
};

export const resolveFromBlobArgs = (
  arg2?: ResizeOptions | number,
  arg3?: number | 'auto',
  arg4?: number | 'auto',
  arg5?: LegacyFormat | null,
  arg6?: string | null,
): NormalizedOptions => {
  if (!isLegacyCall(arg2, arg3, arg4, arg5, arg6)) {
    return normalizeOptions(isOptionsArg(arg2) ? arg2 : undefined);
  }
  return normalizeOptions({
    ...mapLegacyResize(arg2, arg3, arg4, arg5),
    backgroundColor: arg6 ?? undefined,
  });
};

/**
 * Resolve `fromURL` arguments from either the new options-object signature or
 * the deprecated positional signature `(url, quality, width, height, format,
 * fetchOptions)`. Returns normalized resize options plus fetch options.
 */
export const resolveFromURLArgs = (
  arg2?: FromURLOptions | number,
  arg3?: number | 'auto',
  arg4?: number | 'auto',
  arg5?: LegacyFormat | null,
  arg6?: RequestInit,
): { resize: NormalizedOptions; fetchOptions?: RequestInit } => {
  if (!isLegacyCall(arg2, arg3, arg4, arg5, arg6)) {
    const options = isOptionsArg(arg2) ? arg2 : {};
    const { fetchOptions, ...resize } = options;
    return { resize: normalizeOptions(resize), fetchOptions };
  }
  return {
    resize: normalizeOptions(mapLegacyResize(arg2, arg3, arg4, arg5)),
    fetchOptions: arg6,
  };
};
