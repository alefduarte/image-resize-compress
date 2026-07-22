import { describe, expect, it } from 'vitest';
import fromBlob from '../../src/fromBlob';
import { decodeDims, loadFixture } from '../helpers';

describe('compression', () => {
  it('quality:30 jpeg is at least 40% smaller than quality:95', async () => {
    const photo = await loadFixture('photo-800x600.jpg');
    const [q30, q95] = await Promise.all([
      fromBlob(photo, { format: 'jpeg', quality: 30 }),
      fromBlob(photo, { format: 'jpeg', quality: 95 }),
    ]);
    expect(q30.size).toBeLessThanOrEqual(q95.size * 0.6);
    expect(q30.type).toBe('image/jpeg');
  });

  it('quality:1 produces a visibly-low-quality jpeg far smaller than quality:95', async () => {
    const photo = await loadFixture('photo-800x600.jpg');
    const [q1, q95] = await Promise.all([
      fromBlob(photo, { format: 'jpeg', quality: 1 }),
      fromBlob(photo, { format: 'jpeg', quality: 95 }),
    ]);
    // ~1% quality: dramatically smaller, but still a decodable jpeg of the same size.
    expect(q1.size).toBeLessThan(q95.size * 0.25);
    expect(await decodeDims(q1)).toEqual({ width: 800, height: 600 });
  });

  it('omitting quality uses the encoder default (a valid blob)', async () => {
    const photo = await loadFixture('photo-800x600.jpg');
    const out = await fromBlob(photo, { format: 'jpeg' });
    expect(out.type).toBe('image/jpeg');
    expect(out.size).toBeGreaterThan(0);
  });
});
