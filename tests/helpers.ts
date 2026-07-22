/** Shared helpers for the browser tier. */

/** Fetch a committed fixture (served at `/fixtures/<name>`) as a Blob. */
export const loadFixture = async (name: string): Promise<Blob> => {
  const res = await fetch(`/fixtures/${name}`);
  if (!res.ok) throw new Error(`fixture ${name} → ${res.status}`);
  return res.blob();
};

/** Decode a blob and return its pixel dimensions via the real `createImageBitmap`. */
export const decodeDims = async (blob: Blob): Promise<{ width: number; height: number }> => {
  const bitmap = await createImageBitmap(blob);
  const dims = { width: bitmap.width, height: bitmap.height };
  bitmap.close();
  return dims;
};

/** First `n` bytes (default 12) of a blob as a lowercase hex string. */
export const magicBytes = async (blob: Blob, n = 12): Promise<string> => {
  const buf = new Uint8Array(await blob.slice(0, n).arrayBuffer());
  return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
};

/** First `n` bytes as an ASCII string (for RIFF/WEBP container checks). */
export const asciiBytes = async (blob: Blob, n = 16): Promise<string> => {
  const buf = new Uint8Array(await blob.slice(0, n).arrayBuffer());
  return Array.from(buf, (b) => (b >= 32 && b < 127 ? String.fromCharCode(b) : '.')).join('');
};

/** Draw a solid synthetic image of exact dimensions and return it as a real Blob. */
export const makeImageBlob = async (
  width: number,
  height: number,
  type: 'image/png' | 'image/jpeg' | 'image/webp' = 'image/png',
  quality?: number,
): Promise<Blob> => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#3366cc';
  ctx.fillRect(0, 0, width, height);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('toBlob returned null'))),
      type,
      quality,
    );
  });
};

/** Draw a blob to a canvas and read back one pixel as [r, g, b, a]. */
export const probePixel = async (
  blob: Blob,
  x = 0,
  y = 0,
): Promise<[number, number, number, number]> => {
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  const { data } = ctx.getImageData(x, y, 1, 1);
  return [data[0], data[1], data[2], data[3]];
};
