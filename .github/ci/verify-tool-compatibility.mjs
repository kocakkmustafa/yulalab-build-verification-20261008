import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const requireRoot = createRequire(new URL('../../package.json', import.meta.url));
const requireNext = createRequire(requireRoot.resolve('next/package.json'));
const sharp = requireNext('sharp');
const { optimizeImage } = requireNext('next/dist/server/image-optimizer.js');

// Exercise the native image consumer used by Next, with no image server,
// network request, temporary file or separate deployment dependency tree.
assert.equal(sharp.versions.sharp, '0.35.5');
const png = await sharp({ create: {
  width: 24, height: 16, channels: 4, background: '#2873ff',
} }).png().toBuffer();
const webp = await optimizeImage({
  buffer: png, width: 12, contentType: 'image/webp', quality: 75,
});
const metadata = await sharp(webp).metadata();
assert.equal(metadata.width, 12);
assert.equal(metadata.height, 8);
assert.equal(metadata.format, 'webp');
console.log(JSON.stringify({ status: 'PASS',
  scope: 'installed Next native image consumer; local memory fixture only',
  sharp: sharp.versions.sharp, libvips: sharp.versions.vips,
  nextResizeAndWebp: true,
}));
