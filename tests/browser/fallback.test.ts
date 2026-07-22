import { afterEach, describe, expect, it, vi } from 'vitest';
import fromBlob from '../../src/fromBlob';
import { decodeDims, loadFixture } from '../helpers';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/**
 * These exercise the real fallback code paths that Chromium's fast path skips,
 * by stubbing off the modern APIs — the same code that runs on browsers lacking
 * `createImageBitmap` / `OffscreenCanvas`.
 */
describe('fallback decode/encode paths', () => {
  it('decodes via HTMLImageElement when createImageBitmap is unavailable', async () => {
    const photo = await loadFixture('photo-800x600.jpg');
    vi.stubGlobal('createImageBitmap', undefined);
    const out = await fromBlob(photo, { width: 100, format: 'png' });
    expect(out.type).toBe('image/png');
  });

  it('encodes via HTMLCanvasElement.toBlob when OffscreenCanvas is unavailable', async () => {
    const photo = await loadFixture('photo-800x600.jpg');
    vi.stubGlobal('OffscreenCanvas', undefined);
    const out = await fromBlob(photo, { width: 120, format: 'jpeg' });
    expect(out.type).toBe('image/jpeg');
    vi.unstubAllGlobals();
    expect(await decodeDims(out)).toEqual({ width: 120, height: 90 });
  });
});
