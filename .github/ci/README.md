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
project contact with `support@yulalab.com`, recorded the former local deploy commands
and deployment documentation; the current candidate removes that CLI and uses
the already connected Netlify Git build. The 2026-09-22 candidate also updates the Node build
target, pins the supported function runtime, patches Next/sharp/YAML/TOML
advisories, and fixes clock-dependent and Node 26 browser-storage test setup.
Translations, assets and database code are unchanged. Passing this check is
not a deployment receipt.

The Links sibling is pinned to
`43524f61e28d9bbd73be372ca8bc30feedddb8ad`, the existing main revision with
the stale technical banner removed. Its own immutable publication manifest
and reviewed candidate deltas are verified separately by the web workflow.

The workflow runs all existing unit tests with disposable PostgreSQL 17,
lint, typecheck, content and URL-shape checks, Next build, provider artifact-contract fixtures, and all existing Playwright tests. Local E2E uses port 4189;
`YULA_E2E_PORT` may select another isolated local port. Public URL reachability
is intentionally not requested. Every assertion remains in the baseline
test suites; local/browser results do not establish canonical hostname or
provider behavior.
The proof-ledger wheel test waits for the existing experience-ready signal
before input; its five-second scroll assertion and zero internal-scroll check
remain unchanged. Renderer startup is not part of that interaction assertion.

The separate Netlify CLI package and lockfile are removed from the candidate.
The installed-graph absence check rejects `netlify-cli`, `@netlify/images`,
`ipx`, `listhen` and `node-forge` anywhere in the owned pnpm installation. This
replaces validation of the removed CLI and its blobs/IPX consumers; it does
not claim that provider-managed build dependencies are absent. Production and
full-root audits keep their normal failure behavior.

Local CI builds Next, checks actual ISR output, runs all existing localhost
E2E tests and exercises Next's installed Sharp consumer with an in-memory
24x16 PNG to 12x8 WebP fixture. It does not claim a local Netlify packaging
result. A small native plugin at `.github/netlify/artifact-proof` runs the
existing artifact and render-mode contracts during the connected Netlify
build's `onPostBuild`, after core Functions/edge bundling and before the
adapter's publish-directory swap. No local CLI or deployment command is used.
Provider execution, runtime behavior and publication are separate gates.

The provider plugin passes Netlify's absolute Functions and edge output roots.
The validator rejects relative/traversing roots and symlinks, and preserves
exact ZIP path equality, package/runtime/generator identities, archive
integrity, safe member names, build-ID and registry byte parity and edge
checksums. It uses Python 3.11+ `tomllib`; the provider build must prove that
version. Build Node remains 26.9.0 and Functions runtime must be explicitly
`nodejs24.x`. Verify `AWS_LAMBDA_JS_RUNTIME=nodejs24.x` in the provider UI/API:
it cannot be established through `netlify.toml`. A missing runtime fails the
same contract rather than being inferred from the host Node version.

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
After a provider build packages its Functions and edge bundles, the native
plugin invokes the validator using the lifecycle output roots. Its console
receipt contains the actual artifact hashes; retain that build's exact source
identity and logs. Fixture PASS is not provider packaging acceptance. A local
artifact checker change does not establish a published source revision.

The two existing package-manager dependency audit gates remain mandatory:
`pnpm audit --prod --audit-level high` and `pnpm audit --audit-level high`.
The removed CLI tree is
replaced by installed-graph absence checks before and after tests. Both audits
retain normal failure behavior; no advisory is suppressed. These dependency
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

The current source-only toolchain candidate upgrades Tailwind to4.3.3 and the
PostCSS plugin to4.3.3, removes the Tailwind3 watcher/glob chain, and retains the
current theme plus owned base/spacing/gradient compatibility CSS. All existing
TSX route and component bodies and all existing tests remain unchanged.
Three new localhost style tests cover the real generated CSS; their execution
is still pending, including native Oxide/LightningCSS compatibility and mobile
computed styles. Tailwind4 requires Safari16.4+,Chrome111+,Firefox128+.

This candidate does not claim complete HIGH closure: the retained Next lint
preset still requires fast-glob/micromatch/braces, and the pinned Netlify
adapter bundles another braces implementation not visible in its package
manifest. The existing installed patch check and full-root audit remain active.
A supported lint replacement must retain all71 effective legacy rules;
dropping react/no-deprecated or hiding ESLint peer requirements is not an
accepted migration. Provider execution and publication remain blocked.

The source candidate pins Next and `eslint-config-next` to15.5.27 and the
Netlify adapter to5.16.2, following the [September30 provider guidance](https://www.netlify.com/changelog/2026-09-30-nextjs-react-security-vulnerabilities/).
The artifact contract and its fixtures now require the exact5.16.2 generator.
No lint rule was removed or reduced. The matching Next lint plugin still
requires fast-glob3.3.1; adapter5.16.2 still embeds unbounded braces3.0.3
through fast-glob3.3.3/micromatch4.0.8. These are separate remaining paths.
The native Oxlint1.87 Next replacement loses existing diagnostics for Head
import order, nested `_document/index` paths, JSX expression hrefs, and URL
percent decoding. Equal rule IDs and severities do not establish equivalent
checks; that replacement is not applied. The source version refresh is not
native execution, build, provider, or security-finding closure evidence.
