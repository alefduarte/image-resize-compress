/**
 * Convert URL to a Blob file.
 *
 * @param {string} url The image URL.
 * @param {RequestInit} [options] Fetch options (e.g., headers).
 * @returns {Promise<Blob>} Promise resolving to the fetched image blob.
 */
const urlToBlob = async (url: string, options?: RequestInit): Promise<Blob> => {
  try {
    const response = await fetch(url, options);
    if (!response.ok)
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    return await response.blob();
  } catch (error) {
    throw new Error(`Failed to fetch image from URL. Error: ${error}`);
  }
};

export default urlToBlob;
