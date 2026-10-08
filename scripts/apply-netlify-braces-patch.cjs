'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'patches/braces-3.0.3-provenance.json'), 'utf8'));
const target = path.join(root, '.github/ci/netlify/node_modules/braces');
const checkOnly = process.argv.includes('--check');
assert(process.argv.slice(2).every(arg => arg === '--check'), 'unsupported argument');
assert(!fs.lstatSync(target).isSymbolicLink(), 'Netlify braces must be an owned regular package directory');
const metadata = JSON.parse(fs.readFileSync(path.join(target, 'package.json'), 'utf8'));
assert.equal(metadata.name, 'braces');
assert.equal(metadata.version, '3.0.3');
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const expectedFiles = ['lib/compile.js', 'lib/constants.js', 'lib/expand.js', 'lib/parse.js', 'lib/stringify.js'];
assert.deepEqual(manifest.files.map(file => file.path), expectedFiles);
const patch = fs.readFileSync(path.join(root, 'patches/braces@3.0.3.patch'));
assert.equal(sha(patch), manifest.patchSha256, 'patch provenance mismatch');

// Validate the entire package before writing any file. An unknown version or
// partial third-party edit must fail installation rather than be overwritten.
const writes = manifest.files.map(file => {
  const destination = path.join(target, file.path);
  assert(!fs.lstatSync(destination).isSymbolicLink(), 'patch target must be a regular file');
  const replacement = Buffer.from(file.patchedBase64, 'base64');
  assert.equal(sha(replacement), file.patchedSha256, 'invalid replacement bytes');
  const current = sha(fs.readFileSync(destination));
  assert(current === file.originalSha256 || current === file.patchedSha256, 'unexpected installed bytes: ' + file.path);
  if (checkOnly) assert.equal(current, file.patchedSha256, 'unpatched installed bytes: ' + file.path);
  return { destination, replacement, needed: current !== file.patchedSha256 };
});
if (!checkOnly) {
  for (const file of writes) if (file.needed) fs.writeFileSync(file.destination, file.replacement);
}
for (const file of manifest.files) assert.equal(sha(fs.readFileSync(path.join(target, file.path))), file.patchedSha256);
console.log(JSON.stringify({ result: checkOnly ? 'PASS_PATCHED_CLI_BYTES' : 'PASS_CLI_PATCH_APPLIED', package: 'braces@3.0.3', upstreamCommit: manifest.upstreamCommit, files: writes.length, auditAdvisorySuppressed: false }));
