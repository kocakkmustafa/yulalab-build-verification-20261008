# Reference-Faithful 3D Homepage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the localized YULA homepage with a production-safe, reference-faithful continuous 3D portfolio journey while preserving the existing public truth, analytics, SEO, locale, and accessibility contracts.

**Architecture:** The locale page remains a server data composer. A client experience shell owns one normalized progress stream, a fixed semantic DOM overlay, deterministic capture mode, and a dynamically loaded persistent R3F canvas. Pure timeline evaluation drives separate desktop/mobile camera tracks and every scene/overlay transition; reduced-motion or WebGL failure renders the same content as a static semantic journey.

**Tech Stack:** Next.js 15, React 19, TypeScript 5.7, next-intl, Tailwind CSS, CSS Modules, Three.js 0.185, React Three Fiber 9.7, Drei 10.7, Framer Motion, Vitest, Playwright, axe, Vercel.

---

## File structure

- `src/components/experience/types.ts` — serializable experience contracts and quality/timeline types.
- `src/components/experience/timeline.ts` — pure stage, interpolation, product-index, and desktop/mobile camera evaluation.
- `tests/experience-timeline.test.ts` — deterministic boundary, continuity, and product-order tests.
- `src/components/experience/quality.ts` — initial tier detection and one-way downgrade policy.
- `src/components/experience/useExperienceProgress.ts` — the only scroll reader and capture-mode parser.
- `src/components/experience/audio.ts` — opt-in procedural ambient audio lifecycle.
- `src/components/experience/ExperienceErrorBoundary.tsx` — Canvas/context failure isolation.
- `src/components/experience/YulaExperience.tsx` — loader, shell, readiness, sound, Canvas/static selection.
- `src/components/experience/ExperienceLoader.tsx` — architectural SVG/Y construction loader.
- `src/components/experience/ExperienceOverlay.tsx` — fixed semantic hero/product/proof/manifesto/values/closing UI.
- `src/components/experience/StaticExperience.tsx` — reduced-motion/WebGL/JS-safe linear experience.
- `src/components/experience/ExperienceCanvas.tsx` — R3F Canvas configuration and runtime quality governor.
- `src/components/experience/ExperienceWorld.tsx` — shared environment, room, camera, and scene composition.
- `src/components/experience/CameraRig.tsx` — applies pure timeline camera position/look target.
- `src/components/experience/GridRoom.tsx` — curved grid, halftone, lighting, and theme interpolation.
- `src/components/experience/YulaGlyph.tsx` — beveled Y geometry and tier-aware refractive/fallback material.
- `src/components/experience/PortfolioField.tsx` — stable card identities, real texture loading, honest research surfaces, proof morph.
- `src/components/experience/ValueDioramas.tsx` — four canonical value scenes.
- `src/components/experience/Experience.module.css` — scroll height, fixed layers, overlay choreography, loader, mobile, reduced-motion.
- `src/app/[locale]/page.tsx` — maps locale, projects, and public registry into the experience.
- `src/components/layout/Header.tsx` and `Footer.tsx` — suppress duplicate global chrome only on localized home routes.
- `src/app/globals.css` — homepage body/theme integration and no-overflow safeguards.
- `messages/tr.json` and `messages/en.json` — localized experience labels and trust copy.
- `e2e/experience.spec.ts` — capture checkpoints, truth labels, fallback/reduced-motion, and real HUD regression checks.
- `package.json` and `pnpm-lock.yaml` — Three/R3F/Drei dependencies.

### Task 1: Lock the timeline contract with tests

**Files:**
- Create: `src/components/experience/types.ts`
- Create: `src/components/experience/timeline.ts`
- Create: `tests/experience-timeline.test.ts`

- [ ] **Step 1: Write failing tests for stage boundaries, eight product slots, endpoint continuity, and mobile/desktop divergence.**

The tests must assert exact stage names at `0`, `0.085`, `0.505`, `0.575`, `0.690`, `0.765`, `0.835`, `0.955`, and `1`; product indices `0…7` at the centers of the portfolio interval; finite camera vectors; and different mobile/desktop camera positions at the same non-zero progress.

- [ ] **Step 2: Run the isolated test and confirm the module is missing.**

Run: `pnpm test tests/experience-timeline.test.ts`
Expected: FAIL because `evaluateTimeline` and its types do not exist.

- [ ] **Step 3: Implement the pure evaluator.**

Expose this stable interface:

```ts
export function evaluateTimeline(progress: number, mode: "desktop" | "mobile"): TimelineFrame;
export function segmentProgress(progress: number, start: number, end: number): number;
export function interpolateKeyframes(keys: readonly CameraKey[], progress: number): CameraPose;
```

Use clamped smoothstep for local transitions, Catmull-Rom interpolation for camera positions, linear interpolation for look targets, and explicit stage ranges from the approved spec.

- [ ] **Step 4: Run the isolated test.**

Run: `pnpm test tests/experience-timeline.test.ts`
Expected: PASS; no NaN/Infinity and all eight product centers map in canonical order.

### Task 2: Add dependencies and quality/progress foundations

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Create: `src/components/experience/quality.ts`
- Create: `src/components/experience/useExperienceProgress.ts`
- Create: `src/components/experience/audio.ts`
- Create: `src/components/experience/ExperienceErrorBoundary.tsx`

- [ ] **Step 1: Install the exact React-19-compatible scene dependencies.**

Run: `pnpm add three@0.185.1 @react-three/fiber@9.7.0 @react-three/drei@10.7.8 && pnpm add -D @types/three@0.183.1`
Expected: lockfile changes contain only the scene dependency graph plus compatible transitive packages.

- [ ] **Step 2: Implement deterministic capture parsing and one-way quality downgrade.**

`parseCaptureParams(search)` accepts only progress `0…1` and tiers `high|medium|low`; malformed values fall back to live scroll. `detectInitialTier()` considers WebGL2, DPR, viewport area, hardware concurrency, and device memory. `downgradeTier()` returns `medium`, then `low`, then remains `low`.

- [ ] **Step 3: Implement the single scroll loop.**

The hook calculates `window.scrollY / (documentElement.scrollHeight - innerHeight)` inside one `requestAnimationFrame`. Live mode performs one critically damped interpolation; capture and reduced-motion modes return exact values with no animation.

- [ ] **Step 4: Implement gesture-only WebAudio.**

Create a quiet filtered oscillator/noise bed only from `enable()`, retain all nodes in a closure, ramp gain on toggle, and close the context on `dispose()`. No autoplay or downloaded audio asset.

- [ ] **Step 5: Typecheck foundations.**

Run: `pnpm typecheck`
Expected: PASS.

### Task 3: Build the semantic shell first

**Files:**
- Create: `src/components/experience/ExperienceLoader.tsx`
- Create: `src/components/experience/ExperienceOverlay.tsx`
- Create: `src/components/experience/StaticExperience.tsx`
- Create: `src/components/experience/YulaExperience.tsx`
- Create: `src/components/experience/Experience.module.css`
- Modify: `src/app/[locale]/page.tsx`
- Modify: `messages/tr.json`
- Modify: `messages/en.json`

- [ ] **Step 1: Add localized copy without duplicating product truth.**

Add loader, lifecycle, proof, values, sound, scroll, research CTA, trust, and fallback labels under one `experience` namespace. Mission/vision/value bodies must come from canonical `company`/existing message copy, not rewritten claims.

- [ ] **Step 2: Compose serializable product data on the server.**

For each canonical `projects` entry, join its matching `publicRegistry` record and pass lifecycle, real screenshots, claim provenance, brand colors, internal route, and localized text. Throw during render if a product lacks its registry pair so omissions fail closed.

- [ ] **Step 3: Render every essential item in semantic DOM.**

The overlay/static components include one H1, all eight project names and routes, written lifecycle labels, research “no public build”, proof source/scope/date, four value headings, mission, vision, trust navigation, contact, and legal links. Decorative layers use `aria-hidden`.

- [ ] **Step 4: Add the automatic architectural loader and session behavior.**

Animate SVG axes/circles/wireframe Y to glass for approximately four seconds. Skip on capture/reduced mode. Mark completion in `sessionStorage` after the first successful run.

- [ ] **Step 5: Verify server/accessibility behavior before Canvas exists.**

Run: `pnpm typecheck && pnpm test`
Expected: PASS; homepage content tests find all eight names and a single H1.

### Task 4: Implement the persistent WebGL world

**Files:**
- Create: `src/components/experience/ExperienceCanvas.tsx`
- Create: `src/components/experience/ExperienceWorld.tsx`
- Create: `src/components/experience/CameraRig.tsx`
- Create: `src/components/experience/GridRoom.tsx`
- Create: `src/components/experience/YulaGlyph.tsx`
- Create: `src/components/experience/PortfolioField.tsx`
- Create: `src/components/experience/ValueDioramas.tsx`

- [ ] **Step 1: Configure one Canvas and world.**

Use a perspective camera, logarithmic depth disabled, alpha false, ACES tone mapping, sRGB output, and tier-specific DPR. Add `Environment`/`Lightformer` lighting, fog, and `PerformanceMonitor` that can only downgrade the parent tier.

- [ ] **Step 2: Apply camera poses from the pure evaluator.**

`CameraRig` copies the evaluated position and looks at the evaluated target each frame. It must not add another spring or translate the entire world by scroll.

- [ ] **Step 3: Build the curved grid room and physical crossing.**

Use a partial cylinder/grid material, halftone depth panels, the background YULA wordmark, and a blade prism whose transform/color are derived from `whiteMix`. Depth test must place the Y and product cards in front of the wordmark.

- [ ] **Step 4: Build the tier-aware Y.**

Use beveled components with high/medium physical transmission and low-tier chrome/frost fallback. Drive position/rotation/scale/material mix only from the timeline. Add subtle cyan/magenta edge shells.

- [ ] **Step 5: Build stable portfolio card meshes and proof morph.**

Keep eight keyed mesh groups for the whole journey. Load only registry screenshot paths, preserve each texture's aspect ratio, and catch per-texture failure. Procedural research cards show open wireframes, not UI. Interpolate the same groups from arc poses to proof-grid poses.

- [ ] **Step 6: Build the four value dioramas and closing geometry.**

Implement Transparency/Burun Farkı, Craft/Braavo, Privacy/LifeOS core, and Science/calibration scenes. Fade/orbit by timeline value index; draw closing axes/grid while moving Y left.

- [ ] **Step 7: Run typecheck and production build.**

Run: `pnpm typecheck && pnpm build`
Expected: PASS; `/` and `/en` compile and all prior routes remain generated.

### Task 5: Integrate homepage-only chrome and responsive/reduced behavior

**Files:**
- Modify: `src/components/layout/Header.tsx`
- Modify: `src/components/layout/Footer.tsx`
- Modify: `src/app/globals.css`
- Modify: `src/components/experience/Experience.module.css`

- [ ] **Step 1: Suppress duplicate chrome only on localized home paths.**

Use the existing locale-stripping route logic. Other routes must render the unchanged global Header/Footer. Home keeps equivalent navigation and legal links inside the experience.

- [ ] **Step 2: Add desktop/mobile overlay compositions.**

Desktop uses left/right technical gutters and wide cards. Mobile uses compact bottom/upper safe zones, larger touch targets, and the mobile camera track. Neither composition horizontally scrolls at 320px.

- [ ] **Step 3: Make reduced motion fully static.**

Under `prefers-reduced-motion`, skip loader and Canvas, remove fixed 2520vh behavior, and render sequential DOM sections. All text has opacity 1 and transforms none.

- [ ] **Step 4: Preserve focus, contrast, and page chrome on other routes.**

Run: `pnpm lint && pnpm typecheck && pnpm test`
Expected: PASS.

### Task 6: Add deterministic browser acceptance tests

**Files:**
- Create: `e2e/experience.spec.ts`
- Modify: `e2e/accessibility.spec.ts`
- Modify: `e2e/responsive.spec.ts`

- [ ] **Step 1: Test deterministic checkpoints.**

Open `/?capture=1&progress=0&tier=high`, then representative portfolio, proof, crossing, manifesto, values, and closing progress values. Assert `data-experience-ready`, stage names, active product/status, white mix, and no application error.

- [ ] **Step 2: Test truth and fake-telemetry regressions.**

Assert canonical order, research labels/CTA, source/scope/date fields, and absence of `HIGH / 60`, `DRAG`, and fake sine telemetry. Assert HUD render tier/progress/product values update from capture progress.

- [ ] **Step 3: Test reduced-motion and no-WebGL fallback.**

Reduced-motion must have no canvas/loader, all eight product links, mission/vision/values, and no hidden copy. A browser context with WebGL contexts forced to `null` must render the static journey.

- [ ] **Step 4: Extend responsive and axe coverage.**

Add `/` at 320, 390, 768, 1440 and `/en` to overflow checks. Scan the home in capture and reduced modes; serious/critical violations remain zero.

- [ ] **Step 5: Run full local gates.**

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm verify:claims && pnpm verify:links && pnpm verify:claims:local && pnpm verify:render-mode && pnpm build && pnpm test:e2e && pnpm audit --prod --audit-level high`
Expected: every command exits 0.

### Task 7: Visual comparison and production delivery

**Files:**
- Create: `evidence/3d-homepage/` screenshots and QA notes as non-source artifacts when appropriate
- Modify: `ventures/yulalab-com/workspace/EVIDENCE-LEDGER.md` after live acceptance
- Modify: active Yulalab Obsidian handoff note after live acceptance

- [ ] **Step 1: Capture desktop and mobile checkpoints.**

Use deterministic capture URLs for loader, hero, product, proof, crossing, mission, values, and closing. Compare composition, occlusion, camera direction, negative space, card aspect ratio, and transition continuity against the saved reference evidence.

- [ ] **Step 2: Fix visual gaps and re-run proportional gates.**

Any scene/timeline change reruns timeline tests, typecheck, build, and affected Playwright cases; any content/registry change reruns claim validators and full E2E.

- [ ] **Step 3: Commit and push the feature branch.**

Run: `git diff --check && git status --short && git add <approved files> && git commit -m "feat(home): launch reference-faithful 3d portfolio" && git push -u origin codex/3d-reference-homepage`
Expected: clean branch head exists remotely and contains no unrelated `main` worktree changes.

- [ ] **Step 4: Create and merge a reviewed PR.**

Create the PR against `main`, attach local gate evidence, wait for available checks, verify the remote diff, and merge server-side. Do not touch/stash/reset the dirty local `main` worktree.

- [ ] **Step 5: Verify Vercel production.**

Confirm the deployment commit matches merged `main`, then smoke-test `https://yulalab.com` and `/en` on desktop/mobile for stage readiness, console/network errors, locale routes, product links, and fallback content.

- [ ] **Step 6: Record the milestone.**

Append exact commit, PR, Vercel deployment, test counts, browser evidence, rollback SHA, and remaining limitations to the evidence ledger and update the active Yulalab vault handoff with preserved frontmatter/wikilinks.

## 2026-08-22 final implementation addendum

The shipped candidate keeps the original truth, locale and single-progress contracts while advancing the observed reference choreography in these ways:

- the loader now resolves through wire, depth/glass and a readiness-gated exit;
- WORKS uses orbiting meshes plus a lazy, crossfading screen-space atmosphere;
- VISION hands off through a capped offscreen Y portal into a curved SERVICE corridor;
- the physical Y fades during the outro and a giant solid white `YULA` wordmark becomes the final focal plane;
- short phone, tablet and desktop heights have explicit wordmark/content separation rules;
- reduced-motion, compact-height, no-WebGL and no-JS paths expose the complete linear document without a scroll RAF or Canvas;
- R3F's automatic root render owns the final frame after lifecycle/theme, camera, panel-uniform and portal-FBO preparation callbacks;
- social image generation is static, warning-free and independent of dynamic font glyph fallback.

### Current local evidence

- `pnpm lint`: PASS, zero lint warnings/errors.
- `pnpm typecheck`: PASS.
- `pnpm build`: PASS, 60 static pages, no build warnings; public registry contains 8 products and TR/EN copy has 491/491-key parity.
- `pnpm test`: PASS, 44 files and 770/770 tests.
- `pnpm test:e2e`: PASS, 171/171 Chromium tests, including real high-tier glass pixels, loader containment, exclusive visual/semantic panel and full-stage boundaries, TR/EN visible-label accessible names, 1280×560 / 1366×600 / 1366×601 no-clipping closing geometry, serious/critical Axe checks, reduced motion, WebGL failure, no-JS, 404 metadata and the PNG social-image endpoint.
- `pnpm verify:links`: PASS, 4/4 public links reachable.
- `pnpm verify:render-mode`: PASS, 20 time-derived routes retain 900-second revalidation.
- `pnpm audit --prod --audit-level high`: PASS, no known vulnerabilities.
- High-tier visual checkpoints were inspected at 1440x900, 1366x768, 768x1024, 390x844 and 390x667.
- Independent source audits: render sequence PASS, performance PASS, visual/accessibility PASS, release diff clean after duplicate draft removal.

### Remaining release gates

- [ ] Commit the explicitly selected source/test/document files; do not use blind `git add -A`.
- [ ] Push the isolated branch and create the reviewed PR.
- [ ] Merge to `main` under the founder's existing release approval and monitor Vercel.
- [ ] Verify both locales and representative desktop/mobile checkpoints on the deployed commit.
- [ ] Record commit, PR, deployment and rollback evidence in the workspace ledger and Yulalab vault handoff.
