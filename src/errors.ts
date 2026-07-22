/**
 * Typed error classes. All extend {@link ImageProcessError} and carry a stable
 * `.name` (set on the prototype so it survives minification) for consumers that
 * branch on `instanceof` or on `error.name` (e.g. across a structured-clone
 * worker boundary where the prototype is lost).
 *
 * Programmer errors (bad arguments) use the built-in `TypeError`/`RangeError`.
 * Runtime/data errors use the classes below. `AbortError` (a `DOMException`)
 * always passes through untouched.
 */

// Native `class extends Error` (build target es2020) keeps the prototype chain
// intact, so `instanceof` works without the `Object.setPrototypeOf` hack and
// the inherited `Error(message, options)` constructor already forwards `cause`.
export class ImageProcessError extends Error {}
ImageProcessError.prototype.name = 'ImageProcessError';

/** Empty, corrupt, or otherwise undecodable image input. */
export class InvalidImageError extends ImageProcessError {}
InvalidImageError.prototype.name = 'InvalidImageError';

/** Requested output format is not encodable in this environment. */
export class UnsupportedFormatError extends ImageProcessError {}
UnsupportedFormatError.prototype.name = 'UnsupportedFormatError';

/** Source or target pixel count exceeds the safety limit (decompression bomb guard). */
export class ImageTooLargeError extends ImageProcessError {}
ImageTooLargeError.prototype.name = 'ImageTooLargeError';

/** Thrown when the library is used outside a browser environment. */
export class EnvironmentError extends ImageProcessError {}
EnvironmentError.prototype.name = 'EnvironmentError';

/** A `fetch` request failed (HTTP error, network, or CORS). */
export class FetchError extends ImageProcessError {
  /** HTTP status code, when the failure was an HTTP error response. */
  status?: number;
  constructor(message: string, options?: ErrorOptions & { status?: number }) {
    super(message, options);
    this.status = options?.status;
  }
}
FetchError.prototype.name = 'FetchError';

/** Build a {@link FetchError} for a network/CORS failure (fetch rejected). */
export const networkError = (url: string, cause: unknown): FetchError =>
  new FetchError(`Fetch failed for ${url} (network or CORS)`, { cause });

/** Build a {@link FetchError} for a non-ok HTTP response. */
export const httpError = (url: string, response: Response): FetchError =>
  new FetchError(`Fetch failed for ${url}: ${response.status}`, {
    status: response.status,
  });

// Keyed by each class's `.prototype.name` at lookup time — avoids repeating the
// name strings (which already live on the prototypes) as object keys.
const ERROR_CLASSES: Array<new (message: string) => ImageProcessError> = [
  InvalidImageError,
  UnsupportedFormatError,
  ImageTooLargeError,
  EnvironmentError,
  FetchError,
];

/**
 * Rehydrate an error that crossed a boundary as a plain `{ name, message }`
 * (the self-contained `core.ts` pipeline, or the worker's structured-clone
 * response) back into its real class so `instanceof` works identically on the
 * main-thread and worker paths. `cause` does NOT survive the boundary — it is
 * intentionally dropped.
 */
export const rehydrate = (err: unknown): Error => {
  const e = (err ?? {}) as { name?: string; message?: string };
  const name = e.name ?? '';
  const message = e.message ?? '';
  if (name === 'AbortError') return abortError();
  if (name === 'RangeError') return new RangeError(message);
  const C = ERROR_CLASSES.find((K) => K.prototype.name === name);
  return new (C ?? ImageProcessError)(message);
};

/** The canonical `AbortError` (a `DOMException`), shared across all abort paths. */
export const abortError = (): DOMException =>
  new DOMException('Aborted', 'AbortError');

/** `true` when the value is an abort-related error that must pass through untouched. */
export const isAbortError = (err: unknown): boolean =>
  err instanceof DOMException && err.name === 'AbortError';

/** Throw an `AbortError` if the signal is already aborted. */
export const throwIfAborted = (signal?: AbortSignal): void => {
  if (signal?.aborted) throw abortError();
};
