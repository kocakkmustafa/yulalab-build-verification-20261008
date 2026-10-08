# Published-source normal CI

The release snapshot commit `345bd36c42074e926c1c788baf43300c1f86e561`
contains all 257 files from the published web source manifest. The CI change
originally preserved 251 files verbatim. The six exceptions in `published-files.json`
are the workflow and Playwright harness: configurable local port, denial of
external browser DNS, and readiness synchronization before wheel input.
The publication baseline remains immutable. Intentional product changes are
listed separately in `reviewed-source-changes.json`, with the baseline and
candidate SHA-256, a review reason, and the permanent evidence class
`CANDIDATE_ONLY_NOT_PUBLICATION_EVIDENCE`. The verifier
requires each unique changed path to exist in the baseline, its old hash to
match, and its current bytes to match the reviewed candidate hash. Every other
baseline file remains byte-identical. This candidate aligns the Burun Farki
project contact with `support@yulalab.com`, points the package deploy commands
at the existing Netlify production/private preview projects, and updates the
deployment documentation. The 2026-09-22 candidate also updates the Node build
target, pins the supported function runtime, patches Next/sharp/YAML/TOML
advisories, and fixes clock-dependent and Node 26 browser-storage test setup.
Translations, assets and database code are unchanged. Passing this check is
not a deployment receipt.

The Links sibling is pinned to
`43524f61e28d9bbd73be372ca8bc30feedddb8ad`, the existing main revision with
the stale technical banner removed. Its own immutable publication manifest
and reviewed candidate deltas are verified separately by the web workflow.

The workflow runs all existing unit tests with disposable PostgreSQL 17,
lint, typecheck, content and URL-shape checks, offline Next/Netlify build,
artifact checks, and all existing Playwright tests. Local E2E uses port 4189;
`YULA_E2E_PORT` may select another isolated local port. Public URL reachability
is intentionally not requested. Every assertion remains in the baseline
test suites; local/browser results do not establish canonical hostname or
provider behavior.
The proof-ledger wheel test waits for the existing experience-ready signal
before input; its five-second scroll assertion and zero internal-scroll check
remain unchanged. Renderer startup is not part of that interaction assertion.

`netlify/package-lock.json` freezes the build CLI dependency tree independently
of the product lockfile. Netlify CLI remains pinned to 27.5.0; only the CI
package overrides TOML to 4.2.0 and IPX sharp to 0.35.4 for the published
advisories GHSA-82x6-q7mm-w9cf, GHSA-v5mp-jgw5-2x6j, and
GHSA-f88m-g3jw-g9cj. The compatibility check parses local Netlify/Cargo
configuration and performs an IPX resize/WebP conversion with local fixtures.
The product dependency patches are recorded in the reviewed source manifest
and pnpm lockfile. The Netlify step runs `pnpm build:netlify` locally with
`--offline` and contains no deployment command. Build Node is 26.9.0; the CLI
process explicitly sets `AWS_LAMBDA_JS_RUNTIME=nodejs24.x`. Netlify's build
Node selection and supported Functions runtimes have separate release schedules.
A future provider-managed build must verify that environment setting through
the provider before publication; it is not configured through `netlify.toml`.
The artifact check requires an explicit Node 24 function runtime, distinguishes the host
platform and architecture, validates the adapter function/edge bundles and
the registry bytes, and records their hashes. It does not execute those
bundles in a production provider runtime.

The artifact contract accepts the pinned adapter's single `eszip2` bundle or
one `eszip2` plus one `tar` bundle, in either order. Both forms must retain the
same single middleware route and generator. Unknown or duplicate formats,
missing files, unsafe asset paths, filesystem symlinks, and asset SHA-256
mismatches fail explicitly even with Python optimization enabled. Standard
ZIP/gzip/tar integrity checks and a small ESZIP_V2 section-boundary check catch
truncated files; the ESZIP check is not a semantic parser or execution proof.
The server ZIP may contain the adapter's normal pnpm dependency links; the
checker does not extract or execute the archive.

Run `python3 -B -O .github/ci/test-netlify-contract.py` for the small temporary
regression fixtures; CI runs them automatically before the offline build.
After an existing build has completed its adapter lifecycle, run
`python3 -B -O .github/ci/netlify-contract.py` to record its local hashes. These
commands do not build or deploy. A CI-only checker change does not make a new
published source revision: compare runtime inputs and the existing artefact
hashes separately with the actual deployment receipt.

The product commands are `pnpm run deploy` and `pnpm run deploy:preview`.
CLI 27.5.0 builds by default; its hidden compatibility `--build` flag is
supported but unnecessary. The integrated deploy lifecycle temporarily moves
CDN content into the configured `.next` publish directory, then restores it to
`.netlify/static` on completion. A later `deploy --no-build` against raw
`.next` skips that lifecycle and is not an equivalent publication command.

The two existing package-manager dependency audit gates remain mandatory:
`pnpm audit --prod --audit-level high` and `pnpm audit --audit-level high`.
The independently locked Netlify CLI tree is also checked with
`npm audit --prefix .github/ci/netlify --audit-level high`. All three retain
normal failure behavior; no audit result is suppressed. These dependency
advisory checks are separate from native security validation. Ordinary tests,
dependency audits, and artifact hashes do not replace that validation or close
its findings. The original full workflow is retained in the immutable source
snapshot commit.

Before a remote push/PR, inspect provider Git integrations, production
branches, automatic preview behavior, and available free Actions capacity.
There is no deploy or merge step in these workflows. A successful local run
is not a GitHub runner receipt. Review the actual run's checkout SHA, sibling
SHA, job/step results, and artifacts before recording useful CI acceptance.

Future intentional product changes require an exact reviewed delta and an
explicit review of the publication relationship. Keep historical manifests
intact; record actual publication acceptance in a separate deploy receipt.
