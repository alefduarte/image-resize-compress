/**
 * Encodable output formats. `bmp` and `gif` were removed in v3 because no major
 * browser can encode them via `canvas.toBlob`/`convertToBlob` — v2 silently
 * produced mislabeled PNGs. See spec 02.
 */
export type ImageFormat = 'png' | 'jpeg' | 'webp';

/**
 * Formats accepted by the deprecated positional (legacy) API. `bmp`/`gif` are
 * accepted for signature compatibility but now throw `UnsupportedFormatError`.
 */
export type LegacyFormat = ImageFormat | 'bmp' | 'gif';

export interface ResizeOptions {
  /** 0–100. Only applies to jpeg/webp. Omit to use the encoder default. */
  quality?: number;
  /** Target width in px, or 'auto' (default) to derive from height/original. */
  width?: number | 'auto';
  /** Target height in px, or 'auto' (default) to derive from width/original. */
  height?: number | 'auto';
  /** Cap the longest edge; aspect ratio preserved. Mutually exclusive with width/height. */
  maxWidthOrHeight?: number;
  /** Output format. Default: input format (falls back to png if input not encodable). */
  format?: ImageFormat;
  /** Flatten transparency onto this CSS color (any output format). */
  backgroundColor?: string;
  /**
   * Target output size in bytes. When set, quality is binary-searched (jpeg/webp)
   * to produce a blob ≤ targetSize. `quality` becomes the upper bound if also set.
   * Best-effort: resolves with the smallest achievable blob if the target is
   * unreachable. Requires a jpeg or webp output format.
   */
  targetSize?: number;
  /** Abort decode/encode/iteration. Rejects with DOMException 'AbortError'. */
  signal?: AbortSignal;
  /**
   * Process off the main thread (OffscreenCanvas worker); silent fallback.
   * Reserved for spec 08 — currently accepted and ignored (main-thread path).
   */
  worker?: boolean;
}

export interface FromURLOptions extends ResizeOptions {
  /** Passed to `fetch()` (headers, credentials, etc.). `signal` is shared with the resize options. */
  fetchOptions?: RequestInit;
}

export interface Size {
  width: number;
  height: number;
}
