import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fromBlob from '../../src/fromBlob';
import fromURL from '../../src/fromURL';
import { InvalidImageError, UnsupportedFormatError } from '../../src/errors';
import { __pending, __resetWorker } from '../../src/worker-host';
import { decodeDims, loadFixture, makeImageBlob } from '../helpers';

const isAbort = (e: unknown): boolean =>
  e instanceof DOMException && e.name === 'AbortError';

/**
 * Spy on the Worker constructor while still producing a REAL Worker instance
 * (a bare `vi.spyOn(globalThis, 'Worker')` returns a mock without
 * `postMessage`/`terminate`). Returns the call-counting mock.
 */
const spyWorkerCtor = () => {
  const Real = globalThis.Worker;
  const ctor = vi.fn(function (url: string | URL) {
    return new Real(url);
  });
  vi.stubGlobal('Worker', ctor);
  return ctor;
};

// Every test starts from a fresh singleton so feature-detection / construction
// re-runs under whatever globals the test stubs.
beforeEach(() => {
  __resetWorker();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  __resetWorker();
});

describe('opt-in web worker (spec 08)', () => {
  it('parity: worker: true matches worker: false (dims, type, size within ±5%)', async () => {
    const photo = await loadFixture('photo-800x600.jpg');
    const main = await fromBlob(photo, {
      width: 300,
      format: 'webp',
      quality: 80,
    });
    const wrk = await fromBlob(photo, {
      width: 300,
      format: 'webp',
      quality: 80,
      worker: true,
    });

    expect(wrk.type).toBe(main.type);
    expect(await decodeDims(wrk)).toEqual(await decodeDims(main));
    expect(Math.abs(wrk.size - main.size)).toBeLessThanOrEqual(
      main.size * 0.05,
    );
  });

  it('actually runs off-thread: Worker constructed and a request is posted', async () => {
    const photo = await loadFixture('photo-800x600.jpg');
    const post = vi.spyOn(Worker.prototype, 'postMessage');

    const out = await fromBlob(photo, {
      width: 120,
      format: 'jpeg',
      worker: true,
    });

    // A request was posted to a real Worker, and the correct result came back.
    // Proof it ran off-thread: once the worker is constructed there is no
    // post-construction fallback — a broken embedding would hang (test timeout),
    // never silently resolve on the main thread.
    expect(post).toHaveBeenCalled();
    expect(out.type).toBe('image/jpeg');
    expect(await decodeDims(out)).toEqual({ width: 120, height: 90 });
  });

  it('fallback: no OffscreenCanvas → worker: true still resolves (main path)', async () => {
    const photo = await loadFixture('photo-800x600.jpg');
    vi.stubGlobal('OffscreenCanvas', undefined);
    const ctor = spyWorkerCtor();

    const out = await fromBlob(photo, {
      width: 100,
      format: 'png',
      worker: true,
    });

    expect(ctor).not.toHaveBeenCalled(); // feature-detect blocked the worker path
    expect(out.type).toBe('image/png');
    vi.unstubAllGlobals();
    expect(await decodeDims(out)).toEqual({ width: 100, height: 75 });
  });

  it('CSP-style failure: new Worker throws → silent fallback, no unhandled rejection', async () => {
    const photo = await loadFixture('photo-800x600.jpg');
    vi.stubGlobal(
      'Worker',
      class {
        constructor() {
          throw new DOMException('blocked by CSP', 'SecurityError');
        }
      },
    );

    const out = await fromBlob(photo, {
      width: 80,
      format: 'jpeg',
      worker: true,
    });

    expect(out.type).toBe('image/jpeg');
    vi.unstubAllGlobals();
    expect(await decodeDims(out)).toEqual({ width: 80, height: 60 });
  });

  it('typed errors cross the boundary: bmp + worker: true → UnsupportedFormatError', async () => {
    const photo = await loadFixture('photo-800x600.jpg');
    await expect(
      fromBlob(photo, { format: 'bmp' as unknown as 'png', worker: true }),
    ).rejects.toBeInstanceOf(UnsupportedFormatError);
  });

  it('typed errors cross the boundary: undecodable input in worker → InvalidImageError (rehydrated)', async () => {
    const txt = await loadFixture('not-an-image.txt');
    const post = vi.spyOn(Worker.prototype, 'postMessage');
    await expect(
      fromBlob(txt, { format: 'png', worker: true }),
    ).rejects.toBeInstanceOf(InvalidImageError);
    // Confirm it genuinely traversed the worker (not a main-thread rejection).
    expect(post).toHaveBeenCalled();
  });

  it('targetSize honored with worker: true (jpeg ≤ target, still decodable)', async () => {
    const photo = await loadFixture('photo-800x600.jpg');
    const out = await fromBlob(photo, {
      format: 'jpeg',
      targetSize: 20_000,
      worker: true,
    });
    expect(out.size).toBeLessThanOrEqual(20_000);
    expect(out.type).toBe('image/jpeg');
    expect(await decodeDims(out)).toEqual({ width: 800, height: 600 });
  });

  it('targetSize + resolved png output in worker → RangeError (rehydrated)', async () => {
    const png = await loadFixture('tiny-1x1.png');
    await expect(
      fromBlob(png, { targetSize: 5_000, worker: true }),
    ).rejects.toBeInstanceOf(RangeError);
  });

  it('abort mid-targetSize-loop with worker: true → AbortError; late result ignored', async () => {
    const photo = await loadFixture('photo-800x600.jpg');
    const ac = new AbortController();
    const p = fromBlob(photo, {
      worker: true,
      format: 'jpeg',
      targetSize: 15_000,
      signal: ac.signal,
    });
    ac.abort();
    await expect(p).rejects.toSatisfy(isAbort);
    // The pending entry is removed synchronously; any late worker completion for
    // that id has nothing to resolve. Give the worker time to (attempt to) reply.
    await new Promise((r) => setTimeout(r, 50));
    expect(__pending()).toBe(0);
  });

  it('concurrency: 4 simultaneous worker calls resolve to 4 correct, non-swapped results', async () => {
    const photo = await loadFixture('photo-800x600.jpg');
    const specs = [
      {
        width: 100,
        format: 'png' as const,
        dims: { width: 100, height: 75 },
        type: 'image/png',
      },
      {
        width: 200,
        format: 'jpeg' as const,
        dims: { width: 200, height: 150 },
        type: 'image/jpeg',
      },
      {
        width: 400,
        format: 'webp' as const,
        dims: { width: 400, height: 300 },
        type: 'image/webp',
      },
      {
        width: 50,
        format: 'png' as const,
        dims: { width: 50, height: 38 },
        type: 'image/png',
      },
    ];
    const outs = await Promise.all(
      specs.map((s) =>
        fromBlob(photo, { width: s.width, format: s.format, worker: true }),
      ),
    );
    for (let i = 0; i < specs.length; i += 1) {
      expect(outs[i].type).toBe(specs[i].type);
      expect(await decodeDims(outs[i])).toEqual(specs[i].dims);
    }
  });

  it('fromURL routes through the worker: worker: true matches worker: false', async () => {
    const url = '/fixtures/photo-800x600.jpg';
    const main = await fromURL(url, {
      width: 150,
      format: 'jpeg',
      quality: 70,
    });
    const post = vi.spyOn(Worker.prototype, 'postMessage');
    const wrk = await fromURL(url, {
      width: 150,
      format: 'jpeg',
      quality: 70,
      worker: true,
    });

    expect(post).toHaveBeenCalled(); // fetch stayed main-thread; decode/encode off-thread
    expect(wrk.type).toBe(main.type);
    expect(await decodeDims(wrk)).toEqual(await decodeDims(main));
    expect(Math.abs(wrk.size - main.size)).toBeLessThanOrEqual(
      main.size * 0.05,
    );
  });

  it('reuse: two sequential worker calls construct exactly one Worker', async () => {
    const src = await makeImageBlob(64, 64, 'image/png');
    const ctor = spyWorkerCtor();

    await fromBlob(src, { width: 32, format: 'png', worker: true });
    await fromBlob(src, { width: 16, format: 'png', worker: true });

    expect(ctor).toHaveBeenCalledTimes(1);
  });

  it('no leaks: 100 sequential worker calls — one object URL, empty pending map', async () => {
    const src = await makeImageBlob(64, 64, 'image/png');
    const create = vi.spyOn(URL, 'createObjectURL');
    const revoke = vi.spyOn(URL, 'revokeObjectURL');

    for (let i = 0; i < 100; i += 1) {
      await fromBlob(src, { width: 32, format: 'png', worker: true });
    }

    // Exactly one worker blob URL constructed and revoked across all 100 calls
    // (the worker path never touches URL.createObjectURL again).
    expect(create).toHaveBeenCalledTimes(1);
    expect(revoke).toHaveBeenCalledTimes(1);
    expect(__pending()).toBe(0);
  });
});
