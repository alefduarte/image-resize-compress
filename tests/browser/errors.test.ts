import { afterEach, describe, expect, it, vi } from 'vitest';
import fromBlob from '../../src/fromBlob';
import { ImageTooLargeError, InvalidImageError } from '../../src/errors';
import { processBitmap } from '../../src/pipeline';
import type { DecodedImage } from '../../src/decode';
import { loadFixture } from '../helpers';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('input errors', () => {
  it('rejects a non-image text blob with InvalidImageError', async () => {
    const txt = await loadFixture('not-an-image.txt');
    await expect(fromBlob(txt, { format: 'png' })).rejects.toBeInstanceOf(
      InvalidImageError,
    );
  });

  it('rejects an empty blob with InvalidImageError', async () => {
    await expect(
      fromBlob(new Blob([], { type: 'image/png' })),
    ).rejects.toBeInstanceOf(InvalidImageError);
  });

  it('rejects a non-Blob argument with TypeError', async () => {
    await expect(
      fromBlob('not a blob' as unknown as Blob, { format: 'png' }),
    ).rejects.toBeInstanceOf(TypeError);
  });
});

describe('ImageTooLargeError (decompression-bomb guard)', () => {
  it('throws for an oversized source WITHOUT allocating a canvas', async () => {
    // A real 20000x20000 image is impractical; feed processBitmap a decoded stub
    // that reports oversized natural dims. The guard runs before makeCanvas.
    const source = new Image(); // valid CanvasImageSource, never drawn
    const decoded: DecodedImage = {
      source,
      width: 20_000,
      height: 20_000,
      close: () => {},
    };
    const offscreenSpy = vi.spyOn(globalThis, 'OffscreenCanvas');
    const createElSpy = vi.spyOn(document, 'createElement');

    await expect(
      processBitmap(decoded, { width: 'auto', height: 'auto', worker: false }),
    ).rejects.toBeInstanceOf(ImageTooLargeError);

    expect(offscreenSpy).not.toHaveBeenCalled();
    expect(
      createElSpy.mock.calls.filter((c) => c[0] === 'canvas'),
    ).toHaveLength(0);
  });

  it('throws when the requested target dimensions exceed the pixel limit', async () => {
    const photo = await loadFixture('photo-800x600.jpg');
    await expect(fromBlob(photo, { width: 20_000 })).rejects.toBeInstanceOf(
      ImageTooLargeError,
    );
  });
});
