import type { CaseStudy } from "@/lib/case-studies";

/**
 * Published case studies — deliberately EMPTY today.
 *
 * The roadmap (§5.4) names the first two candidates and their preconditions:
 *
 *   LifeOS      — only once its sync/privacy AND revenue claims are verified.
 *                 The registry carries the encryption claim
 *                 (src/data/public-registry.ts, lifeos-on-device-encryption)
 *                 but no verified revenue claim exists, so the outcome
 *                 section has nothing the gate would accept.
 *   Braavolabs  — only once the native-spawn P0 is closed AND a PAID PILOT
 *                 RESULT exists. There is no paid pilot; the portfolio's
 *                 only recurring revenue today is elsewhere.
 *
 *   Burun Farkı's case is gated behind its per-prediction explainability
 *   wording being fully corrected at the source product.
 *
 * The machinery (schema, validator, routes, tests) is complete and the
 * surface renders its own emptiness honestly — the same pattern as the lead
 * backend, which shipped complete and switched off rather than shipping a
 * form the site could not yet stand behind. Adding an entry here means
 * satisfying src/lib/case-studies.ts, and tests/case-studies.test.ts asserts
 * the published set stays honest.
 */
export const caseStudies: CaseStudy[] = [];
