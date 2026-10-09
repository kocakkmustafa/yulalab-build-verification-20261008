'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const forbidden = new Set(['netlify-cli', '@netlify/images', 'ipx', 'listhen', 'node-forge']);
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
for (const section of ['dependencies', 'devDependencies', 'optionalDependencies']) {
  for (const name of Object.keys(packageJson[section] || {})) {
    assert(!forbidden.has(name), 'removed tool declared in root: ' + name);
  }
}
for (const name of ['build:netlify', 'deploy', 'deploy:preview']) {
  assert(!Object.hasOwn(packageJson.scripts, name), 'obsolete CLI command retained: ' + name);
}
assert(!fs.existsSync(path.join(root, '.github/ci/netlify/package.json')), 'separate CLI package retained');
assert(!fs.existsSync(path.join(root, '.github/ci/netlify/package-lock.json')), 'separate CLI lock retained');

// Inspect actual pnpm installations, including nested optional packages.
let packages = 0;
const store = path.join(root, 'node_modules/.pnpm');
for (const entry of fs.readdirSync(store, { withFileTypes: true })) {
  if (!entry.isDirectory() || entry.name === 'node_modules') continue;
  const modules = path.join(store, entry.name, 'node_modules');
  for (const folder of fs.readdirSync(modules, { withFileTypes: true })) {
    const candidates = folder.name.startsWith('@') && folder.isDirectory()
      ? fs.readdirSync(path.join(modules, folder.name)).map(name => path.join(modules, folder.name, name))
      : [path.join(modules, folder.name)];
    for (const directory of candidates) {
      const manifest = path.join(directory, 'package.json');
      if (!fs.existsSync(manifest)) continue;
      const name = JSON.parse(fs.readFileSync(manifest, 'utf8')).name;
      assert(!forbidden.has(name), 'removed tool remains installed: ' + name);
      packages++;
    }
  }
}
assert(packages > 0, 'empty installation cannot establish toolchain absence');
console.log(JSON.stringify({ status: 'PASS_INSTALLED_REMOVED_TOOLCHAIN_ABSENCE',
  checkedPackageEntries: packages, absent: [...forbidden],
  scope: 'owned dependency graph; provider build dependencies are separate',
}));
