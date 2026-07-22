import { describe, expect, it } from 'vitest';
import {
  TARGET_SIZE_PNG,
  formatToMime,
  isImageMime,
  normalizeMime,
  unsupportedFormatMessage,
} from './mime';

describe('formatToMime', () => {
  it('maps each format to its canonical mime', () => {
    expect(formatToMime('png')).toBe('image/png');
    expect(formatToMime('jpeg')).toBe('image/jpeg');
    expect(formatToMime('webp')).toBe('image/webp');
  });
});

describe('normalizeMime', () => {
  it('returns the canonical mime for encodable types', () => {
    expect(normalizeMime('image/png')).toBe('image/png');
    expect(normalizeMime('image/jpeg')).toBe('image/jpeg');
    expect(normalizeMime('image/webp')).toBe('image/webp');
  });

  it('normalizes the image/jpg alias to image/jpeg', () => {
    expect(normalizeMime('image/jpg')).toBe('image/jpeg');
  });

  it('is case-insensitive', () => {
    expect(normalizeMime('IMAGE/PNG')).toBe('image/png');
  });

  it('returns undefined for non-encodable or missing types', () => {
    expect(normalizeMime('image/gif')).toBeUndefined();
    expect(normalizeMime('image/bmp')).toBeUndefined();
    expect(normalizeMime('text/plain')).toBeUndefined();
    expect(normalizeMime(undefined)).toBeUndefined();
    expect(normalizeMime('')).toBeUndefined();
  });
});

describe('isImageMime', () => {
  it('is true for any image/* type', () => {
    expect(isImageMime('image/png')).toBe(true);
    expect(isImageMime('image/gif')).toBe(true);
    expect(isImageMime('IMAGE/AVIF')).toBe(true);
  });

  it('is false for non-image or missing types', () => {
    expect(isImageMime('text/html')).toBe(false);
    expect(isImageMime('text/html; charset=utf-8')).toBe(false);
    expect(isImageMime('')).toBe(false);
    expect(isImageMime(undefined)).toBe(false);
  });
});

describe('shared messages', () => {
  it('unsupportedFormatMessage names the offending format', () => {
    expect(unsupportedFormatMessage('bmp')).toBe(
      "Unsupported format 'bmp'; use png, jpeg, or webp",
    );
  });

  it('exports the png/targetSize message', () => {
    expect(TARGET_SIZE_PNG).toBe('targetSize requires jpeg/webp output');
  });
});
