# [image-resize-compress](https://www.npmjs.com/package/image-resize-compress)

[![License](https://img.shields.io/npm/l/image-resize-compress)](https://www.npmjs.com/package/image-resize-compress) [![minified size](https://img.shields.io/bundlephobia/min/image-resize-compress.svg)](https://www.npmjs.com/package/image-resize-compress) [![Version](https://img.shields.io/npm/v/image-resize-compress.svg)](https://www.npmjs.com/package/image-resize-compress)

`image-resize-compress` is a lightweight library that enables you to compress, resize, or convert images effortlessly. It supports working with `File`, `Blob`, and even URLs without any additional dependencies.

✨ [Demo](https://alefduarte.github.io/image-resize-compress-demo/)

## 🚀 Installation

### Using npm

```sh
npm install --save image-resize-compress
```

### Using yarn

```sh
yarn add image-resize-compress
```

## 📦 Importing the Library

### ES6 Import

```js
import { blobToURL, urlToBlob, fromBlob, fromURL } from 'image-resize-compress';
```

### CommonJS Require

```js
var imageResizeCompress = require('image-resize-compress');
```

### VanillaJS via CDN

Include the library in your HTML file:

```html
<script src="https://cdn.jsdelivr.net/npm/image-resize-compress@1/dist/index.js"></script>
```

## 🔧 Usage

### Example 1: From a Blob or File

```js
import { fromBlob, blobToURL } from 'image-resize-compress';

const handleBlob = async (blobFile) => {
  const quality = 80; // For webp and jpeg formats
  const width = 'auto'; // Original width
  const height = 'auto'; // Original height
  const format = 'webp'; // Output format

  const resizedBlob = await fromBlob(blobFile, quality, width, height, format);
  const url = await blobToURL(resizedBlob);

  console.log('Resized Blob:', resizedBlob);
  console.log('Blob URL:', url);
};
```

You can use the generated URL to display the image:

```html
<img src="{url}" alt="Resized image" />
```

### Example 2: From a URL

```js
import { fromURL, blobToURL } from 'image-resize-compress';

const handleURL = async (imageUrl) => {
  const quality = 80;
  const width = 'auto';
  const height = 'auto';
  const format = 'jpeg';

  const resizedBlob = await fromURL(imageUrl, quality, width, height, format);
  const url = await blobToURL(resizedBlob);

  console.log('Resized Blob:', resizedBlob);
  console.log('Blob URL:', url);
};
```

**Note**: Ensure the server hosting the image allows [CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS) requests.

## 🌐 VanillaJS Example

```html
<script src="https://cdn.jsdelivr.net/npm/image-resize-compress/dist/index.min.js"></script>

<script>
  async function resizeImage() {
    const file = document.querySelector('#fileInput').files[0];
    const resizedBlob = await imageResizeCompress.fromBlob(
      file,
      75,
      0,
      0,
      'webp',
    );
    console.log(resizedBlob);
  }
</script>

<input type="file" id="fileInput" onchange="resizeImage()" />
```

## 🛠️ Methods

### `blobToURL(blob: Blob | File) → Promise<string>`

Converts a `Blob` or `File` into a `Data URL`.

#### **Parameters**:

- `blob` _(Blob | File)_: The file or blob to convert.

#### Example:

```js
blobToURL(file).then((url) => console.log(url));
```

### `urlToBlob(url: string) → Promise<Blob>`

Fetches an image from a URL and converts it into a `Blob`.

#### Parameters:

- **url** (_string_): The URL of the image.

#### Example:

```js
urlToBlob('https://example.com/image.png').then((blob) => console.log(blob));
```

### `fromBlob(blob: Blob | File, quality?: number, width?: number | string, height?: number | string, format?: string) → Promise<Blob>`

Resizes, compresses, and/or converts a `Blob` or `File`.

#### Parameters:

- **blob** (_Blob | File_): The input file or blob.
- **quality** (_number_): Compression quality (for webp or jpeg).
- **width** (_number | string_): Target width (use `auto` to scale based on height).
- **height** (_number | string_): Target height (use `auto` to scale based on width).
- **format** (_string_): Desired format (e.g., jpeg, webp).

#### Example:

```js
fromBlob(file, 80, 'auto', 100, 'jpeg').then((resizedBlob) =>
  console.log(resizedBlob),
);
```

### `fromURL(url: string, quality?: number, width?: number | string, height?: number | string, format?: string) → Promise<Blob>`

Resizes, compresses, and/or converts an image from a URL.

See [Cross-Origin Resource Sharing (CORS)](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)

#### Parameters:

- **url** (_string_): The image URL.
- **quality** (_number_): Compression quality (for webp or jpeg).
- **width** (_number | string_): Target width (use `auto` to scale based on height).
- **height** (_number | string_): Target height (use `auto` to scale based on width).
- **format** (_string_): Desired format (e.g., jpeg, webp).

#### Example:

```js
fromURL('https://example.com/image.png', 75, 200, 'auto', 'webp').then(
  (resizedBlob) => console.log(resizedBlob),
);
```

## 🖥️ Compatibility

`image-resize-compress` supports most modern browsers. However:

Older browsers (e.g., IE) may require polyfills for [Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise#Browser_compatibility) and [Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API#Browser_compatibility).

## 📜 License

[MIT](http://opensource.org/licenses/MIT)

Feel free to contribute, report bugs, or suggest features! 🎉
