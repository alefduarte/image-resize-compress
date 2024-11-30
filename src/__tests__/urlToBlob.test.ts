import urlToBlob from '../urlToBlob';

describe('urlToBlob', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should convert URL to Blob successfully', async () => {
    const mockBlob = new Blob(['test'], { type: 'text/plain' });
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      blob: jest.fn().mockResolvedValue(mockBlob),
    });

    const url = 'https://example.com/image.jpg';
    const result = await urlToBlob(url);

    expect(result).toBe(mockBlob);
    expect(global.fetch).toHaveBeenCalledWith(url, undefined);
  });

  it('should throw an error if fetch fails', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

    const url = 'https://example.com/image.jpg';

    await expect(urlToBlob(url)).rejects.toThrow(
      'Failed to fetch image from URL. Error: Error: Network error',
    );
    expect(global.fetch).toHaveBeenCalledWith(url, undefined);
  });

  it('should throw an error if response is not ok', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      statusText: 'Not Found',
    });

    const url = 'https://example.com/image.jpg';

    await expect(urlToBlob(url)).rejects.toThrow(
      'Failed to fetch image: Not Found',
    );
    expect(global.fetch).toHaveBeenCalledWith(url, undefined);
  });
});
