export type LoaderFrame = {
  progress: number;
  flat: number;
  depth: number;
  reveal: number;
  flash: number;
  exit: number;
};

const MAX_VISIBLE_FRAME_DELTA_MS = 100;

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function smoothstep(value: number): number {
  const x = clamp01(value);
  return x * x * (3 - 2 * x);
}

function pulse(
  progress: number,
  start: number,
  peak: number,
  end: number,
): number {
  if (progress <= start || progress >= end) return 0;
  if (progress <= peak) {
    return smoothstep((progress - start) / (peak - start));
  }
  return smoothstep((end - progress) / (end - peak));
}

/**
 * Pure opening phase contract used by both runtime animation and deterministic
 * capture. Construction resolves first, refraction flashes second, and the
 * opaque loader does not release the live scene until the final ten percent.
 */
export function resolveLoaderFrame(value: number): LoaderFrame {
  const progress = clamp01(value);
  return {
    progress,
    flat: smoothstep(progress / 0.4),
    depth: smoothstep((progress - 0.2) / 0.46),
    reveal: smoothstep((progress - 0.3) / 0.36),
    flash: pulse(progress, 0.52, 0.68, 0.94),
    exit: smoothstep((progress - 0.9) / 0.1),
  };
}

/**
 * Browser RAF pauses or throttles in a background tab. Clamp the first frame
 * after resuming and ignore frames that are still hidden so background time
 * can never consume the WebGL readiness timeout.
 */
export function resolveVisibleFrameDelta(
  now: number,
  previous: number | null,
  visibility: DocumentVisibilityState,
): number {
  if (
    visibility !== "visible"
    || previous === null
    || !Number.isFinite(now)
    || !Number.isFinite(previous)
  ) {
    return 0;
  }

  return Math.min(
    MAX_VISIBLE_FRAME_DELTA_MS,
    Math.max(0, now - previous),
  );
}
