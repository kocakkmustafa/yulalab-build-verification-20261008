'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const tools = path.join(__dirname, 'netlify');
function metadata(entry, name) {
  let dir = path.dirname(fs.realpathSync(entry));
  while (true) {
    const file = path.join(dir, 'package.json');
    if (fs.existsSync(file)) {
      const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (pkg.name === name) return { path: file, version: pkg.version };
    }
    const parent = path.dirname(dir);
    assert.notEqual(parent, dir, 'package metadata not found: ' + name);
    dir = parent;
  }
}
function blobs(from, expected) {
  const resolved = metadata(from.resolve('@netlify/blobs'), '@netlify/blobs');
  assert.equal(resolved.version, expected);
  return resolved;
}
const harness = createRequire(path.join(tools, 'package.json'));
const ipx = createRequire(harness.resolve('ipx'));
const unstorage = createRequire(ipx.resolve('unstorage'));
const report = {
  harness: blobs(harness, '10.7.13'),
  ipxUnstorage: blobs(unstorage, '10.7.13'),
  consumers: {},
};
for (const name of ['netlify-cli', '@netlify/build', '@netlify/dev', '@netlify/functions-dev', '@netlify/runtime']) {
  const from = createRequire(path.join(tools, 'node_modules', name, 'package.json'));
  report.consumers[name] = blobs(from, '11.0.3');
}
assert.notEqual(report.harness.path, report.consumers['netlify-cli'].path);
console.log(JSON.stringify({ status: 'PASS_ACTUAL_BLOBS_PEER_AND_NETLIFY_CONSUMER_RESOLUTION', ...report }));
