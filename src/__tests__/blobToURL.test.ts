import blobToURL from '../blobToURL';

describe('blobToURL', () => {
  it('should convert a Blob to a DataURL', async () => {
    const blob = new Blob(['test'], { type: 'text/plain' });
    const result = await blobToURL(blob);
    expect(result).toMatch(/^data:text\/plain;base64,/);
  });

  it('should convert a File to a DataURL', async () => {
    const file = new File(['test'], 'test.txt', { type: 'text/plain' });
    const result = await blobToURL(file);
    expect(result).toMatch(/^data:text\/plain;base64,/);
  });

  it('should handle errors when FileReader fails to read Blob', async () => {
    const blob = new Blob(['test'], { type: 'text/plain' });
    jest
      .spyOn(FileReader.prototype, 'readAsDataURL')
      .mockImplementation(function (this: FileReader) {
        const event = new ProgressEvent('error');
        this.onerror?.(event as ProgressEvent<FileReader>);
      });

    await expect(blobToURL(blob)).rejects.toThrow('Error reading blob.');
  });

  it('should handle errors when FileReader fails to read File', async () => {
    const file = new File(['test'], 'test.txt', { type: 'text/plain' });
    jest
      .spyOn(FileReader.prototype, 'readAsDataURL')
      .mockImplementation(function (this: FileReader) {
        const event = new ProgressEvent('error');
        this.onerror?.(event as ProgressEvent<FileReader>);
      });

    await expect(blobToURL(file)).rejects.toThrow('Error reading blob.');
  });

  it('should handle empty Blob', async () => {
    const blob = new Blob([], { type: 'text/plain' });
    await expect(blobToURL(blob)).rejects.toThrow('Cannot convert empty Blob.');
  });

  it('should handle empty File', async () => {
    const file = new File([], 'empty.txt', { type: 'text/plain' });
    await expect(blobToURL(file)).rejects.toThrow('Cannot convert empty Blob.');
  });

  it('should handle large File', async () => {
    const largeFile = new File(
      [new Array(1000000).fill('a').join('')],
      'large.txt',
      { type: 'text/plain' },
    );
    await expect(blobToURL(largeFile)).rejects.toThrow('Error reading blob.');
  });
});
