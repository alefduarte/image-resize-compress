import { EnvironmentError, rehydrate } from './errors';
import { runPipeline } from './core';
import { resolveOutputMime } from './mime';
import type { DecodedImage } from './decode';
import type { NormalizedOptions } from './options';

/** Either canvas surface the pipeline may produce. */
export type AnyCanvas = HTMLCanvasElement | OffscreenCanvas;

/**
 * The canvas creation abstraction. Uses `OffscreenCanvas` when available
 * (also the worker path in spec 08), otherwise an `HTMLCanvasElement`.
 *
 * The production resize path lives in the self-contained {@link runPipeline}
 * (which inlines this same logic so it stays embeddable in the worker); this
 * export is retained as the documented single abstraction and is exercised by
 * the Node-tier environment guard test.
 */
export const makeCanvas = (width: number, height: number): AnyCanvas => {
  if (typeof OffscreenCanvas === 'function') {
    return new OffscreenCanvas(width, height);
  }
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }
  throw new EnvironmentError(
    'image-resize-compress requires a browser environment',
  );
};

/** Options accepted by {@link processBitmap} — resize options plus the source mime type. */
export interface PipelineOptions extends NormalizedOptions {
  inputType?: string;
}

/**
 * Resize + encode a decoded image on the main thread. Delegates to the shared
 * self-contained {@link runPipeline} and rehydrates its name-tagged errors into
 * the typed `errors.ts` classes.
 */
export const processBitmap = async (
  decoded: DecodedImage,
  opts: PipelineOptions,
): Promise<Blob> => {
  const { signal } = opts;
  try {
    return await runPipeline(
      decoded.source,
      decoded.width,
      decoded.height,
      { ...opts, mime: resolveOutputMime(opts.format, opts.inputType) },
      signal ? () => signal.aborted : undefined,
    );
  } catch (err) {
    throw rehydrate(err);
  }
};
