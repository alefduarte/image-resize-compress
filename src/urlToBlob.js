/**
 * Convert URL to Blob file. It may fail due to cros , resize or convert an image from url
 *
 * @param {string} url The image url.
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch} for available options.
 * @returns {Blob} Returns image as Blob.
 */

const urlToBlob = async (url, options = null) => {
  return await fetch(url, options)
    .then((res) => res.blob())
    .catch((error) => {
      throw new Error('Failed to fetch. Image might be protected. Error: ' + error);
    });
};

export default urlToBlob;
