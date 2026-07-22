import { afterEach, describe, expect, it, vi } from 'vitest';
import fromBlob from '../../src/fromBlob';
import { InvalidImageError } from '../../src/errors';
import { loadFixture } from '../helpers';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/**
 * The object-URL decode path only runs in the HTMLImageElement fallback, so we
 * force it by stubbing `createImageBitmap` off. Every createObjectURL must be
 * matched by a revokeObjectURL — on the success path AND the error path.
 */
describe('no object-URL leaks (HTMLImageElement fallback path)', () => {
  it('revokes the object URL on the success path', async () => {
    const photo = await loadFixture('photo-800x600.jpg');
    vi.stubGlobal('createImageBitmap', undefined);
    const create = vi.spyOn(URL, 'createObjectURL');
    const revoke = vi.spyOn(URL, 'revokeObjectURL');

    const out = await fromBlob(photo, { format: 'png' });

    expect(out.type).toBe('image/png');
    expect(create.mock.calls.length).toBeGreaterThan(0);
    expect(revoke.mock.calls.length).toBe(create.mock.calls.length);
  });

  it('revokes the object URL on the error path (undecodable input)', async () => {
    const txt = await loadFixture('not-an-image.txt');
    vi.stubGlobal('createImageBitmap', undefined);
    const create = vi.spyOn(URL, 'createObjectURL');
    const revoke = vi.spyOn(URL, 'revokeObjectURL');

    await expect(fromBlob(txt, { format: 'png' })).rejects.toBeInstanceOf(InvalidImageError);

    expect(create.mock.calls.length).toBeGreaterThan(0);
    expect(revoke.mock.calls.length).toBe(create.mock.calls.length);
  });
});
