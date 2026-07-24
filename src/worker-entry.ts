import type { runPipeline } from './core';

/**
 * Self-contained Web Worker entry (spec 08).
 *
 * ── Bundling pattern & why (required by spec) ─────────────────────────────
 * The host builds the worker as `(${workerEntry})(${runPipeline})`. This
 * function is stringified via `String(workerEntry)` and receives the shared
 * pipeline as its `run` argument — the pipeline is likewise stringified and
 * passed inline as a function expression. Passing it BY VALUE is what makes the
 * embedding robust against tsup/esbuild minification: there is no cross-module
 * identifier for the minifier to rename, so no `.toString()` name-consistency to
 * depend on (the fragile part the spec warns about). `workerEntry` references
 * only its `run` argument, worker globals (`self`, `createImageBitmap`), and
 * literals — never a module symbol — so its minified body evals cleanly inside
 * the Worker.
 *
 * The shared pipeline throws plain `Error`s carrying a typed `.name`; on decode
 * failure we do the same. The host rehydrates `{ name, message }` into the real
 * typed classes so `instanceof` works identically on both paths (`cause` is
 * lost across the boundary — documented on the host).
 *
 * Abort: handled entirely host-side. The host rejects the caller with
 * `AbortError` and removes the id from its pending map, so any (late) worker
 * response for that id is dropped — the correctness guarantee needs no
 * worker-side state. We deliberately omit a worker-side aborted-set (a pure
 * CPU-saving optimisation) to stay within the size budget.
 *
 * NOTE: excluded from coverage (see vitest.config.ts) — its body only ever runs
 * inside a Worker, on a stringified copy the page-context instrumenter never
 * sees.
 */
export function workerEntry(run: typeof runPipeline): void {
  interface Scope {
    onmessage: ((e: MessageEvent) => void) | null;
    postMessage(message: unknown): void;
  }
  const scope = self as unknown as Scope;

  scope.onmessage = (e: MessageEvent): void => {
    const { id, blob, opts } = e.data;
    (async (): Promise<Blob> => {
      let bitmap: ImageBitmap;
      try {
        bitmap = await createImageBitmap(blob, {
          imageOrientation: 'from-image',
        });
      } catch {
        const err = new Error('Failed to decode image');
        err.name = 'InvalidImageError';
        throw err;
      }
      try {
        return await run(
          bitmap,
          bitmap.width,
          bitmap.height,
          opts,
          undefined,
          (p) => scope.postMessage({ id, progress: p }),
        );
      } finally {
        bitmap.close();
      }
    })().then(
      (blob) => scope.postMessage({ id, ok: true, blob }),
      (err: { name?: string; message?: string }) =>
        scope.postMessage({
          id,
          ok: false,
          error: {
            name: (err && err.name) || 'Error',
            message: (err && err.message) || '',
          },
        }),
    );
  };
}
