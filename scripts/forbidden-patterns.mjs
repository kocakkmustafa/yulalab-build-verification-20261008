// The named false-statement patterns the prose scanner refuses.
//
// Its own module, imported by both the scanner and the Operating System page
// (which states how many there are). Previously the page re-parsed the
// scanner's SOURCE TEXT to count them, and the test re-implemented that same
// parse and asserted the two agreed — a tautology that could not see a wrong
// parser. Proven live: a real 13th pattern at a different indentation left
// the scanner at 13, the page printing 12, and the suite green.
//
// Importing the scanner directly is not an option either: it runs on import
// and calls process.exit.
export const FORBIDDEN = [
  { pattern: /venture studio/i, note: "brand category roadmap §1.1 forbids — use 'product lab'" },
  { pattern: /girişim stüdyosu/i, note: "brand category roadmap §1.1 forbids — use 'ürün laboratuvarı'" },
  { pattern: /\bthree products\b/i, note: "stale product count (site has 8) — drop the number or state the real count" },
  { pattern: /üç ürün(?:ümüz)?(?:ün|ü)?\b/i, note: "stale product count (site has 8) — drop the number or state the real count" },
  { pattern: /\bshap\b/i, note: "Burun Farkı's per-prediction bars are synthetic (verified 2026-08-19, see EVIDENCE-LEDGER) — do not claim SHAP" },
  { pattern: /unlimited combinations/i, note: "Braavolabs has a finite step/depth cap (MAX_STEPS_PER_RUN=50) — 'unlimited' is not accurate" },
  { pattern: /sınırsız birleşim/i, note: "Braavolabs has a finite step/depth cap — 'sınırsız' is not accurate" },
  { pattern: /compliant with[^.]*(kvkk|gdpr)/i, note: "blanket compliance-certification language roadmap §1.1 forbids" },
  { pattern: /bütün ürünler(?:imiz)?[^.]*(kvkk|gdpr)[^.]*kapsamındadır/i, note: "blanket categorical KVKK/GDPR claim roadmap §1.1 forbids" },
  { pattern: /\b12 LLM\b/i, note: "Braavolabs has 14 LLM providers as of 2026-08-19 (ai-client.ts) — '12' is the pre-Y-P0-003 stale count" },
  { pattern: /\bIFS\b.{0,40}(çerçeve|framework)/i, note: "IFS was searched for across ventures/lifeos/ and not found (verified 2026-08-19) — do not cite it as a shipped framework" },
  { pattern: /İkigai|Ikigai/i, note: "Ikigai was searched for across ventures/lifeos/ and not found (verified 2026-08-19) — do not cite it as a shipped framework" },
];
