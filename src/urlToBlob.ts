import { isAbortError, httpError, networkError } from './errors';

/**
 * Fetch a URL and return its response as a Blob.
 *
 * @param url The URL to fetch.
 * @param fetchOptions Fetch options (e.g. headers, credentials, signal).
 * @returns A promise resolving to the fetched blob.
 */
const urlToBlob = async (
  url: string,
  fetchOptions?: RequestInit,
): Promise<Blob> => {
  if (typeof url !== 'string' || url.length === 0) {
    throw new TypeError('url must be a non-empty string');
  }

  let response: Response;
  try {
    response = await fetch(url, fetchOptions);
  } catch (err) {
    if (isAbortError(err)) throw err;
    throw networkError(url, err);
  }

  if (!response.ok) {
    throw httpError(url, response);
  }

  return response.blob();
};

export default urlToBlob;
