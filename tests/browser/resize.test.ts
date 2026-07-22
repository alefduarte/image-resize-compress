import { describe, expect, it } from 'vitest';
import fromBlob from '../../src/fromBlob';
import { decodeDims, loadFixture, makeImageBlob } from '../helpers';

describe('resize', () => {
  it('resizes to an exact width, deriving height from aspect ratio (800x600 → 200x150)', async () => {
    const photo = await loadFixture('photo-800x600.jpg');
    const out = await fromBlob(photo, { width: 200 });
    expect(await decodeDims(out)).toEqual({ width: 200, height: 150 });
  });

  it('resizes to an exact height, deriving width (800x600 → 400x300)', async () => {
    const photo = await loadFixture('photo-800x600.jpg');
    const out = await fromBlob(photo, { height: 300 });
    expect(await decodeDims(out)).toEqual({ width: 400, height: 300 });
  });

  it('honors explicit width and height verbatim', async () => {
    const photo = await loadFixture('photo-800x600.jpg');
    const out = await fromBlob(photo, { width: 111, height: 222 });
    expect(await decodeDims(out)).toEqual({ width: 111, height: 222 });
  });

  it('maxWidthOrHeight caps the longest edge (200x400 → 50x100)', async () => {
    const src = await makeImageBlob(200, 400, 'image/png');
    const out = await fromBlob(src, { maxWidthOrHeight: 100 });
    expect(await decodeDims(out)).toEqual({ width: 50, height: 100 });
  });

  it('maxWidthOrHeight is a no-op when the image already fits', async () => {
    const src = await makeImageBlob(80, 40, 'image/png');
    const out = await fromBlob(src, { maxWidthOrHeight: 100 });
    expect(await decodeDims(out)).toEqual({ width: 80, height: 40 });
  });

  it('keeps the natural size when no dimensions are given', async () => {
    const photo = await loadFixture('photo-800x600.jpg');
    const out = await fromBlob(photo, { format: 'jpeg' });
    expect(await decodeDims(out)).toEqual({ width: 800, height: 600 });
  });
});
