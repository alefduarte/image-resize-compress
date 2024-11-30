const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
/**
 * Convert File or Blob to DataURL
 *
 * @param {Blob | File} blob Blob or File to convert.
 * @returns {Promise<string | ArrayBuffer>} Promise resolving to a DataURL string.
 */
const blobToURL = (blob: Blob | File): Promise<string | ArrayBuffer> => {
  return new Promise((resolve, reject) => {
    if (blob.size === 0) {
      return reject(new Error('Cannot convert empty Blob.'));
    }
    if (blob.size > MAX_FILE_SIZE) {
      return reject(new Error('File size exceeds the maximum allowed limit.'));
    }
    const reader = new FileReader();

    reader.onloadend = () => {
      if (reader.result) {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to convert blob to DataURL.'));
      }
    };

    reader.onerror = () => reject(new Error('Error reading blob.'));
    reader.readAsDataURL(blob);
  });
};

export default blobToURL;
