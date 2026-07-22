import { describe, expect, it } from 'vitest';
import {
  EnvironmentError,
  FetchError,
  ImageProcessError,
  ImageTooLargeError,
  InvalidImageError,
  UnsupportedFormatError,
  httpError,
  isAbortError,
  networkError,
  throwIfAborted,
} from './errors';

describe('error classes', () => {
  const cases: Array<[new (m: string) => ImageProcessError, string]> = [
    [InvalidImageError, 'InvalidImageError'],
    [UnsupportedFormatError, 'UnsupportedFormatError'],
    [ImageTooLargeError, 'ImageTooLargeError'],
    [EnvironmentError, 'EnvironmentError'],
  ];

  it.each(cases)('%o has correct instanceof chain and name', (Ctor, name) => {
    const err = new Ctor('boom');
    expect(err).toBeInstanceOf(Ctor);
    expect(err).toBeInstanceOf(ImageProcessError);
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe(name);
    expect(err.message).toBe('boom');
  });

  it('base ImageProcessError carries its own name', () => {
    expect(new ImageProcessError('x').name).toBe('ImageProcessError');
  });

  it('propagates the cause option', () => {
    const cause = new Error('root');
    const err = new InvalidImageError('wrap', { cause });
    expect(err.cause).toBe(cause);
  });
});

describe('FetchError', () => {
  it('carries a status when provided', () => {
    const err = new FetchError('nope', { status: 404 });
    expect(err).toBeInstanceOf(ImageProcessError);
    expect(err.name).toBe('FetchError');
    expect(err.status).toBe(404);
  });

  it('status is undefined when omitted', () => {
    expect(new FetchError('nope').status).toBeUndefined();
  });
});

describe('error builders', () => {
  it('networkError mentions CORS and preserves the cause', () => {
    const cause = new TypeError('Failed to fetch');
    const err = networkError('https://x/y', cause);
    expect(err).toBeInstanceOf(FetchError);
    expect(err.message).toContain('network or CORS');
    expect(err.message).toContain('https://x/y');
    expect(err.cause).toBe(cause);
    expect(err.status).toBeUndefined();
  });

  it('httpError records the response status and does not mention CORS', () => {
    const res = new Response('nope', { status: 404, statusText: 'Not Found' });
    const err = httpError('https://x/y', res);
    expect(err.status).toBe(404);
    expect(err.message).toContain('404');
    expect(err.message).not.toMatch(/cors/i);
  });
});

describe('abort helpers', () => {
  it('isAbortError detects a DOMException AbortError only', () => {
    expect(isAbortError(new DOMException('aborted', 'AbortError'))).toBe(true);
    expect(isAbortError(new DOMException('other', 'NotFoundError'))).toBe(
      false,
    );
    expect(isAbortError(new Error('AbortError'))).toBe(false);
    expect(isAbortError('AbortError')).toBe(false);
  });

  it('throwIfAborted throws only when the signal is aborted', () => {
    expect(() => throwIfAborted(undefined)).not.toThrow();
    const ac = new AbortController();
    expect(() => throwIfAborted(ac.signal)).not.toThrow();
    ac.abort();
    try {
      throwIfAborted(ac.signal);
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(DOMException);
      expect((e as DOMException).name).toBe('AbortError');
    }
  });
});
