import type { ImageFormat } from './types';

/**
 * The single, self-contained resize→encode pipeline, shared verbatim by the
 * main thread (`pipeline.ts` calls it) AND the Web Worker (`worker-host.ts`
 * stringifies it and passes it into the worker — see `worker-entry.ts`).
 *
 * ── Why self-contained (bundling pattern, required by spec 08) ────────────
 * The worker is built as `(${workerEntry})(${runPipeline})`: `workerEntry`
 * receives this function *by value* as an argument. That makes embedding robust
 * against tsup/esbuild minification — there is no cross-module identifier for
 * the minifier to rename out from under us, unlike composing several
 * `fn.toString()` fragments (arrow-const exports lose their binding name, and
 * mutual references depend on fragile name-consistency). The only requirement is
 * that THIS function reference nothing outside its own scope: every helper is
 * nested, every constant inlined, and it touches only globals available in both
 * window and worker (`OffscreenCanvas`, `document`, `Image` sources are passed
 * in). Because it is shared, the resize/encode logic exists once — no
 * duplication, so the bundle stays within budget.
 *
 * It throws plain `Error`s carrying a typed `.name` (never the `errors.ts`
 * classes, which are not embeddable). Both callers rehydrate the name back into
 * the real class via `rehydrate` so `instanceof` works identically on both
 * paths; `cause` does not survive that boundary — documented on `rehydrate`.
 */

/** ResizeOptions that survive structured clone into the worker (no `signal`/`worker`). */
export interface SerializableOptions {
  quality?: number;
  width?: number | 'auto';
  height?: number | 'auto';
  maxWidthOrHeight?: number;
  format?: ImageFormat;
  backgroundColor?: string;
  targetSize?: number;
  /**
   * Resolved output mime type. Derived on the main thread (`pipeline.ts`) or the
   * host (`worker-host.ts`) via `mime.ts` — kept OUT of this self-contained
   * function so the (already-bundled) mime maps aren't duplicated here.
   */
  mime?: string;
}

export async function runPipeline(
  source: CanvasImageSource,
  nw: number,
  nh: number,
  o: SerializableOptions,
  isAborted?: () => boolean,
): Promise<Blob> {
  const MAX = 268435456; // 16 384² — mirrors geometry.ts MAX_PIXELS.
  const fail = (name: string, message: string): Error => {
    const e = new Error(message);
    e.name = name;
    return e;
  };
  const abortCheck = (): void => {
    if (isAborted && isAborted()) throw fail('AbortError', 'aborted');
  };
  const round = (n: number): number => Math.max(1, Math.round(n));
  const tooLarge = (w: number, h: number): void => {
    if (w * h > MAX) throw fail('ImageTooLargeError', 'Image too large');
  };
  const resolveSize = (): [number, number] => {
    const m = o.maxWidthOrHeight;
    if (m !== undefined) {
      const longest = Math.max(nw, nh);
      if (longest <= m) return [round(nw), round(nh)];
      const s = m / longest;
      return [round(nw * s), round(nh * s)];
    }
    const w = o.width;
    const h = o.height;
    const autoW = w === undefined || w === 'auto';
    const autoH = h === undefined || h === 'auto';
    if (!autoW && !autoH) return [round(w), round(h)];
    if (!autoW) return [round(w), round(nh * (w / nw))];
    if (!autoH) return [round(nw * (h / nh)), round(h)];
    return [round(nw), round(nh)];
  };
  const encodeChecked = async (
    canvas: HTMLCanvasElement | OffscreenCanvas,
    mime: string,
    quality?: number,
  ): Promise<Blob> => {
    const blob = await ('convertToBlob' in canvas
      ? canvas.convertToBlob({ type: mime, quality })
      : new Promise<Blob>((resolve, reject) => {
          canvas.toBlob(
            (b) =>
              b ? resolve(b) : reject(fail('InvalidImageError', 'No blob')),
            mime,
            quality,
          );
        }));
    if (blob.type !== mime) {
      throw fail('UnsupportedFormatError', 'Unsupported output');
    }
    return blob;
  };

  abortCheck();
  tooLarge(nw, nh);
  const [tw, th] = resolveSize();
  tooLarge(tw, th);

  // The browser-environment guard runs at the public entry (assertBrowserEnv);
  // by here a canvas backend always exists (worker: OffscreenCanvas; main: one
  // of the two).
  let canvas: HTMLCanvasElement | OffscreenCanvas;
  if (typeof OffscreenCanvas === 'function') {
    canvas = new OffscreenCanvas(tw, th);
  } else {
    canvas = document.createElement('canvas');
    canvas.width = tw;
    canvas.height = th;
  }
  const ctx = (canvas as HTMLCanvasElement).getContext('2d');
  if (!ctx) throw fail('InvalidImageError', 'No 2D context');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  if (o.backgroundColor) {
    ctx.fillStyle = o.backgroundColor;
    ctx.fillRect(0, 0, tw, th);
  }
  ctx.drawImage(source, 0, 0, tw, th);

  const mime = o.mime ?? 'image/png';
  const q = o.quality;
  const target = o.targetSize;
  if (target === undefined) {
    abortCheck();
    return encodeChecked(canvas, mime, q === undefined ? undefined : q / 100);
  }
  if (mime === 'image/png')
    throw fail('RangeError', 'targetSize requires jpeg/webp output');

  let lo = 1;
  let hi = Math.min(q ?? 92, 100);
  let best: Blob | null = null;
  let smallest: Blob | null = null;
  for (let i = 0; i < 8; i += 1) {
    abortCheck();
    const qq = (lo + hi) / 2;
    const b = await encodeChecked(canvas, mime, qq / 100);
    if (!smallest || b.size < smallest.size) smallest = b;
    if (b.size <= target) {
      best = b;
      lo = qq;
    } else {
      hi = qq;
    }
    if (hi - lo <= 1) break;
  }
  return best ?? (smallest as Blob);
}
