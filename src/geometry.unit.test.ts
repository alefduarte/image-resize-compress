import { describe, expect, it } from 'vitest';
import { MAX_PIXELS, resolveSize } from './geometry';

describe('resolveSize', () => {
  const natural = { width: 800, height: 600 };

  it('auto/auto returns the natural size (rounded ints)', () => {
    expect(resolveSize(natural, { width: 'auto', height: 'auto' })).toEqual({
      width: 800,
      height: 600,
    });
  });

  it('width only derives height from aspect ratio', () => {
    expect(resolveSize(natural, { width: 200, height: 'auto' })).toEqual({
      width: 200,
      height: 150,
    });
  });

  it('height only derives width from aspect ratio', () => {
    expect(resolveSize(natural, { width: 'auto', height: 300 })).toEqual({
      width: 400,
      height: 300,
    });
  });

  it('explicit width and height are used verbatim (no aspect lock)', () => {
    expect(resolveSize(natural, { width: 123, height: 456 })).toEqual({
      width: 123,
      height: 456,
    });
  });

  it('rounds fractional derived dimensions to integers', () => {
    // 100x33 → width 50 → height 33 * 50/100 = 16.5 → 17
    expect(
      resolveSize({ width: 100, height: 33 }, { width: 50, height: 'auto' }),
    ).toEqual({
      width: 50,
      height: 17,
    });
  });

  it('floors dimensions at 1x1 (never zero)', () => {
    expect(
      resolveSize({ width: 10, height: 10 }, { width: 0.2, height: 'auto' }),
    ).toEqual({
      width: 1,
      height: 1,
    });
  });

  describe('maxWidthOrHeight', () => {
    it('scales down by the longest edge (width dominant)', () => {
      expect(
        resolveSize(
          { width: 400, height: 200 },
          { width: 'auto', height: 'auto', maxWidthOrHeight: 100 },
        ),
      ).toEqual({
        width: 100,
        height: 50,
      });
    });

    it('scales down by the longest edge (height dominant, 200x400 → 50x100)', () => {
      expect(
        resolveSize(
          { width: 200, height: 400 },
          { width: 'auto', height: 'auto', maxWidthOrHeight: 100 },
        ),
      ).toEqual({
        width: 50,
        height: 100,
      });
    });

    it('is a no-op when the image already fits (never upscales)', () => {
      expect(
        resolveSize(
          { width: 80, height: 40 },
          { width: 'auto', height: 'auto', maxWidthOrHeight: 100 },
        ),
      ).toEqual({
        width: 80,
        height: 40,
      });
    });

    it('is a no-op at exactly the cap', () => {
      expect(
        resolveSize(
          { width: 100, height: 60 },
          { width: 'auto', height: 'auto', maxWidthOrHeight: 100 },
        ),
      ).toEqual({
        width: 100,
        height: 60,
      });
    });
  });

  it('exposes the pixel safety limit (16384²)', () => {
    expect(MAX_PIXELS).toBe(16_384 * 16_384);
  });
});
