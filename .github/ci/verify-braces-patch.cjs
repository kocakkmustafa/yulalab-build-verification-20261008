'use strict';
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');

const root = path.resolve(__dirname, '../..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'patches/braces-3.0.3-provenance.json'), 'utf8'));
const store = path.join(root, 'node_modules/.pnpm');
const entries = fs.readdirSync(store);
const installedBraces = entries.filter(entry => entry.startsWith('braces@')).map(entry => path.join(store, entry, 'node_modules/braces'));
assert.equal(installedBraces.length, 1, 'unexpected braces version or duplicate unpatched installation');
const approvedPackages = new Set(installedBraces.map(file => fs.realpathSync(file)));
let assertions = 0;
const nested = depth => '{'.repeat(depth) + 'a' + '}'.repeat(depth);
for (const directory of installedBraces) {
  const metadata = JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf8'));
  assert.equal(metadata.name, 'braces');
  assert.equal(metadata.version, '3.0.3');
  for (const file of manifest.files) {
    const actual = crypto.createHash('sha256').update(fs.readFileSync(path.join(directory, file.path))).digest('hex');
    assert.equal(actual, file.patchedSha256, 'installed patch bytes differ: ' + file.path);
    assertions++;
  }
  const braces = require(directory);
  for (const name of ['compile', 'expand', 'stringify']) {
    assert.doesNotThrow(() => braces[name](nested(100)));
    assert.throws(() => braces[name](nested(101)), /exceeds max depth/);
    assertions += 2;
  }
  assert.deepEqual(braces.expand('item-{01..03}.{txt,md}'), ['item-01.txt', 'item-01.md', 'item-02.txt', 'item-02.md', 'item-03.txt', 'item-03.md']);
  assertions++;
}

// Check the real loaders used by linting, Tailwind, and file watching rather
// than accepting a separate patched copy that their module graph never loads.
const consumers = [];
for (const entry of entries.filter(entry => entry.startsWith('micromatch@') || entry.startsWith('chokidar@3.'))) {
  const name = entry.startsWith('micromatch@') ? 'micromatch' : 'chokidar';
  const from = createRequire(path.join(store, entry, 'node_modules', name, 'package.json'));
  const resolved = fs.realpathSync(path.dirname(from.resolve('braces/package.json')));
  assert(approvedPackages.has(resolved), 'consumer resolved unapproved braces: ' + entry);
  consumers.push(entry);
  assertions++;
}
assert(process.env.RUNNER_TEMP, 'RUNNER_TEMP must identify the owned disposable fixture area');
const fixture = fs.mkdtempSync(path.join(process.env.RUNNER_TEMP, 'braces-glob-'));
const fastGlobs = entries.filter(entry => entry.startsWith('fast-glob@')).map(entry => ({ name: entry, directory: path.join(store, entry, 'node_modules/fast-glob') }));
try {
  for (const folder of ['a', 'b']) {
    const destination = path.join(fixture, 'nested', folder);
    fs.mkdirSync(destination, { recursive: true });
    for (const id of ['01', '02', '03']) fs.writeFileSync(path.join(destination, 'item-' + id + '.txt'), 'fixture');
  }
  const expected = ['a', 'b'].flatMap(folder => ['01', '02', '03'].map(id => 'nested/' + folder + '/item-' + id + '.txt')).sort();
  for (const tool of fastGlobs) {
    const from = createRequire(path.join(tool.directory, 'package.json'));
    const micromatch = createRequire(from.resolve('micromatch/package.json'));
    assert(approvedPackages.has(fs.realpathSync(path.dirname(micromatch.resolve('braces/package.json')))));
    assert.deepEqual(require(tool.directory).sync('nested/{a,b}/item-{01..03}.txt', { cwd: fixture }).sort(), expected, tool.name + ' real expansion changed');
    assertions += 2;
  }
} finally {
  fs.rmSync(fixture, { recursive: true });
}
console.log(JSON.stringify({ result: 'PASS_INSTALLED_PATCH_BYTES_LOADERS_AND_REAL_GLOBS', packages: installedBraces.length, consumers, fastGlobs: fastGlobs.map(tool => tool.name), assertions, upstreamCommit: manifest.upstreamCommit, auditAdvisorySuppressed: false }));
