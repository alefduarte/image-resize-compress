import { afterEach, describe, expect, it, vi } from 'vitest';
import fromBlob from '../../src/fromBlob';
import { decodeDims, loadFixture } from '../helpers';

/** Count encode iterations via the OffscreenCanvas surface makeCanvas produces in Chromium. */
const spyEncodes = () => vi.spyOn(OffscreenCanvas.prototype, 'convertToBlob');

afterEach(() => {
  vi.restoreAllMocks();
});

describe('targetSize (binary-searched quality)', () => {
  it('produces a jpeg at or under the target and still decodable', async () => {
    const photo = await loadFixture('photo-800x600.jpg');
    const spy = spyEncodes();
    const out = await fromBlob(photo, { format: 'jpeg', targetSize: 20_000 });
    expect(out.size).toBeLessThanOrEqual(20_000);
    expect(out.type).toBe('image/jpeg');
    expect(await decodeDims(out)).toEqual({ width: 800, height: 600 });
    expect(spy.mock.calls.length).toBeLessThanOrEqual(8);
  });

  it('resolves with the smallest attempt for an unreachable target without looping (<9 encodes)', async () => {
    const photo = await loadFixture('photo-800x600.jpg');
    const spy = spyEncodes();
    const out = await fromBlob(photo, { format: 'webp', targetSize: 100 });
    expect(out.size).toBeGreaterThan(0);
    expect(out.type).toBe('image/webp');
    expect(await decodeDims(out)).toEqual({ width: 800, height: 600 });
    expect(spy.mock.calls.length).toBeGreaterThan(0);
    expect(spy.mock.calls.length).toBeLessThanOrEqual(8);
  });

  it('rejects targetSize when the resolved output format is png', async () => {
    const png = await loadFixture('tiny-1x1.png');
    // no explicit format → input type (png) is used → png cannot honor targetSize
    await expect(fromBlob(png, { targetSize: 5_000 })).rejects.toBeInstanceOf(
      RangeError,
    );
  });
});
