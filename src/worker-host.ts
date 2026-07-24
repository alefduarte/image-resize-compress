import { abortError, rehydrate } from './errors';
import { runPipeline, type SerializableOptions } from './core';
import { resolveOutputMime } from './mime';
import type { NormalizedOptions } from './options';
import { workerEntry } from './worker-entry';

/**
 * Main-thread host for the opt-in Web Worker path (spec 08).
 *
 * A single lazily-constructed worker (never terminated by the library) runs the
 * shared OffscreenCanvas pipeline off the main thread. Concurrent calls are
 * correlated by an incrementing `id` and a pending map. Any setup/transport
 * failure returns `null` so the caller falls back to the main-thread path —
 * `worker: true` must never reject where `worker: false` would resolve.
 */

interface WorkerResponse {
  id: number;
  ok?: boolean;
  blob?: Blob;
  error?: { name: string; message: string };
  /** Progress relay (0–100). Present on progress messages, absent on the result. */
  progress?: number;
}

interface Pending {
  resolve: (blob: Blob) => void;
  reject: (reason: unknown) => void;
  cleanup: () => void;
  onProgress?: (progress: number) => void;
}

const pending = new Map<number, Pending>();
let worker: Worker | null = null;
let failed = false;
let nextId = 1;

const onMessage = (e: MessageEvent<WorkerResponse>): void => {
  const data = e.data;
  const entry = pending.get(data.id);
  if (!entry) return; // Late result for an aborted/unknown id — drop it.
  if (data.progress !== undefined) {
    entry.onProgress?.(data.progress);
    return; // Progress relay: keep the entry pending for the eventual result.
  }
  pending.delete(data.id);
  entry.cleanup();
  if (data.ok && data.blob) entry.resolve(data.blob);
  else entry.reject(rehydrate(data.error));
};

/**
 * Lazily construct the singleton worker, or `null` when the worker path is
 * unavailable (missing globals, or `new Worker` throws under a strict CSP). The
 * failure is cached so we don't retry construction on every call.
 */
const getWorker = (): Worker | null => {
  if (worker) return worker;
  if (
    failed ||
    typeof Worker !== 'function' ||
    typeof OffscreenCanvas !== 'function' ||
    typeof createImageBitmap !== 'function'
  ) {
    failed = true;
    return null;
  }
  try {
    // Robust embedding: the shared pipeline is passed BY VALUE into the entry
    // (see worker-entry.ts) — no minified identifier to keep consistent.
    const url = URL.createObjectURL(
      new Blob([`(${workerEntry})(${runPipeline})`], {
        type: 'text/javascript',
      }),
    );
    const w = new Worker(url);
    URL.revokeObjectURL(url); // Fetch is already initiated; safe to revoke now.
    w.onmessage = onMessage;
    worker = w;
    return w;
  } catch {
    failed = true;
    return null;
  }
};

/**
 * Run the pipeline in the worker. Resolves with the processed blob, or `null`
 * when the worker path is unavailable (feature-detect / CSP) and the caller
 * should fall back to the main thread. A genuine processing error (undecodable
 * image, unsupported format) rejects instead. The posted payload is always
 * structured-clone-safe (the `AbortSignal` is stripped), so `postMessage` never
 * throws for our data.
 */
export const runInWorker = (
  blob: Blob,
  opts: NormalizedOptions,
): Promise<Blob> | null => {
  const w = getWorker();
  if (!w) return null;

  // Resolve the output mime here (main thread has `mime.ts`) and strip the
  // non-cloneable AbortSignal; every remaining field is structured-clone-safe.
  const { signal, onProgress } = opts;
  const serial: SerializableOptions = {
    ...opts,
    mime: resolveOutputMime(opts.format, blob.type),
  };
  // Neither survives structured clone: strip the AbortSignal and the onProgress
  // function. Abort and progress are both handled host-side.
  delete (serial as { signal?: AbortSignal }).signal;
  delete (serial as { onProgress?: unknown }).onProgress;

  return new Promise<Blob>((resolve, reject) => {
    const id = nextId++;
    let onAbort: (() => void) | undefined;
    const cleanup = (): void => {
      if (signal && onAbort) signal.removeEventListener('abort', onAbort);
    };
    if (signal) {
      onAbort = (): void => {
        if (!pending.has(id)) return;
        pending.delete(id);
        cleanup();
        // Correctness is host-side: reject now; any late worker result for this
        // id is dropped by onMessage (id no longer pending).
        reject(abortError());
      };
      signal.addEventListener('abort', onAbort);
    }
    pending.set(id, { resolve, reject, cleanup, onProgress });
    w.postMessage({ id, blob, opts: serial });
  });
};

/** Test-only: reset the singleton so feature detection / construction re-runs. */
export const __resetWorker = (): void => {
  if (worker) worker.terminate();
  worker = null;
  failed = false;
  pending.clear();
};

/** Test-only: current pending-request count (leak assertion). */
export const __pending = (): number => pending.size;
