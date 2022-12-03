import fromBlob from './fromBlob.js';
/**
 * Compress, resize or convert an image from url
 *
 * @param {string} url The image url.
 * @param {number} [quality=100] Image quality for conversion
 * @param {(number | string)} [width=0] Desired image width. If string will calculate based on height scale
 * @param {(number | string)} [height=0] Desired image height. If string will calculate based on width scale
 * @param {string} [format=null] image format [png, webp, bmp, jpeg]. If null original format will be used
 * @returns {Blob} Returns compressed, resized and converted image.
 */

const fromURL = (url, quality = 100, width = 0, height = 0, format = null) => {
  return fetch(url)
    .then((res) => res.blob())
    .then((blob) => {
      return fromBlob(blob, quality, width, height, format);
    })
    .catch((error) => {
      throw new Error(
        'Failed to fetch. Image might be protected. See Cross Origin Resource Sharing. Error: ' +
          error
      );
    });
};

export default fromURL;
