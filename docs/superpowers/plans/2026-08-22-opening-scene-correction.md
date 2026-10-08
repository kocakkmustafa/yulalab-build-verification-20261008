# Opening Scene Correction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Correct the live homepage from first paint through closing so its loader handoff, centered glass Y, stage transitions, scroll ownership and responsive compositions match the approved Alche-reference choreography without changing YULA's truth or fallback contracts.

**Architecture:** Keep the persistent Canvas, registry composition and single scroll timeline. Extract loader phase math into a pure module, make the fresh-document intro deterministic and readiness-gated, give each semantic stage/panel exclusive visibility ownership, and retain the main page as the only desktop scroll owner. Correct opening and later compositions without duplicating truth or weakening static fallbacks.

**Tech Stack:** Next.js 15, React 19, TypeScript, CSS Modules, Three.js/R3F/Drei, Vitest, Playwright.

---

### Task 1: Lock the corrected loader phase contract

**Files:**
- Create: `src/components/experience/loader.ts`
- Modify: `src/components/experience/ExperienceLoader.tsx`
- Modify: `tests/experience-runtime.test.ts`

- [ ] **Step 1: Add failing unit assertions for the new phase order.**

Add assertions that `resolveLoaderFrame(0.35)` has construction lines but no flash, `resolveLoaderFrame(0.68)` has a strong flash, `resolveLoaderFrame(0.88)` still has zero exit opacity, and `resolveLoaderFrame(1)` has complete exit.

- [ ] **Step 2: Run the focused test and confirm the resolver is missing.**

Run: `pnpm test tests/experience-runtime.test.ts`
Expected: FAIL because `resolveLoaderFrame` does not exist.

- [ ] **Step 3: Implement the pure resolver and bind its values to CSS variables.**

Expose `resolveLoaderFrame(progress)` returning clamped `flat`, `depth`, `reveal`, `flash`, and `exit` values. Flash must peak before exit; exit must remain zero through progress `0.88`.

- [ ] **Step 4: Re-run the focused test.**

Run: `pnpm test tests/experience-runtime.test.ts`
Expected: PASS.

### Task 2: Make the opening replay and hand off without double glyphs

**Files:**
- Modify: `src/components/experience/YulaExperience.tsx`
- Modify: `src/components/experience/ExperienceLoader.tsx`
- Modify: `src/components/experience/Experience.module.css`
- Modify: `e2e/experience.spec.ts`

- [ ] **Step 1: Add a browser regression for the late handoff.**

At `/en?capture=1&progress=0&tier=low&loader=1&loaderProgress=.88`, assert the loader remains visually opaque and the underlying viewport is inert. At `.98`, assert the refractive layer is fading but the page still has one visible hero composition.

- [ ] **Step 2: Remove the session-storage skip and extend the readiness-gated timeline.**

Use a roughly `3.6s` construction and `0.9s` exit. Continue skipping the intro for reduced motion, compact height, forced static, unavailable WebGL and ordinary capture mode without `loader=1`.

- [ ] **Step 3: Add the clean-room refractive burst.**

Render CSS/SVG halo and chromatic rings driven by `--loader-flash`; suppress readouts and the blueprint at the burst peak, and delay loader transparency until the final phase.

- [ ] **Step 4: Run the loader E2E slice.**

Run: `pnpm exec playwright test e2e/experience.spec.ts --grep "loader|opening"`
Expected: PASS with no duplicate visible hero/loader glyph at the `.88` checkpoint.

### Task 3: Recompose the final hero frame

**Files:**
- Modify: `src/components/experience/ExperienceOverlay.tsx`
- Modify: `src/components/experience/Experience.module.css`
- Modify: `src/components/experience/layout.ts`
- Modify: `tests/experience-timeline.test.ts`
- Modify: `e2e/experience.spec.ts`

- [ ] **Step 1: Add failing geometry assertions.**

At progress `0` and a `1280×720` viewport, assert the glyph's desktop X offset is near zero and its opening scale multiplier is below the previous `0.84`. In Playwright, assert the right-side hero panel does not intersect a centered exclusion rectangle around the Y.

- [ ] **Step 2: Center and slightly reduce the opening Y.**

Change only the hero-strength portion of `glyphViewportPose`; all later proof, vision and closing positions must remain numerically unchanged.

- [ ] **Step 3: Replace the large left headline composition.**

Keep the canonical H1, lede and registry-derived notice visible, but render them in a compact right-side lab-status panel. Add restrained material/system labels around the physical wordmark and remove the heavy hero header divider.

- [ ] **Step 4: Add the dedicated mobile stack.**

At `390×844`, place the status panel below the centered visual zone, preserve 44px controls, and keep `scrollWidth === innerWidth`.

- [ ] **Step 5: Run layout and responsive tests.**

Run: `pnpm test tests/experience-timeline.test.ts && pnpm exec playwright test e2e/experience.spec.ts e2e/responsive.spec.ts`
Expected: PASS on desktop, phone and short-phone viewports.

### Task 4: Lift the glass material to the reference focal quality

**Files:**
- Modify: `src/components/experience/YulaGlyph.tsx`
- Modify: `src/components/experience/ExperienceWorld.tsx`
- Modify: `e2e/experience.spec.ts`

- [ ] **Step 1: Add a deterministic high-tier opening checkpoint.**

Capture `/en?capture=1&progress=0&tier=high` and assert Canvas readiness plus the hero-stage contract before screenshot comparison.

- [ ] **Step 2: Add a hero-only white caustic sweep.**

Drive a new shader uniform from the real hero opacity. Mix the existing cyan/violet caustic toward white only during the opening and keep SERVICE portal behavior unchanged.

- [ ] **Step 3: Tune existing lights, not renderer resolution.**

Increase the opening specular read using the existing lightformers and caustic layer. Do not raise DPR, FBO resolution, transmission samples or shadow maps.

- [ ] **Step 4: Run type and visual readiness checks.**

Run: `pnpm typecheck && pnpm exec playwright test e2e/experience.spec.ts --grep "hero|opening"`
Expected: PASS; high/medium/low modes retain one Canvas and no runtime error.

### Task 5: Remove full-screen and panel overlap at timeline boundaries

**Files:**
- Modify: `src/components/experience/timeline.ts`
- Modify: `src/components/experience/ExperienceOverlay.tsx`
- Modify: `tests/experience-timeline.test.ts`
- Modify: `e2e/experience.spec.ts`

- [ ] **Step 1: Replace overlap-locking assertions with exclusive ownership assertions.**

At HERO/WORKS, WORKS/PROOF, MISSION/VISION and VISION/VALUES boundaries, assert that no two semantic stages are simultaneously visible. Add product and value slot boundary checks, including mobile WORKS and values progress `0.895`.

- [ ] **Step 2: Make stage bands sequential and slot handoffs exclusive.**

Fade the outgoing semantic layer to zero before the incoming layer starts. Use the persistent Canvas as the visual bridge and keep `aria-hidden`, `inert` and pointer ownership aligned with the visible layer.

- [ ] **Step 3: Run pure and browser boundary tests.**

Run: `pnpm test tests/experience-timeline.test.ts && pnpm exec playwright test e2e/experience.spec.ts --grep "transition|panel|stage"`
Expected: PASS with no equal-opacity text or panel collisions.

### Task 6: Restore one scroll owner and compact Proof Ledger

**Files:**
- Modify: `src/components/experience/Experience.module.css`
- Modify: `src/components/experience/ExperienceOverlay.tsx`
- Modify: `e2e/experience.spec.ts`

- [ ] **Step 1: Add a wheel-ownership regression.**

Place the pointer over the proof grid at desktop progress `0.55`, wheel forward, and assert that document progress advances while the grid has no independent scroll range.

- [ ] **Step 2: Remove desktop nested scrolling and fit the proof surface.**

Compact type, spacing and provenance rows for the immersive proof beat. Preserve complete registry-derived proof in the static/fallback document and keep keyboard focus treatment meaningful.

- [ ] **Step 3: Verify desktop and tablet proof compositions.**

Run: `pnpm exec playwright test e2e/experience.spec.ts e2e/responsive.spec.ts --grep "proof|scroll"`
Expected: PASS at `1280x720`, `1440x900` and tablet widths with the document as sole scroll owner.

### Task 7: Correct crossing, portal, values and closing compositions

**Files:**
- Modify: `src/components/experience/timeline.ts`
- Modify: `src/components/experience/YulaGlyph.tsx`
- Modify: `src/components/experience/ValueDioramas.tsx`
- Modify: `src/components/experience/VisionServicePortal.tsx`
- Modify: `src/components/experience/Experience.module.css`
- Modify: `tests/experience-timeline.test.ts`
- Modify: `e2e/experience.spec.ts`
- Modify: `e2e/responsive.spec.ts`

- [ ] **Step 1: Lock the audited checkpoints.**

Add assertions for no stale Proof UI at `0.68`, no MISSION/VISION collision at `0.765`, no rectangular portal boundary at `0.82`, legible values at `0.90`, and deliberate closing separation at `1`.

- [ ] **Step 2: Tune composition without increasing renderer cost.**

Correct the crossing camera/glyph framing, feather SERVICE portal sampling inside the Y, reduce and dim the values sphere, strengthen the panel glass backdrop, and adjust final wordmark scale/position. Do not raise DPR, FBO size, MSAA, transmission samples or shadow resolution.

- [ ] **Step 3: Compare the full deterministic journey.**

Inspect progress `0.505`, `0.60`, `0.69`, `0.765`, `0.82`, `0.90` and `1` at desktop and short-phone sizes.

### Task 8: Stabilize the live Canvas without regressing fallback performance

**Files:**
- Modify: `src/components/experience/ExperienceCanvas.tsx`
- Modify: `src/components/experience/YulaExperience.tsx`
- Modify: `src/components/experience/useExperienceProgress.ts`
- Create: `tests/experience-canvas-loop.test.ts`
- Modify: `tests/experience-runtime.test.ts`
- Modify: `vitest.config.mts`
- Modify: `e2e/accessibility.spec.ts`
- Modify: `e2e/experience.spec.ts`

- [ ] **Step 1: Reproduce the idle-frame compositor failure.**

After the opening settles, take repeated Canvas screenshots and assert that the rendered hero remains non-empty and stable rather than alternating with a blank frame.

- [ ] **Step 2: Keep the immersive renderer refresh contract explicit.**

Use R3F demand rendering with a bounded visible warmup and event-driven invalidation. Keep scroll progress RAF work dormant whenever its target is settled. Static, reduced-motion, compact and unavailable-WebGL paths must continue to run no Canvas loop. Cap Vitest workers so the repository's real Postgres-backed suites cannot oversubscribe local/CI database connections. Reuse Playwright's managed browser fixture for isolated 3D accessibility contexts instead of launching a nested Chromium process per checkpoint.

- [ ] **Step 3: Re-run runtime and performance gates.**

Run: `pnpm test tests/experience-runtime.test.ts && pnpm exec playwright test e2e/experience.spec.ts --grep "canvas|idle|opening"`
Expected: repeated settled captures remain populated; fallback modes remain loop-free.

### Task 9: Verify the complete journey and release

**Files:**
- Modify after acceptance: `docs/superpowers/specs/2026-08-21-reference-faithful-3d-homepage-design.md`
- Modify after live acceptance: `../workspace/EVIDENCE-LEDGER.md`
- Modify after live acceptance: `../../../knowledge/Yula Lab/20 Şirketler/Yulalab/📊 Durum & Deploy Panosu.md`

- [ ] **Step 1: Compare deterministic desktop and mobile checkpoints.**

Inspect loader `0.35/0.68/0.88`, hero `0`, WORKS `0.10/0.30/0.49`, VISION `0.805`, SERVICE `0.88` and closing `1`. Check occlusion, negative space, typography, overflow and console errors.

- [ ] **Step 2: Run proportional and full gates.**

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm verify:claims && pnpm verify:links && pnpm verify:claims:local && pnpm verify:render-mode && pnpm build && pnpm test:e2e && pnpm audit --prod --audit-level high && git diff --check`
Expected: every command exits `0`.

- [ ] **Step 3: Commit, push and open a reviewed PR.**

Stage only the files named by this plan. Push `codex/3d-opening-correction`, attach exact test/browser evidence, and merge to `main` only after diff and independent review.

- [ ] **Step 4: Verify Vercel production and record rollback evidence.**

Confirm the production deployment commit equals merged `origin/main`; inspect `/` and `/en` opening plus later checkpoints. Append commit, PR, deployment, tests, browser evidence and previous-main rollback SHA to the evidence ledger and vault notes.
