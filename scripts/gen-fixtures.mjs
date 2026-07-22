// One-off fixture generator. Run: node scripts/gen-fixtures.mjs
// Draws real images on a real canvas in headless Chromium (Playwright),
// verifies each decodes (and the EXIF orientation swap) BEFORE writing, so a
// broken fixture fails at creation rather than mid-suite. See tests/fixtures/README.md.
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { chromium } from 'playwright';

const outDir = fileURLToPath(new URL('../tests/fixtures', import.meta.url));
const write = async (name, bytes) => {
  await writeFile(path.join(outDir, name), bytes);
  console.log(`  wrote ${name.padEnd(24)} ${bytes.length} bytes`);
};
const b64ToBuf = (b64) => Buffer.from(b64, 'base64');

/** Parse the encoded width/height from a JPEG's SOF marker (ignores EXIF). */
const jpegSofDims = (jpeg) => {
  let i = 2; // skip SOI
  while (i < jpeg.length) {
    if (jpeg[i] !== 0xff) {
      i += 1;
      continue;
    }
    const marker = jpeg[i + 1];
    // SOF0..SOF3, SOF5..SOF7, SOF9..SOF11, SOF13..SOF15 carry frame dims
    if (
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf)
    ) {
      const height = (jpeg[i + 5] << 8) | jpeg[i + 6];
      const width = (jpeg[i + 7] << 8) | jpeg[i + 8];
      return { width, height };
    }
    const len = (jpeg[i + 2] << 8) | jpeg[i + 3];
    i += 2 + len;
  }
  throw new Error('no SOF marker found in jpeg');
};

/** Splice an EXIF APP1 (Orientation=6, "rotate 90° CW") segment right after SOI. */
const injectExifOrientation6 = (jpeg) => {
  // TIFF (little-endian): 1 IFD entry, tag 0x0112 Orientation = 6.
  const tiff = Buffer.from([
    0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, // "II", 42, IFD0 offset=8
    0x01, 0x00, // 1 entry
    0x12, 0x01, 0x03, 0x00, 0x01, 0x00, 0x00, 0x00, 0x06, 0x00, 0x00, 0x00, // Orientation SHORT =6
    0x00, 0x00, 0x00, 0x00, // next IFD = 0
  ]);
  const exifHeader = Buffer.from('Exif\0\0', 'latin1');
  const payloadLen = 2 + exifHeader.length + tiff.length; // length field includes itself
  const app1 = Buffer.concat([
    Buffer.from([0xff, 0xe1, (payloadLen >> 8) & 0xff, payloadLen & 0xff]),
    exifHeader,
    tiff,
  ]);
  // jpeg starts with SOI (FF D8); insert APP1 immediately after it.
  return Buffer.concat([jpeg.subarray(0, 2), app1, jpeg.subarray(2)]);
};

const browser = await chromium.launch();
const page = await browser.newPage();

// --- draw the raster fixtures on a real canvas and return them as base64 ---
const drawn = await page.evaluate(async () => {
  const toB64 = async (canvas, type, quality) => {
    const blob = await new Promise((res) => canvas.toBlob(res, type, quality));
    const buf = new Uint8Array(await blob.arrayBuffer());
    let s = '';
    for (const b of buf) s += String.fromCharCode(b);
    return { b64: btoa(s), size: buf.length };
  };

  // 1x1 opaque red png
  const c1 = document.createElement('canvas');
  c1.width = c1.height = 1;
  const x1 = c1.getContext('2d');
  x1.fillStyle = '#ff0000';
  x1.fillRect(0, 0, 1, 1);
  const tiny = await toB64(c1, 'image/png');

  // 64x64 with a transparent quadrant + an opaque colored region (alpha channel)
  const ct = document.createElement('canvas');
  ct.width = ct.height = 64;
  const xt = ct.getContext('2d');
  xt.clearRect(0, 0, 64, 64); // fully transparent
  xt.fillStyle = '#00ff00';
  xt.fillRect(0, 0, 32, 32); // one opaque green quadrant, rest transparent
  const transparent = await toB64(ct, 'image/png');

  // 800x600 photo-like image: smooth gradient + shapes + mild noise (compressible,
  // enough high-frequency detail that q95 >> q30). Stored lossy to stay < 30 kB.
  const cp = document.createElement('canvas');
  cp.width = 800;
  cp.height = 600;
  const xp = cp.getContext('2d');
  const g = xp.createLinearGradient(0, 0, 800, 600);
  g.addColorStop(0, '#1e3a8a');
  g.addColorStop(0.5, '#db2777');
  g.addColorStop(1, '#f59e0b');
  xp.fillStyle = g;
  xp.fillRect(0, 0, 800, 600);
  for (let i = 0; i < 400; i += 1) {
    xp.fillStyle = `hsla(${(i * 37) % 360},70%,${30 + (i % 50)}%,0.6)`;
    xp.beginPath();
    xp.arc((i * 97) % 800, (i * 53) % 600, 4 + (i % 30), 0, Math.PI * 2);
    xp.fill();
  }
  // mild per-pixel noise to add high-frequency detail
  const img = xp.getImageData(0, 0, 800, 600);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() * 24) | 0;
    d[i] = Math.min(255, d[i] + n);
    d[i + 1] = Math.min(255, d[i + 1] + n);
    d[i + 2] = Math.min(255, d[i + 2] + n);
  }
  xp.putImageData(img, 0, 0);
  const photo = await toB64(cp, 'image/jpeg', 0.22);

  // landscape base for the EXIF fixture: 90 wide x 60 tall, asymmetric content
  const ce = document.createElement('canvas');
  ce.width = 90;
  ce.height = 60;
  const xe = ce.getContext('2d');
  xe.fillStyle = '#000';
  xe.fillRect(0, 0, 90, 60);
  xe.fillStyle = '#ff0000';
  xe.fillRect(0, 0, 90, 20); // red stripe along the top edge
  const exifBase = await toB64(ce, 'image/jpeg', 0.9);

  return { tiny, transparent, photo, exifBase };
});

console.log('canvas encode sizes:', {
  tiny: drawn.tiny.size,
  transparent: drawn.transparent.size,
  photo: drawn.photo.size,
  exifBase: drawn.exifBase.size,
});

const exif = injectExifOrientation6(b64ToBuf(drawn.exifBase.b64));

// Canonical 43-byte 1x1 transparent GIF89a — battle-tested bytes, decodes
// everywhere. Only used as a decode-only "gif input → png output" fixture; the
// suite never inspects frame count. Verified to decode below before writing.
const ANIMATED_GIF_B64 = 'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
const animatedGif = b64ToBuf(ANIMATED_GIF_B64);

const notAnImage = Buffer.from('this is definitely not an image\n', 'utf8');

// --- verify everything decodes (and the orientation swaps) before writing ---
const fixturesToVerify = {
  'tiny-1x1.png': b64ToBuf(drawn.tiny.b64),
  'transparent-64x64.png': b64ToBuf(drawn.transparent.b64),
  'photo-800x600.jpg': b64ToBuf(drawn.photo.b64),
  'exif-orientation-6.jpg': exif,
  'animated.gif': animatedGif,
};

const verify = await page.evaluate(async ([entries]) => {
  const out = {};
  for (const [name, arr] of entries) {
    const bytes = Uint8Array.from(arr);
    const blob = new Blob([bytes]);
    try {
      const bmp = await createImageBitmap(blob);
      out[name] = { ok: true, w: bmp.width, h: bmp.height };
      bmp.close();
    } catch (e) {
      out[name] = { ok: false, err: String(e) };
    }
  }
  // orientation check for the EXIF fixture: decoded (from-image) dims
  const exifArr = entries.find(([n]) => n === 'exif-orientation-6.jpg')[1];
  const exifBlob = new Blob([Uint8Array.from(exifArr)]);
  const oriented = await createImageBitmap(exifBlob, { imageOrientation: 'from-image' });
  out.__exif = { oriented: [oriented.width, oriented.height] };
  oriented.close();
  return out;
}, [Object.entries(fixturesToVerify).map(([n, b]) => [n, Array.from(b)])]);

console.log('decode verification:', JSON.stringify(verify, null, 2));

// measure q30 vs q95 re-encode ratio of the decoded photo (the compression test)
const ratio = await page.evaluate(async ([arr]) => {
  const blob = new Blob([Uint8Array.from(arr)]);
  const bmp = await createImageBitmap(blob);
  const c = document.createElement('canvas');
  c.width = bmp.width;
  c.height = bmp.height;
  c.getContext('2d').drawImage(bmp, 0, 0);
  const enc = (q) => new Promise((r) => c.toBlob((b) => r(b.size), 'image/jpeg', q));
  const q30 = await enc(0.3);
  const q95 = await enc(0.95);
  return { q30, q95, smaller: 1 - q30 / q95 };
}, [Array.from(fixturesToVerify['photo-800x600.jpg'])]);
console.log('photo re-encode q30 vs q95:', ratio);

await browser.close();

// fail loudly if any fixture did not decode or the orientation did not swap
for (const [name, r] of Object.entries(verify)) {
  if (name === '__exif') continue;
  if (!r.ok) throw new Error(`fixture ${name} failed to decode: ${r.err}`);
}
const encoded = jpegSofDims(exif); // { width, height } of the encoded pixels (ignores EXIF)
const { oriented } = verify.__exif;
if (oriented[0] !== encoded.height || oriented[1] !== encoded.width) {
  throw new Error(
    `EXIF orientation did not swap: encoded=${encoded.width}x${encoded.height} oriented=${oriented}`,
  );
}
if (b64ToBuf(drawn.photo.b64).length >= 30_000) {
  throw new Error('photo fixture >= 30 kB; reduce quality/detail');
}
if (ratio.smaller < 0.4) {
  throw new Error(`photo q30 not <=60% of q95 (only ${(ratio.smaller * 100) | 0}% smaller)`);
}

await Promise.all([
  write('tiny-1x1.png', fixturesToVerify['tiny-1x1.png']),
  write('transparent-64x64.png', fixturesToVerify['transparent-64x64.png']),
  write('photo-800x600.jpg', fixturesToVerify['photo-800x600.jpg']),
  write('exif-orientation-6.jpg', fixturesToVerify['exif-orientation-6.jpg']),
  write('animated.gif', animatedGif),
  write('not-an-image.txt', notAnImage),
]);

const total = Object.values(fixturesToVerify).reduce((s, b) => s + b.length, 0) + notAnImage.length;
console.log(`total fixture bytes: ${total} (< 100 kB required)`);
if (total >= 100_000) throw new Error('total fixtures >= 100 kB');
console.log(`exif dims: encoded ${encoded.width}x${encoded.height} -> oriented ${oriented}`);
