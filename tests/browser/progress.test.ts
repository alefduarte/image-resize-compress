import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fromBlob from '../../src/fromBlob';
import { __resetWorker } from '../../src/worker-host';
import { loadFixture } from '../helpers';

/** Collect every value onProgress receives, in order. */
const recorder = () => {
  const values: number[] = [];
  const onProgress = (p: number) => values.push(p);
  return { values, onProgress };
};

const inRange = (values: number[]) => values.every((v) => v >= 0 && v <= 100);

beforeEach(() => {
  __resetWorker();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  __resetWorker();
});

describe('onProgress (0–100)', () => {
  it('plain resize/convert: fires once with a terminal 100', async () => {
    const photo = await loadFixture('photo-800x600.jpg');
    const { values, onProgress } = recorder();

    await fromBlob(photo, { width: 200, format: 'jpeg', onProgress });

    expect(values.length).toBeGreaterThan(0);
    expect(values.at(-1)).toBe(100);
    expect(inRange(values)).toBe(true);
  });

  it('targetSize: reports granular ascending steps ending at 100', async () => {
    const photo = await loadFixture('photo-800x600.jpg');
    const { values, onProgress } = recorder();

    await fromBlob(photo, { format: 'jpeg', targetSize: 20_000, onProgress });

    // More than the single terminal event — one per binary-search step.
    expect(values.length).toBeGreaterThan(1);
    expect(values.at(-1)).toBe(100);
    expect(inRange(values)).toBe(true);
    // Per-step values are non-decreasing ((i + 1) * 12.5).
    const steps = values.slice(0, -1);
    for (let i = 1; i < steps.length; i += 1) {
      expect(steps[i]).toBeGreaterThanOrEqual(steps[i - 1]);
    }
  });

  it('omitted onProgress is a no-op (no throw)', async () => {
    const photo = await loadFixture('photo-800x600.jpg');
    const out = await fromBlob(photo, { width: 100, format: 'png' });
    expect(out.type).toBe('image/png');
  });

  it('worker: true relays progress back to onProgress (terminal 100)', async () => {
    const photo = await loadFixture('photo-800x600.jpg');
    const { values, onProgress } = recorder();

    await fromBlob(photo, {
      width: 200,
      format: 'jpeg',
      worker: true,
      onProgress,
    });

    expect(values.length).toBeGreaterThan(0);
    expect(values.at(-1)).toBe(100);
    expect(inRange(values)).toBe(true);
  });

  it('worker: true + targetSize relays granular ascending steps', async () => {
    const photo = await loadFixture('photo-800x600.jpg');
    const { values, onProgress } = recorder();

    await fromBlob(photo, {
      format: 'jpeg',
      targetSize: 20_000,
      worker: true,
      onProgress,
    });

    expect(values.length).toBeGreaterThan(1);
    expect(values.at(-1)).toBe(100);
    expect(inRange(values)).toBe(true);
  });
});
