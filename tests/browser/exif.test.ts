import { describe, expect, it } from 'vitest';
import fromBlob from '../../src/fromBlob';
import { decodeDims, loadFixture } from '../helpers';

describe('EXIF orientation', () => {
  it('applies orientation 6 so the output is upright (encoded 90x60 → 60x90)', async () => {
    const blob = await loadFixture('exif-orientation-6.jpg');
    const out = await fromBlob(blob, { format: 'png' });
    const dims = await decodeDims(out);
    // The stored JPEG pixels are 90 wide x 60 tall; orientation 6 rotates it
    // upright to portrait. createImageBitmap honors this, so output is 60x90.
    expect(dims).toEqual({ width: 60, height: 90 });
  });
});
