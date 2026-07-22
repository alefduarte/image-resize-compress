import { describe, expect, it } from 'vitest';
import fromBlob from './fromBlob';
import fromURL from './fromURL';
import { EnvironmentError } from './errors';
import { makeCanvas } from './pipeline';
import { assertBrowserEnv } from './decode';

/**
 * These run in the Node (unit) tier — no `document`, no `createImageBitmap`,
 * no `OffscreenCanvas` — which is exactly the SSR/Node misuse the guard targets.
 */
describe('browser environment guard (Node tier)', () => {
  it('assertBrowserEnv throws EnvironmentError with the documented message', () => {
    expect(() => assertBrowserEnv()).toThrow(EnvironmentError);
    expect(() => assertBrowserEnv()).toThrow('image-resize-compress requires a browser environment');
  });

  it('fromBlob rejects with EnvironmentError when called in Node', async () => {
    await expect(fromBlob(new Blob(['x'], { type: 'image/png' }))).rejects.toBeInstanceOf(
      EnvironmentError,
    );
  });

  it('fromURL rejects with EnvironmentError when called in Node', async () => {
    await expect(fromURL('https://example.com/a.png')).rejects.toBeInstanceOf(EnvironmentError);
  });

  it('makeCanvas throws EnvironmentError when no canvas backend exists', () => {
    expect(() => makeCanvas(10, 10)).toThrow(EnvironmentError);
  });
});
