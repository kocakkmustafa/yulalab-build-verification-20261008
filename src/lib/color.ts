/**
 * Named alpha steps for the `brandColor + ALPHA.step` pattern used across
 * the per-project showcase (brand colors are runtime values, so they can't
 * be Tailwind classes — this is the dynamic-color equivalent of the
 * surface/hairline tokens in tailwind.config.ts). Pick by role, not by eye:
 * every call site making the same "how transparent" decision independently
 * is what made ~25 slightly-different alpha values accumulate before this.
 */
export const ALPHA = {
  faint: "06",
  subtle: "08",
  soft: "12",
  moderate: "15",
  medium: "20",
  strong: "33",
  heavy: "55",
  bold: "80",
  solid: "99",
  near: "B0",
  almost: "CC",
} as const;

/**
 * JS-side mirror of the `hairline` Tailwind color (tailwind.config.ts) —
 * for Framer Motion `initial`/`style` values, which need a real color
 * string rather than a class name.
 */
export const HAIRLINE = "rgba(255,255,255,0.10)";
