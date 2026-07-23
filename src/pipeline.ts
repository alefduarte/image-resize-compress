import { rehydrate } from './errors';
import { runPipeline } from './core';
import { resolveOutputMime } from './mime';
import type { DecodedImage } from './decode';
import type { NormalizedOptions } from './options';

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
