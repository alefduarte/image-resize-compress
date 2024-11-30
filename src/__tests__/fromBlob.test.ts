import fromBlob from '../fromBlob';

describe('fromBlob', () => {
  beforeAll(() => {
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      value: jest.fn(() => ({
        fillRect: jest.fn(),
        drawImage: jest.fn(),
        getImageData: jest.fn(),
        putImageData: jest.fn(),
        createImageData: jest.fn(() => ({})),
        setTransform: jest.fn(),
        resetTransform: jest.fn(),
        save: jest.fn(),
        restore: jest.fn(),
        beginPath: jest.fn(),
        moveTo: jest.fn(),
        lineTo: jest.fn(),
        closePath: jest.fn(),
        stroke: jest.fn(),
        fill: jest.fn(),
        clearRect: jest.fn(),
      })),
    });

    HTMLCanvasElement.prototype.toBlob = jest.fn((callback, type) => {
      callback(new Blob(['mocked blob'], { type }));
    });
  });
  beforeEach(() => {
    global.Image = class {
      onload: () => void = () => {};
      onerror: () => void = () => {};

      private _src: string = '';
      get src() {
        return this._src;
      }
      set src(value: string) {
        this._src = value;
        // Simulate image loading after setting src
        setTimeout(() => {
          if (this.onload) this.onload();
        }, 0);
      }
    } as unknown as typeof Image;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should convert a Blob to a resized image Blob', async () => {
    const imgBlob = new Blob(
      [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])],
      { type: 'image/png' },
    );

    const result = await fromBlob(imgBlob, 80, 100, 100, 'jpeg');
    expect(result).toBeInstanceOf(Blob);
    expect(result.type).toBe('image/jpeg');
  });

  it('should throw an error for invalid Blob input', async () => {
    await expect(fromBlob('invalid' as never)).rejects.toThrow(
      'Expected a Blob or File, but got string.',
    );
  });

  it('should throw an error for invalid quality value', async () => {
    const imgBlob = new Blob(
      [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])],
      { type: 'image/png' },
    );
    await expect(fromBlob(imgBlob, 0)).rejects.toThrow(
      'Quality must be greater than 0.',
    );
  });

  it('should throw an error for invalid width and height values', async () => {
    const imgBlob = new Blob(
      [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])],
      { type: 'image/png' },
    );
    await expect(fromBlob(imgBlob, 80, -100, 100)).rejects.toThrow(
      'Invalid width or height value!',
    );
    await expect(fromBlob(imgBlob, 80, 100, -100)).rejects.toThrow(
      'Invalid width or height value!',
    );
  });

  it('should handle image loading errors', async () => {
    const imgBlob = new Blob(
      [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])],
      { type: 'image/png' },
    );

    jest.spyOn(global, 'Image').mockImplementation(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const img: any = {}; // Create a mock Image object
      img.onerror = null; // Initialize onerror
      setTimeout(() => {
        if (img.onerror) {
          img.onerror(new Event('error')); // Trigger the error event
        }
      }, 0);
      return img;
    });

    await expect(fromBlob(imgBlob)).rejects.toThrow(
      'Failed to load the image. The file might be corrupt or empty.',
    );

    jest.restoreAllMocks(); // Clean up after the test
  });

  it('should handle canvas context errors', async () => {
    const imgBlob = new Blob(
      [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])],
      { type: 'image/png' },
    );
    jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    await expect(fromBlob(imgBlob)).rejects.toThrow(
      'Failed to get canvas context.',
    );
  });

  it('should handle empty Blob', async () => {
    const imgBlob = new Blob([], { type: 'image/png' });
    await expect(fromBlob(imgBlob)).rejects.toThrow(
      'Failed to load the image. The file might be corrupt or empty.',
    );
  });
});
