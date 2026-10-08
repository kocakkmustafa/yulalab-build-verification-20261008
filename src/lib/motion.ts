/**
 * Shared motion vocabulary. Every entering element uses ease-out (arrives
 * eagerly, settles gently); every exiting element uses ease-in and roughly
 * half the duration — the outgoing element is never the focus.
 */
export const EASE_OUT = [0.16, 1, 0.3, 1] as const;
export const EASE_IN = [0.7, 0, 1, 1] as const;

export const DURATION = {
  /** Hover/press micro-feedback on cards, pills, buttons. */
  micro: 0.2,
  /** Route-level exit — brief, so the incoming page reads as the focus. */
  pageExit: 0.2,
} as const;

/** Sharp, non-bouncy spring for card/pill hover-lift — a "cool" but restrained lift. */
export const HOVER_SPRING = { type: "spring", stiffness: 400, damping: 30 } as const;
