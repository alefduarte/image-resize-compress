import { describe, expect, it } from 'vitest';
import { UnsupportedFormatError } from './errors';
import { normalizeOptions } from './options';

describe('normalizeOptions — defaults', () => {
  it('applies auto dimensions and worker=false by default', () => {
    expect(normalizeOptions()).toEqual({
      quality: undefined,
      width: 'auto',
      height: 'auto',
      maxWidthOrHeight: undefined,
      format: undefined,
      backgroundColor: undefined,
      targetSize: undefined,
      signal: undefined,
      worker: false,
    });
  });

  it('passes through valid values', () => {
    const out = normalizeOptions({
      quality: 80,
      width: 200,
      height: 'auto',
      format: 'webp',
      backgroundColor: '#f00',
      worker: true,
    });
    expect(out).toMatchObject({
      quality: 80,
      width: 200,
      height: 'auto',
      format: 'webp',
      backgroundColor: '#f00',
      worker: true,
    });
  });
});

describe('normalizeOptions — validation rows (spec 01 table)', () => {
  it.each([0, -1, 101, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects quality %p with RangeError',
    (q) => {
      expect(() => normalizeOptions({ quality: q })).toThrow(RangeError);
      expect(() => normalizeOptions({ quality: q })).toThrow(
        'quality must be a number in (0, 100]',
      );
    },
  );

  it('rejects a non-number quality', () => {
    // @ts-expect-error intentional bad input
    expect(() => normalizeOptions({ quality: '80' })).toThrow(RangeError);
  });

  it('accepts quality at the (0,100] bounds', () => {
    expect(normalizeOptions({ quality: 100 }).quality).toBe(100);
    expect(normalizeOptions({ quality: 0.5 }).quality).toBe(0.5);
  });

  it.each([0, -5, Number.NaN])('rejects width %p', (w) => {
    expect(() => normalizeOptions({ width: w })).toThrow(
      "width must be 'auto' or a number > 0",
    );
  });

  it.each([0, -5, Number.NaN])('rejects height %p', (h) => {
    expect(() => normalizeOptions({ height: h })).toThrow(
      "height must be 'auto' or a number > 0",
    );
  });

  it('rejects maxWidthOrHeight <= 0 / non-finite', () => {
    expect(() => normalizeOptions({ maxWidthOrHeight: 0 })).toThrow(
      'maxWidthOrHeight must be a number > 0',
    );
    expect(() => normalizeOptions({ maxWidthOrHeight: Number.NaN })).toThrow(
      'maxWidthOrHeight must be a number > 0',
    );
  });

  it('rejects maxWidthOrHeight combined with an explicit width or height', () => {
    expect(() =>
      normalizeOptions({ maxWidthOrHeight: 100, width: 200 }),
    ).toThrow('maxWidthOrHeight cannot be combined with width/height');
    expect(() =>
      normalizeOptions({ maxWidthOrHeight: 100, height: 200 }),
    ).toThrow('maxWidthOrHeight cannot be combined with width/height');
  });

  it('allows maxWidthOrHeight with explicit auto dimensions', () => {
    expect(
      normalizeOptions({
        maxWidthOrHeight: 100,
        width: 'auto',
        height: 'auto',
      }),
    ).toMatchObject({
      maxWidthOrHeight: 100,
    });
  });

  it('rejects an unknown format with UnsupportedFormatError', () => {
    // @ts-expect-error intentional bad input
    expect(() => normalizeOptions({ format: 'bmp' })).toThrow(
      UnsupportedFormatError,
    );
    // @ts-expect-error intentional bad input
    expect(() => normalizeOptions({ format: 'tiff' })).toThrow(
      "Unsupported format 'tiff'",
    );
  });

  it('rejects targetSize <= 0 / non-finite with RangeError', () => {
    expect(() => normalizeOptions({ targetSize: 0 })).toThrow(
      'targetSize must be a number of bytes > 0',
    );
    expect(() => normalizeOptions({ targetSize: Number.NaN })).toThrow(
      'targetSize must be a number of bytes > 0',
    );
  });

  it('rejects targetSize with png output', () => {
    expect(() => normalizeOptions({ targetSize: 1000, format: 'png' })).toThrow(
      'targetSize requires jpeg/webp output',
    );
  });

  it('allows targetSize with jpeg/webp', () => {
    expect(
      normalizeOptions({ targetSize: 1000, format: 'jpeg' }).targetSize,
    ).toBe(1000);
  });

  it('rejects a non-boolean worker with TypeError', () => {
    // @ts-expect-error intentional bad input
    expect(() => normalizeOptions({ worker: 'yes' })).toThrow(TypeError);
    // @ts-expect-error intentional bad input
    expect(() => normalizeOptions({ worker: 'yes' })).toThrow(
      'worker must be a boolean',
    );
  });
});
