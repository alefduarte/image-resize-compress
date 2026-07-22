import { describe, expect, it, vi } from 'vitest';
import fromBlob from '../../src/fromBlob';
import { decodeDims, loadFixture } from '../helpers';

// Vitest isolates each browser test file, so this module's one-time deprecation
// flag starts fresh here — the warn-once assertion is deterministic.
describe('legacy positional overload', () => {
  it('still works (fromBlob(photo, 80, 100, "auto", "webp")) and warns once', async () => {
    const photo = await loadFixture('photo-800x600.jpg');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const out = await fromBlob(photo, 80, 100, 'auto', 'webp');
    // second legacy call to prove the warning is emitted at most once
    await fromBlob(photo, 50);

    expect(out.type).toBe('image/webp');
    expect(await decodeDims(out)).toEqual({ width: 100, height: 75 });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain(
      'Positional arguments are deprecated',
    );

    warn.mockRestore();
  });
});
