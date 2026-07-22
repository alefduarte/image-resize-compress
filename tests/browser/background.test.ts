import { describe, expect, it } from 'vitest';
import fromBlob from '../../src/fromBlob';
import { loadFixture, probePixel } from '../helpers';

// transparent-64x64.png: opaque green in the top-left 32x32 quadrant, fully
// transparent elsewhere. We probe a transparent-region pixel (50,50).
describe('backgroundColor flattening (transparent png → jpeg)', () => {
  it('defaults transparent pixels to black (browser behavior, documented)', async () => {
    const src = await loadFixture('transparent-64x64.png');
    const out = await fromBlob(src, { format: 'jpeg' });
    expect(out.type).toBe('image/jpeg');
    const [r, g, b] = await probePixel(out, 50, 50);
    expect(r).toBeLessThan(40);
    expect(g).toBeLessThan(40);
    expect(b).toBeLessThan(40);
  });

  it("flattens transparent pixels onto backgroundColor '#ff0000' (red)", async () => {
    const src = await loadFixture('transparent-64x64.png');
    const out = await fromBlob(src, { format: 'jpeg', backgroundColor: '#ff0000' });
    const [r, g, b] = await probePixel(out, 50, 50);
    expect(r).toBeGreaterThan(200);
    expect(g).toBeLessThan(60);
    expect(b).toBeLessThan(60);
  });

  it("accepts the shorthand backgroundColor '#f00'", async () => {
    const src = await loadFixture('transparent-64x64.png');
    const out = await fromBlob(src, { format: 'jpeg', backgroundColor: '#f00' });
    const [r, g, b] = await probePixel(out, 50, 50);
    expect(r).toBeGreaterThan(200);
    expect(g).toBeLessThan(60);
    expect(b).toBeLessThan(60);
  });
});
