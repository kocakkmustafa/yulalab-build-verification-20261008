"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { QualityTier } from "./types";

export type CaptureParams = {
  enabled: boolean;
  progress: number;
  tier: QualityTier | null;
  loader: boolean;
  loaderProgress: number;
};

const QUALITY_TIERS = new Set<QualityTier>(["high", "medium", "low"]);
const EMPTY_CAPTURE: CaptureParams = {
  enabled: false,
  progress: 0,
  tier: null,
  loader: false,
  loaderProgress: 0,
};

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function parseFinite(value: string | null, fallback: number): number | null {
  if (value === null) return fallback;
  if (value.trim() === "") return null;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseCaptureParams(search: string): CaptureParams {
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  } catch {
    return { ...EMPTY_CAPTURE };
  }

  const rawProgress = parseFinite(params.get("progress"), 0);
  const rawLoaderProgress = parseFinite(params.get("loaderProgress"), 0);
  const tierValue = params.get("tier");
  const tier =
    tierValue !== null && QUALITY_TIERS.has(tierValue as QualityTier)
      ? (tierValue as QualityTier)
      : null;
  const enabled = params.get("capture") === "1" && rawProgress !== null;

  return {
    enabled,
    progress: clamp01(rawProgress ?? 0),
    tier,
    loader: enabled && params.get("loader") === "1",
    loaderProgress: clamp01(rawLoaderProgress ?? 0),
  };
}

function readDocumentProgress(): number {
  const scrollRange = document.documentElement.scrollHeight - window.innerHeight;
  if (!Number.isFinite(scrollRange) || scrollRange <= 0) return 0;
  return clamp01(window.scrollY / scrollRange);
}

type DampedValue = { position: number; velocity: number };

function criticallyDampedStep(
  current: DampedValue,
  target: number,
  deltaSeconds: number,
): DampedValue {
  const angularFrequency = 12;
  const displacement = current.position - target;
  const decay = Math.exp(-angularFrequency * deltaSeconds);
  const carry = (current.velocity + angularFrequency * displacement) * deltaSeconds;
  const position = target + (displacement + carry) * decay;
  const velocity = (current.velocity - angularFrequency * carry) * decay;

  if (Math.abs(target - position) < 0.00001 && Math.abs(velocity) < 0.00001) {
    return { position: target, velocity: 0 };
  }

  return { position: clamp01(position), velocity };
}

export function useExperienceProgress(enabled: boolean): {
  progress: number;
  capture: CaptureParams;
  scrollRange: number;
} {
  const capture = useMemo(
    () =>
      typeof window === "undefined"
        ? { ...EMPTY_CAPTURE }
        : parseCaptureParams(window.location.search),
    [],
  );
  const initialProgress = capture.enabled ? capture.progress : 0;
  const [progress, setProgress] = useState(initialProgress);
  const [scrollRange, setScrollRange] = useState(0);
  const position = useRef(initialProgress);
  const velocity = useRef(0);

  useEffect(() => {
    if (capture.enabled) {
      position.current = capture.progress;
      velocity.current = 0;
      setProgress(capture.progress);
      return;
    }

    if (!enabled) {
      position.current = 0;
      velocity.current = 0;
      setProgress((current) => (current === 0 ? current : 0));
      return;
    }

    let animationFrame = 0;
    let previousTimestamp: number | null = null;
    let target = readDocumentProgress();

    const tick = (timestamp: number) => {
      animationFrame = 0;
      const elapsed =
        previousTimestamp === null ? 1 / 60 : (timestamp - previousTimestamp) / 1_000;
      const deltaSeconds = Math.min(1 / 15, Math.max(1 / 240, elapsed));
      const next = criticallyDampedStep(
        { position: position.current, velocity: velocity.current },
        target,
        deltaSeconds,
      );
      position.current = next.position;
      velocity.current = next.velocity;

      previousTimestamp = timestamp;
      setProgress((current) =>
        Math.abs(current - position.current) < 0.000001 ? current : position.current,
      );
      if (next.position !== target || next.velocity !== 0) {
        animationFrame = requestAnimationFrame(tick);
      } else {
        previousTimestamp = null;
      }
    };

    const wake = () => {
      setScrollRange(Math.max(0, document.documentElement.scrollHeight - window.innerHeight));
      target = readDocumentProgress();
      if (animationFrame !== 0) return;
      previousTimestamp = null;
      animationFrame = requestAnimationFrame(tick);
    };

    const resizeObserver = typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(wake);

    window.addEventListener("scroll", wake, { passive: true });
    window.addEventListener("resize", wake);
    window.addEventListener("pageshow", wake);
    resizeObserver?.observe(document.documentElement);
    wake();

    return () => {
      window.removeEventListener("scroll", wake);
      window.removeEventListener("resize", wake);
      window.removeEventListener("pageshow", wake);
      resizeObserver?.disconnect();
      if (animationFrame !== 0) cancelAnimationFrame(animationFrame);
    };
  }, [capture.enabled, capture.progress, enabled]);

  return {
    progress: capture.enabled ? capture.progress : progress,
    capture,
    scrollRange,
  };
}
