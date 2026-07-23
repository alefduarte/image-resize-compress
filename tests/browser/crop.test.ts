import { describe, expect, it } from 'vitest';
import fromBlob from '../../src/fromBlob';
import { decodeDims, probePixel } from '../helpers';

/**
 * Build a 200×100 source: solid blue, with a red vertical band spanning the
 * center 100px (x ∈ [50, 150)). A center-crop to a 100×100 square keeps exactly
 * that red band, so the whole output is red. A stretch, by contrast, squeezes
 * the full 200px width into 100px, leaving blue at the left/right edges. Probing
 * the output edges therefore cleanly separates 'cover' from 'stretch'.
 */
const makeBandedSource = async (): Promise<Blob> => {
  const canvas = document.createElement('canvas');
  canvas.width = 200;
  canvas.height = 100;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#0000ff';
  ctx.fillRect(0, 0, 200, 100);
  ctx.fillStyle = '#ff0000';
  ctx.fillRect(50, 0, 100, 100);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('toBlob null'))),
      'image/png',
    );
  });
};

const isRed = ([r, g, b]: number[]): boolean => r > 200 && g < 60 && b < 60;
const isBlue = ([r, g, b]: number[]): boolean => b > 200 && r < 60 && g < 60;

describe("fit: 'cover'", () => {
  it('fills the exact target dimensions (200x100 → 100x100)', async () => {
    const src = await makeBandedSource();
    const out = await fromBlob(src, { width: 100, height: 100, fit: 'cover' });
    expect(await decodeDims(out)).toEqual({ width: 100, height: 100 });
  });

  it('center-crops the overflow: output edges show the kept center band', async () => {
    const src = await makeBandedSource();
    const out = await fromBlob(src, { width: 100, height: 100, fit: 'cover' });
    // Cover keeps source x ∈ [50, 150) — all red — so even the output edges are red.
    expect(isRed(await probePixel(out, 5, 50))).toBe(true);
    expect(isRed(await probePixel(out, 95, 50))).toBe(true);
    expect(isRed(await probePixel(out, 50, 50))).toBe(true);
  });

  it("defaults to 'stretch': edges keep the squeezed-in blue", async () => {
    const src = await makeBandedSource();
    const out = await fromBlob(src, { width: 100, height: 100 });
    expect(await decodeDims(out)).toEqual({ width: 100, height: 100 });
    // Stretch maps the full 200px width into 100px, so the blue edges survive.
    expect(isBlue(await probePixel(out, 3, 50))).toBe(true);
    expect(isBlue(await probePixel(out, 96, 50))).toBe(true);
  });

  it('is a no-op when the target already matches the source aspect (width only)', async () => {
    const src = await makeBandedSource();
    const out = await fromBlob(src, { width: 100, fit: 'cover' });
    // 200x100 → width 100 derives height 50; aspect preserved, nothing cropped.
    expect(await decodeDims(out)).toEqual({ width: 100, height: 50 });
    expect(isBlue(await probePixel(out, 3, 25))).toBe(true);
    expect(isRed(await probePixel(out, 50, 25))).toBe(true);
  });
});
