import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const requireTool = createRequire(new URL('./netlify/package.json', import.meta.url));
const { default: toml } = await import(pathToFileURL(requireTool.resolve('toml')));
const sharp = requireTool('sharp');
const { createIPX, ipxFSStorage } = await import(pathToFileURL(requireTool.resolve('ipx')));
const config = toml.parse(await readFile('netlify.toml', 'utf8'));
assert.equal(config.build.command, 'pnpm build');
assert.equal(config.build.publish, '.next');
assert.equal(config.plugins[0].package, '@netlify/plugin-nextjs');
assert.equal(config.headers[0].values['Access-Control-Allow-Origin'], 'https://links.yulalab.com');
// Netlify's two TOML consumers use the default import and parse() for Cargo manifests.
const cargo = toml.parse('[package]\nname = "ci-compatibility-fixture"\nversion = "1.0.0"\n');
assert.equal(cargo.package.name, 'ci-compatibility-fixture');

const fixture = await mkdtemp(join(tmpdir(), 'yula-ci-image-'));
try {
  await sharp({ create: { width: 24, height: 16, channels: 4, background: '#2873ff' } })
    .png().toFile(join(fixture, 'fixture.png'));
  const ipx = createIPX({ storage: ipxFSStorage({ dir: fixture }) });
  const result = await ipx('fixture.png', { s: '12x8', f: 'webp' }).process();
  const meta = await sharp(result.data).metadata();
  assert.equal(meta.width, 12);
  assert.equal(meta.height, 8);
  assert.equal(meta.format, 'webp');
  console.log(JSON.stringify({ status: 'PASS', scope: 'CI dependency compatibility; local fixtures only',
    toml: requireTool('toml/package.json').version, sharp: sharp.versions.sharp,
    libvips: sharp.versions.vips, ipx: JSON.parse(await readFile(new URL('./netlify/node_modules/ipx/package.json', import.meta.url), 'utf8')).version,
    netlifyConfigParse: true, cargoManifestParse: true, ipxResizeAndWebp: true }));
} finally {
  await rm(fixture, { recursive: true, force: true });
}
