import fromURL from '../fromURL';
import fromBlob from '../fromBlob';

jest.mock('../fromBlob');

describe('fromURL', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should fetch and process the image successfully', async () => {
    const mockBlob = new Blob(['test'], { type: 'text/plain' });
    const processedBlob = new Blob(['processed'], { type: 'text/plain' });
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      blob: jest.fn().mockResolvedValue(mockBlob),
    });
    (fromBlob as jest.Mock).mockResolvedValue(processedBlob);

    const url = 'https://example.com/image.jpg';
    const result = await fromURL(url);

    expect(result).toBe(processedBlob);
    expect(global.fetch).toHaveBeenCalledWith(url, undefined);
    expect(fromBlob).toHaveBeenCalledWith(
      mockBlob,
      100,
      'auto',
      'auto',
      undefined,
    );
  });

  it('should throw an error if fetch fails', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

    const url = 'https://example.com/image.jpg';

    await expect(fromURL(url)).rejects.toThrow(
      'Failed to process the image from URL. Check CORS or network issues. Error: Error: Network error',
    );
    expect(global.fetch).toHaveBeenCalledWith(url, undefined);
  });

  it('should throw an error if response is not ok', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      statusText: 'Not Found',
    });

    const url = 'https://example.com/image.jpg';

    await expect(fromURL(url)).rejects.toThrow(
      'Failed to fetch image: Not Found',
    );
    expect(global.fetch).toHaveBeenCalledWith(url, undefined);
  });

  it('should throw an error if image processing fails', async () => {
    const mockBlob = new Blob(['test'], { type: 'text/plain' });
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      blob: jest.fn().mockResolvedValue(mockBlob),
    });
    (fromBlob as jest.Mock).mockRejectedValue(new Error('Processing error'));

    const url = 'https://example.com/image.jpg';

    await expect(fromURL(url)).rejects.toThrow(
      'Failed to process the image from URL. Check CORS or network issues. Error: Error: Processing error',
    );
    expect(global.fetch).toHaveBeenCalledWith(url, undefined);
    expect(fromBlob).toHaveBeenCalledWith(
      mockBlob,
      100,
      'auto',
      'auto',
      undefined,
    );
  });
});
