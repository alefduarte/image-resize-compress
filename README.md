# [image-resize-compress](https://www.npmjs.com/package/image-resize-compress)

[![License](https://img.shields.io/npm/l/image-resize-compress)](https://www.npmjs.com/package/image-resize-compress) [![minified size](https://img.shields.io/bundlephobia/min/image-resize-compress.svg)](https://www.npmjs.com/package/image-resize-compress) [![Version](https://img.shields.io/npm/v/image-resize-compress.svg)](https://www.npmjs.com/package/image-resize-compress)

`image-resize-compress` is a library that allows you to compress, resize or convert an image without any extra dependency.

You can use a File, Blob or even a url.

Check out the [DEMO](https://alefduarte.github.io/image-resize-compress-demo/) page.

## Installation

### npm

```sh
npm install --save image-resize-compress
```

### yarn

```sh
yarn add image-resize-compress
```

## Importing

```js
import { blobToURL, urlToBlob, fromBlob, fromURL } from 'image-resize-compress'; // ES6
// or
import * as imageResizeCompress from 'image-resize-compress'; // ES6
var imageResizeCompress = require('image-resize-compress'); // ES5 with npm
```

## Usage

### From a Blob or File

```js
import { blobToURL, fromBlob } from 'image-resize-compress';
const handleBlob = (blobFile) => {
  // quality value for webp and jpeg formats.
  const quality = 80;
  // output width. 0 will keep its original width and 'auto' will calculate its scale from height.
  const width = 0;
  // output height. 0 will keep its original height and 'auto' will calculate its scale from width.
  const height = 0;
  // file format: png, jpeg, bmp, gif, webp. If null, original format will be used.
  const format = 'webp';

  // note only the blobFile argument is required
  fromBlob(blobFile, quality, width, height, format).then((blob) => {
    // will output the converted blob file
    console.log(blob);
    // will generate a url to the converted file
    blobToURL(blob).then((url) => console.log(url));
  });
};
```

you may display the file by doing so

```html
<img src={url} alt="compressed file"></img>
```

### From a URL

```js
import { blobToURL, fromURL } from 'image-resize-compress';
const handleBlob = (sourceUrl) => {
  // quality value for webp and jpeg formats.
  const quality = 80;
  // output width. 0 will keep its original width and 'auto' will calculate its scale from height.
  const width = 0;
  // output height. 0 will keep its original height and 'auto' will calculate its scale from width.
  const height = 0;
  // file format: png, jpeg, bmp, gif, webp. If null, original format will be used.
  const format = 'webp';

  // note only the sourceUrl argument is required
  fromURL(sourceUrl, quality, width, height, format).then((blob) => {
    // will output the converted blob file
    console.log(blob);
    // will generate a url to the converted file
    blobToURL(blob).then((url) => console.log(url));
  });
};
```

You may also use `urlToBlob`. Note that server must accept cors requests.

See [Cross-Origin Resource Sharing (CORS)](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)

```js
import { blobToURL, urlToBlob, fromBlob } from 'image-resize-compress';
const handleBlob = (sourceUrl) => {
  // quality value for webp and jpeg formats.
  const quality = 80;
  // output width. 0 will keep its original width and 'auto' will calculate its scale from height.
  const width = 0;
  // output height. 0 will keep its original height and 'auto' will calculate its scale from width.
  const height = 0;
  // file format: png, jpeg, bmp, gif, webp. If null, original format will be used.
  const format = 'webp';

  // converts given url to blob file using fetch
  const blobFile = urlToBlob(sourceUrl);

  // note only the blobFile argument is required
  fromBlob(blobFile, quality, width, height, format).then((blob) => {
    // will output the converted blob file
    console.log(blob);
    // will generate a url to the converted file
    blobToURL(blob).then((url) => console.log(url));
  });
};
```

## Methods

### `blobToURL(file) → {Promise(string)}`

#### Description

Converts a given File or Blob into a DataURL string.

#### Parameters

| Name | Type         | Attributes | Description           |
| ---- | ------------ | ---------- | --------------------- |
| file | (File\|Blob) | required   | A File or Blob object |

#### Example:

```js
imageResizeCompress.blobToURL(file).then((url) => console.log(url));
```

### `urlToBlob(url) → {Promise(Blob)}`

#### Description:

Converts a given url string to a Blob object.

#### Parameters:

| Name | Type   | Attributes | Description                        |
| ---- | ------ | ---------- | ---------------------------------- |
| url  | string | required   | A dataUrl or an external image url |

#### Example:

```js
imageResizeCompress.urlToBlob(url).then((file) => console.log(file));
```

### `fromBlob(file[, quality, width, height, format]) → {Promise(Blob)}`

#### Description:

Compresses, resizes and/or converts a given image File or Blob.

#### Parameters:

| Name    | Type             | Attributes | Description                                                                                                                                                                                                                                                     |
| ------- | ---------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| file    | (File\|Blob)     | required   | A File or Blob object                                                                                                                                                                                                                                           |
| quality | string           | optional   | The quality of the output image. Only used for webp or jpeg formats.                                                                                                                                                                                            |
| width   | (string\|number) | optional   | The width of the output image. If 0, the original width will be used. If 'auto', the width will be calculated based on the height of the image. If you have a 1280×720 image and set its height to 640 and width to 'auto', the output image will be 640×240.   |
| height  | (string\|number) | optional   | The height of the output image. If 0, the original height will be used. If 'auto', the height will be calculated based on the width of the image. If you have a 1280×720 image and set its width to 240 and height to 'auto', the output image will be 640×240. |
| format  | string           | optional   | The format of the output image. It can be png, jpeg, bmp, webp or gif. If you want a better compression, use webp format. If null, the source file format will be used.                                                                                         |

#### Example:

```js
fromBlob(blobFile).then((blob) => console.log(blob));
// or
fromBlob(blobFile, quality, width, height, format).then((blob) => console.log(blob));
```

### `fromURL(url[, quality, width, height, format]) → {Promise(Blob)}`

#### Description:

Compresses, resizes and/or converts a given image url. Note that server must accept cors requests.

See [Cross-Origin Resource Sharing (CORS)](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)

#### Parameters:

| Name    | Type             | Attributes | Description                                                                                                                                                                                                                                                     |
| ------- | ---------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| url     | string           | required   | The image URL                                                                                                                                                                                                                                                   |
| quality | string           | optional   | The quality of the output image. Only used for webp or jpeg formats.                                                                                                                                                                                            |
| width   | (string\|number) | optional   | The width of the output image. If 0, the original width will be used. If 'auto', the width will be calculated based on the height of the image. If you have a 1280×720 image and set its height to 640 and width to 'auto', the output image will be 640×240.   |
| height  | (string\|number) | optional   | The height of the output image. If 0, the original height will be used. If 'auto', the height will be calculated based on the width of the image. If you have a 1280×720 image and set its width to 240 and height to 'auto', the output image will be 640×240. |
| format  | string           | optional   | The format of the output image. It can be png, jpeg, bmp, webp or gif. If you want a better compression, use webp format. If null, the source file format will be used.                                                                                         |

#### Example:

```js
fromURL(url).then((blob) => console.log(blob));
// or
fromURL(url, quality, width, height, format).then((blob) => console.log(blob));
```

## Compatibility

IE and older browsers may not be compatible. Check [Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise#Browser_compatibility) and [Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API#Browser_compatibility) support.

## License

[MIT](http://opensource.org/licenses/MIT)