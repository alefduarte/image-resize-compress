import { describe, expect, it } from 'vitest';
import blobToURL from '../../src/blobToURL';
import { InvalidImageError } from '../../src/errors';
import { loadFixture } from '../helpers';

describe('blobToURL', () => {
  it('converts a blob to a data:image/ URL (round-trip label preserved)', async () => {
    const photo = await loadFixture('photo-800x600.jpg');
    const url = await blobToURL(photo);
    expect(typeof url).toBe('string');
    expect(url.startsWith('data:image/jpeg')).toBe(true);
  });

  it('has no size cap (processes a multi-kB blob)', async () => {
    const photo = await loadFixture('photo-800x600.jpg');
    expect(photo.size).toBeGreaterThan(10_000);
    const url = await blobToURL(photo);
    expect(url.startsWith('data:image/')).toBe(true);
  });

  it('rejects a non-Blob argument with TypeError', async () => {
    await expect(blobToURL(42 as unknown as Blob)).rejects.toBeInstanceOf(
      TypeError,
    );
  });

  it('rejects an empty blob with InvalidImageError', async () => {
    await expect(blobToURL(new Blob([]))).rejects.toBeInstanceOf(
      InvalidImageError,
    );
  });
});
