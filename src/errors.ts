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

export class ImageProcessError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
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
  new FetchError(`Fetch failed for ${url}: ${response.status} ${response.statusText}`, {
    status: response.status,
  });

/** `true` when the value is an abort-related error that must pass through untouched. */
export const isAbortError = (err: unknown): boolean =>
  err instanceof DOMException && err.name === 'AbortError';

/** Throw an `AbortError` if the signal is already aborted. */
export const throwIfAborted = (signal?: AbortSignal): void => {
  if (signal?.aborted) throw new DOMException('The operation was aborted.', 'AbortError');
};
