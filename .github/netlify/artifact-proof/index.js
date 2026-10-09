'use strict';
const { spawnSync } = require('node:child_process');
const path = require('node:path');

module.exports = {
  onPostBuild({ constants, utils }) {
    const root = path.resolve(__dirname, '../../..');
    const outputs = {};
    for (const field of ['FUNCTIONS_DIST', 'EDGE_FUNCTIONS_DIST']) {
      if (typeof constants[field] !== 'string' || constants[field].length === 0 ||
          constants[field].split(/[\\/]/).includes('..')) {
        utils.build.failBuild('Artifact proof requires a safe provider output directory: ' + field);
        return;
      }
      // Netlify normalizes paths inside the checkout to relative constants.
      // External Buildbot Functions directories stay absolute.
      outputs[field] = path.resolve(root, constants[field]);
    }
    // Netlify core has packaged the server and middleware at this event.
    // This plugin precedes the adapter's onPostBuild publish-directory swap.
    const commands = [
      ['node', [path.join(root, 'scripts/verify-render-mode.mjs')]],
      ['python3', ['-B', '-O', path.join(root, '.github/ci/netlify-contract.py'),
        '--functions-dist', outputs.FUNCTIONS_DIST,
        '--edge-functions-dist', outputs.EDGE_FUNCTIONS_DIST]],
    ];
    for (const [command, args] of commands) {
      const result = spawnSync(command, args, { cwd: root, stdio: 'inherit' });
      if (result.error || result.signal || result.status !== 0) {
        utils.build.failBuild('Netlify artifact proof failed: ' + command,
          result.error ? { error: result.error } : undefined);
        return;
      }
    }
  },
};
