import { afterEach, describe, expect, it, vi } from 'vitest';
import fromURL from '../../src/fromURL';
import urlToBlob from '../../src/urlToBlob';
import { FetchError, InvalidImageError } from '../../src/errors';
import { decodeDims } from '../helpers';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('fromURL', () => {
  it('fetches, decodes, and resizes a served image end-to-end', async () => {
    const out = await fromURL('/fixtures/photo-800x600.jpg', { width: 200 });
    expect(await decodeDims(out)).toEqual({ width: 200, height: 150 });
  });

  it('passes resize options through (backgroundColor reaches the pipeline)', async () => {
    const out = await fromURL('/fixtures/transparent-64x64.png', {
      format: 'jpeg',
      backgroundColor: '#ff0000',
    });
    expect(out.type).toBe('image/jpeg');
  });

  it('rejects a 404 with FetchError{status:404} and no CORS in the message', async () => {
    let err: unknown;
    await fromURL('/__test__/404').catch((e) => {
      err = e;
    });
    expect(err).toBeInstanceOf(FetchError);
    expect((err as FetchError).status).toBe(404);
    expect((err as FetchError).message).not.toMatch(/cors/i);
  });

  it('rejects an HTML (non-image) 200 response with InvalidImageError', async () => {
    let err: unknown;
    await fromURL('/__test__/html').catch((e) => {
      err = e;
    });
    expect(err).toBeInstanceOf(InvalidImageError);
    // charset may be appended by the server, so assert a substring, not equality.
    expect((err as Error).message).toContain('did not return an image');
    expect((err as Error).message).toContain('text/html');
  });

  it('wraps a network/CORS fetch rejection in FetchError with the cause preserved', async () => {
    const cause = new TypeError('Failed to fetch');
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(cause);
    let err: unknown;
    await fromURL('https://cross.example/x.png').catch((e) => {
      err = e;
    });
    expect(err).toBeInstanceOf(FetchError);
    expect((err as FetchError).status).toBeUndefined();
    expect((err as Error).message).toMatch(/network or CORS/);
    expect((err as Error).cause).toBe(cause);
  });

  it('rejects an empty url with TypeError', async () => {
    await expect(fromURL('')).rejects.toBeInstanceOf(TypeError);
  });
});

describe('urlToBlob', () => {
  it('returns the fetched image blob', async () => {
    const blob = await urlToBlob('/fixtures/tiny-1x1.png');
    expect(blob.type).toBe('image/png');
    expect(blob.size).toBeGreaterThan(0);
  });

  it('rejects a 404 with FetchError{status:404}', async () => {
    let err: unknown;
    await urlToBlob('/__test__/404').catch((e) => {
      err = e;
    });
    expect(err).toBeInstanceOf(FetchError);
    expect((err as FetchError).status).toBe(404);
  });

  it('wraps a network rejection in FetchError', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(
      new TypeError('Failed to fetch'),
    );
    await expect(
      urlToBlob('https://cross.example/x.png'),
    ).rejects.toBeInstanceOf(FetchError);
  });

  it('rejects an empty url with TypeError', async () => {
    await expect(urlToBlob('')).rejects.toBeInstanceOf(TypeError);
  });
});
