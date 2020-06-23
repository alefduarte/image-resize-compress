/**
 * Convert File or Blob to DataURL
 *
 * @param {(Blob | File)} blob Blob or File
 * @returns {Promise(string)} Promise with dataURL result
 */

const blobToURL = (blob) => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    reader.onloadend = (e) => resolve(e.target.result);
  });
};

export default blobToURL;
