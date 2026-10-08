"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { usePathname } from "@/i18n/navigation";
import { DURATION, EASE_IN } from "@/lib/motion";

/**
 * Route-level exit choreography. Entry is already handled by the `.page-enter`
 * CSS keyframe on each page's root element — this only adds the piece CSS
 * can't: a brief fade for the page that's LEAVING, so navigation reads as a
 * scene change instead of a hard cut. Kept deliberately minimal (opacity
 * only, ~half the entry duration) so it never competes with the incoming
 * page for attention.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        exit={
          reduceMotion
            ? { opacity: 1 }
            : { opacity: 0, transition: { duration: DURATION.pageExit, ease: EASE_IN } }
        }
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
