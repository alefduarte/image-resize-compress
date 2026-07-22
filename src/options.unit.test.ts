import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UnsupportedFormatError } from './errors';
import {
  normalizeOptions,
  resolveFromBlobArgs,
  resolveFromURLArgs,
} from './options';

// Silence (and observe) the deprecation warning emitted by the legacy paths.
let warnSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  warnSpy.mockRestore();
});

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
      expect(() => normalizeOptions({ quality: q })).toThrow('quality must be a number in (0, 100]');
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
    expect(() => normalizeOptions({ width: w })).toThrow("width must be 'auto' or a number > 0");
  });

  it.each([0, -5, Number.NaN])('rejects height %p', (h) => {
    expect(() => normalizeOptions({ height: h })).toThrow("height must be 'auto' or a number > 0");
  });

  it('rejects maxWidthOrHeight <= 0 / non-finite', () => {
    expect(() => normalizeOptions({ maxWidthOrHeight: 0 })).toThrow('maxWidthOrHeight must be a number > 0');
    expect(() => normalizeOptions({ maxWidthOrHeight: Number.NaN })).toThrow('maxWidthOrHeight must be a number > 0');
  });

  it('rejects maxWidthOrHeight combined with an explicit width or height', () => {
    expect(() => normalizeOptions({ maxWidthOrHeight: 100, width: 200 })).toThrow(
      'maxWidthOrHeight cannot be combined with width/height',
    );
    expect(() => normalizeOptions({ maxWidthOrHeight: 100, height: 200 })).toThrow(
      'maxWidthOrHeight cannot be combined with width/height',
    );
  });

  it('allows maxWidthOrHeight with explicit auto dimensions', () => {
    expect(normalizeOptions({ maxWidthOrHeight: 100, width: 'auto', height: 'auto' })).toMatchObject({
      maxWidthOrHeight: 100,
    });
  });

  it('rejects an unknown format with UnsupportedFormatError', () => {
    // @ts-expect-error intentional bad input
    expect(() => normalizeOptions({ format: 'bmp' })).toThrow(UnsupportedFormatError);
    // @ts-expect-error intentional bad input
    expect(() => normalizeOptions({ format: 'tiff' })).toThrow("Unsupported format 'tiff'");
  });

  it('rejects targetSize <= 0 / non-finite with RangeError', () => {
    expect(() => normalizeOptions({ targetSize: 0 })).toThrow('targetSize must be a number of bytes > 0');
    expect(() => normalizeOptions({ targetSize: Number.NaN })).toThrow('targetSize must be a number of bytes > 0');
  });

  it('rejects targetSize with png output', () => {
    expect(() => normalizeOptions({ targetSize: 1000, format: 'png' })).toThrow(
      'targetSize requires jpeg/webp output',
    );
  });

  it('allows targetSize with jpeg/webp', () => {
    expect(normalizeOptions({ targetSize: 1000, format: 'jpeg' }).targetSize).toBe(1000);
  });

  it('rejects a non-boolean worker with TypeError', () => {
    // @ts-expect-error intentional bad input
    expect(() => normalizeOptions({ worker: 'yes' })).toThrow(TypeError);
    // @ts-expect-error intentional bad input
    expect(() => normalizeOptions({ worker: 'yes' })).toThrow('worker must be a boolean');
  });
});

describe('resolveFromBlobArgs — new vs legacy detection', () => {
  it('treats an options object as the new path (no warning)', () => {
    const out = resolveFromBlobArgs({ quality: 80, format: 'webp' });
    expect(out).toMatchObject({ quality: 80, format: 'webp' });
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('treats no args as the new path', () => {
    expect(resolveFromBlobArgs()).toMatchObject({ width: 'auto', height: 'auto' });
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('treats a numeric second arg as legacy', () => {
    const out = resolveFromBlobArgs(80, 100, 'auto', 'webp', '#fff');
    expect(out).toMatchObject({ quality: 80, width: 100, height: 'auto', format: 'webp', backgroundColor: '#fff' });
  });

  it('treats a later positional arg as legacy even when quality is omitted', () => {
    const out = resolveFromBlobArgs(undefined, 100);
    expect(out).toMatchObject({ quality: undefined, width: 100 });
  });
});

describe('legacy quality mapping (v2 dual-scale preserved)', () => {
  it.each([
    [0.5, 50],
    [0.1, 10],
    [1, 1],
    [80, 80],
    [150, 100], // clamp; v2 never threw on > 100
  ])('maps legacy quality %p → %p', (input, expected) => {
    expect(resolveFromBlobArgs(input).quality).toBe(expected);
  });

  it('rejects a legacy quality <= 0', () => {
    expect(() => resolveFromBlobArgs(0)).toThrow(RangeError);
    expect(() => resolveFromBlobArgs(-1, 100)).toThrow('quality must be > 0');
  });
});

describe('legacy dimension + format mapping', () => {
  it('maps legacy dimension 0 → auto (v2 semantics)', () => {
    const out = resolveFromBlobArgs(80, 0, 0);
    expect(out).toMatchObject({ width: 'auto', height: 'auto' });
  });

  it('keeps positive legacy dimensions', () => {
    expect(resolveFromBlobArgs(80, 320, 240)).toMatchObject({ width: 320, height: 240 });
  });

  it.each(['bmp', 'gif'] as const)('throws UnsupportedFormatError for legacy format %s', (fmt) => {
    expect(() => resolveFromBlobArgs(80, 'auto', 'auto', fmt)).toThrow(UnsupportedFormatError);
  });

  it('maps a null legacy format to undefined', () => {
    expect(resolveFromBlobArgs(80, 'auto', 'auto', null).format).toBeUndefined();
  });
});

describe('resolveFromURLArgs', () => {
  it('splits fetchOptions from resize options on the new path', () => {
    const fetchOptions = { headers: { accept: 'image/*' } };
    const { resize, fetchOptions: fo } = resolveFromURLArgs({ quality: 70, fetchOptions });
    expect(resize).toMatchObject({ quality: 70 });
    expect(fo).toBe(fetchOptions);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('returns empty options when called with nothing', () => {
    const { resize, fetchOptions } = resolveFromURLArgs();
    expect(resize).toMatchObject({ width: 'auto' });
    expect(fetchOptions).toBeUndefined();
  });

  it('maps legacy positional args, treating arg6 as fetchOptions', () => {
    const fetchOptions = { credentials: 'include' as const };
    const { resize, fetchOptions: fo } = resolveFromURLArgs(0.5, 200, 'auto', 'webp', fetchOptions);
    expect(resize).toMatchObject({ quality: 50, width: 200, format: 'webp' });
    expect(fo).toBe(fetchOptions);
  });
});

describe('deprecation warning fires at most once per module', () => {
  it('warns only on the first legacy call', async () => {
    vi.resetModules();
    const fresh = await import('./options');
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    fresh.resolveFromBlobArgs(80);
    fresh.resolveFromBlobArgs(50, 100);
    fresh.resolveFromURLArgs(30);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toContain('Positional arguments are deprecated');
    spy.mockRestore();
  });
});
