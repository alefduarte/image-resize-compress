import { describe, expect, it, vi } from 'vitest';
import fromBlob from '../../src/fromBlob';
import { loadFixture } from '../helpers';

const isAbort = (e: unknown): boolean =>
  e instanceof DOMException && e.name === 'AbortError';

describe('AbortSignal', () => {
  it('rejects with AbortError when the signal is already aborted; no blob produced', async () => {
    const photo = await loadFixture('photo-800x600.jpg');
    const ac = new AbortController();
    ac.abort();
    const resolved = vi.fn();
    await fromBlob(photo, { signal: ac.signal, format: 'jpeg' }).then(
      resolved,
      (e) => {
        expect(isAbort(e)).toBe(true);
      },
    );
    expect(resolved).not.toHaveBeenCalled();
  });

  it('rejects with AbortError when aborted mid-flight during the targetSize loop', async () => {
    const photo = await loadFixture('photo-800x600.jpg');
    const ac = new AbortController();
    const p = fromBlob(photo, {
      signal: ac.signal,
      format: 'jpeg',
      targetSize: 15_000,
    });
    ac.abort();
    await expect(p).rejects.toSatisfy(isAbort);
  });
});
