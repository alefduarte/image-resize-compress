import { describe, expect, it } from 'vitest';
import * as api from './index';
import {
  EnvironmentError,
  FetchError,
  ImageProcessError,
  ImageTooLargeError,
  InvalidImageError,
  UnsupportedFormatError,
} from './errors';

describe('public API surface (index.ts)', () => {
  it('exports the four functions', () => {
    expect(typeof api.fromBlob).toBe('function');
    expect(typeof api.fromURL).toBe('function');
    expect(typeof api.blobToURL).toBe('function');
    expect(typeof api.urlToBlob).toBe('function');
  });

  it('re-exports the typed error classes', () => {
    expect(api.ImageProcessError).toBe(ImageProcessError);
    expect(api.InvalidImageError).toBe(InvalidImageError);
    expect(api.UnsupportedFormatError).toBe(UnsupportedFormatError);
    expect(api.ImageTooLargeError).toBe(ImageTooLargeError);
    expect(api.FetchError).toBe(FetchError);
    expect(api.EnvironmentError).toBe(EnvironmentError);
  });
});
