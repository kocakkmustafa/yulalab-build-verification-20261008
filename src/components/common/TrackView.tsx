"use client";

import { useEffect, useRef } from "react";
import { track } from "@/lib/analytics/client";
import type { EventName } from "@/lib/analytics/events";

/**
 * Fires a single view event when a page mounts.
 *
 * The `fired` ref is not defensive noise: React 19 StrictMode mounts
 * effects twice in development, and without the guard every local session
 * would report exactly double the product views — a bug that would look
 * like real traffic once the numbers were in a dashboard.
 */
export function TrackView({ event, product }: { event: EventName; product?: string }) {
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    track({ event, product });
  }, [event, product]);
  return null;
}
