import { describe, expect, it } from 'vitest';
import fromBlob from '../../src/fromBlob';
import { UnsupportedFormatError } from '../../src/errors';
import { asciiBytes, decodeDims, loadFixture, magicBytes } from '../helpers';

describe('format conversion (bytes verified, not just the label)', () => {
  it('converts to webp — RIFF....WEBP magic bytes and matching type', async () => {
    const photo = await loadFixture('photo-800x600.jpg');
    const out = await fromBlob(photo, { format: 'webp' });
    expect(out.type).toBe('image/webp');
    const ascii = await asciiBytes(out, 12);
    expect(ascii.slice(0, 4)).toBe('RIFF');
    expect(ascii.slice(8, 12)).toBe('WEBP');
  });

  it('converts to png — PNG magic bytes', async () => {
    const photo = await loadFixture('photo-800x600.jpg');
    const out = await fromBlob(photo, { format: 'png' });
    expect(out.type).toBe('image/png');
    expect(await magicBytes(out, 8)).toBe('89504e470d0a1a0a');
  });

  it('converts to jpeg — SOI magic bytes', async () => {
    const png = await loadFixture('tiny-1x1.png');
    const out = await fromBlob(png, { format: 'jpeg' });
    expect(out.type).toBe('image/jpeg');
    expect(await magicBytes(out, 3)).toBe('ffd8ff');
  });

  it('gif input with no format falls back to png output', async () => {
    const gif = await loadFixture('animated.gif');
    const out = await fromBlob(gif);
    expect(out.type).toBe('image/png');
    expect(await magicBytes(out, 8)).toBe('89504e470d0a1a0a');
    expect(await decodeDims(out)).toBeTruthy();
  });

  it('a jpeg input with no format stays jpeg', async () => {
    const photo = await loadFixture('photo-800x600.jpg');
    const out = await fromBlob(photo);
    expect(out.type).toBe('image/jpeg');
  });

  it("format:'bmp' throws UnsupportedFormatError", async () => {
    const photo = await loadFixture('photo-800x600.jpg');
    await expect(
      fromBlob(photo, { format: 'bmp' as unknown as 'png' }),
    ).rejects.toBeInstanceOf(UnsupportedFormatError);
  });
});
