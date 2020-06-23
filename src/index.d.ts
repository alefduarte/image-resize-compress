export const fromBlob: (
  imgBlob: Blob,
  quality?: number,
  width?: number | string,
  height?: number | string,
  format?: string
) => Promise<Blob>;
export const fromURL: (
  url: string,
  quality?: number,
  width?: number | string,
  height?: number | string,
  format?: string
) => Promise<Blob>;
export const blobToURL: (blob: Blob) => Promise<string>;
export const urlToBlob: (url: String) => Promise<Blob>;
