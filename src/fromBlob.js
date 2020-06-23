/**
 * @typedef {Object} Size
 * @property {number} width - Image width
 * @property {number} height - Image height
 */

/**
 * returns the mime type given a string
 *
 * @param {string} format - image format [png, webp, bmp, jpeg, gif].
 * @returns {string} returns mime type - if no valid format returns jpeg
 */
const getMimeType = (format) => {
  if (format === 'png') {
    return 'image/png';
  }
  if (format === 'webp') {
    return 'image/webp';
  }
  if (format === 'bmp') {
    return 'image/bmp';
  }
  if (format === 'gif') {
    return 'image/gif';
  }
  return 'image/jpeg';
};

/**
 * Get the width and height of image
 *
 * @param {Object} img - Image file for width and height reference
 * @param {number} img.naturalHeight - Original image height.
 * @param {number} img.naturalWidth - Original image width.
 * @param {(number | string)} width - Desired image width. If string will calculate based on height scale
 * @param {(number | string)} height - Desired image height. If string will calculate based on width scale
 * @returns {Size} Returns the image width and height
 */

const getHeightWidth = (img, width, height) => {
  if (width > 0 && height > 0) return { width, height };
  if (width > 0) {
    if (height === 0) return { width, height: img.naturalHeight };
    const ratio = img.naturalWidth / width;
    return { width, height: Math.round((img.naturalHeight / ratio + Number.EPSILON) * 100) / 100 };
  }
  if (height > 0) {
    if (width === 0) return { width: img.naturalWidth, height };
    const ratio = img.naturalHeight / height;
    return { width: Math.round((img.naturalWidth / ratio + Number.EPSILON) * 100) / 100, height };
  }
  return { width: img.naturalWidth, height: img.naturalHeight };
};

/**
 * Compress, resize or convert a blob type image
 *
 * @param {(File|Blob)} imgBlob The image blob file that will be manipulated.
 * @param {number} [quality=100] Image quality for conversion of jpeg and png formats. Default value is 100.
 * @param {(number | string)} [width=0] Desired image width. If empty will use original width. If "auto", will calculate based on height scale
 * @param {(number | string)} [height=0] Desired image height. If empty will use original width. If "auto", will calculate based on width scale
 * @param {string} [format=null] image format [png, webp, bmp, jpeg, gif]. If null will use original format
 * @returns {Promise} Returns promise with compressed, resized and converted image.
 */

const fromBlob = (imgBlob, quality = 100, width = 0, height = 0, format = null) => {
  if (!(imgBlob instanceof Blob)) {
    throw new TypeError(`Expected blob or file! ${typeof imgBlob} given!`);
  }
  if (width < 0 || height < 0) {
    throw new RangeError('Invalid width or height value!');
  }
  if (quality <= 0) {
    throw new RangeError('Quality must be higher than 0!');
  }
  return new Promise((resolve) => {
    const mimeType = format ? getMimeType(format) : imgBlob.type;
    const imgQuality = quality < 1 ? quality : quality / 100;

    const reader = new FileReader();
    reader.readAsDataURL(imgBlob);
    reader.onload = () => {
      const img = new Image();
      img.src = reader.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const size = getHeightWidth(img, width, height);
        canvas.width = size.width;
        canvas.height = size.height;
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) =>
            resolve(
              new Blob([blob], {
                type: mimeType,
              })
            ),
          mimeType,
          imgQuality
        );
      };
    };
  });
};

export default fromBlob;
