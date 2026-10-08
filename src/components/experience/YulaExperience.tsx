"use client";

import dynamic from "next/dynamic";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
} from "react";
import { createAmbientAudio, type AmbientAudioController } from "./audio";
import { ExperienceErrorBoundary } from "./ExperienceErrorBoundary";
import { ExperienceLoader } from "./ExperienceLoader";
import { resolveVisibleFrameDelta } from "./loader";
import { ExperienceOverlay } from "./ExperienceOverlay";
import { detectExperienceCapabilities } from "./quality";
import { StaticExperience } from "./StaticExperience";
import { evaluateTimeline, STAGES } from "./timeline";
import type {
  ExperienceCopy,
  ExperienceMode,
  ExperienceProduct,
  QualityTier,
} from "./types";
import { useExperienceProgress } from "./useExperienceProgress";
import styles from "./Experience.module.css";

type ExperienceCanvasProps = {
  products: ExperienceProduct[];
  progress: number;
  mode: ExperienceMode;
  tier: QualityTier;
  onTierChange: (tier: QualityTier) => void;
  onReady: () => void;
  onContextLost: () => void;
};

const ExperienceCanvas = dynamic<ExperienceCanvasProps>(
  () =>
    import("./ExperienceCanvas").then(
      (module) => module.ExperienceCanvas as ComponentType<ExperienceCanvasProps>,
    ),
  { ssr: false, loading: () => null },
);

type YulaExperienceProps = {
  products: ExperienceProduct[];
  copy: ExperienceCopy;
};

type WebGLState = "checking" | "available" | "unavailable";

const LOADER_DRAW_DURATION_MS = 3_600;
const LOADER_EXIT_DURATION_MS = 900;
const LOADER_CANVAS_TIMEOUT_MS = LOADER_DRAW_DURATION_MS + 6_000;
const LOADER_HOLD_PROGRESS = 0.9;
const TIER_ORDER: Record<QualityTier, number> = { high: 0, medium: 1, low: 2 };

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [query]);

  return matches;
}

export function YulaExperience({ products, copy }: YulaExperienceProps) {
  const [mounted, setMounted] = useState(false);
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const mobile = useMediaQuery("(max-width: 767px)");
  const compactViewport = useMediaQuery("(max-width: 767px) and (max-height: 600px)");
  const [webgl, setWebgl] = useState<WebGLState>("checking");
  const [canvasFailed, setCanvasFailed] = useState(false);
  const [canvasReady, setCanvasReady] = useState(false);
  const [tier, setTier] = useState<QualityTier>("low");
  // The opening card is part of the server response so the first paint and
  // hydrated experience begin on the same visual frame.
  const [loaderVisible, setLoaderVisible] = useState(true);
  const [loaderProgress, setLoaderProgress] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [forceStatic, setForceStatic] = useState(false);
  const audio = useRef<AmbientAudioController | null>(null);
  const canvasReadyRef = useRef(false);
  const timelineEnabled =
    mounted &&
    !forceStatic &&
    !reducedMotion &&
    !compactViewport &&
    webgl === "available" &&
    !canvasFailed;
  const { progress, capture, scrollRange } = useExperienceProgress(timelineEnabled);
  // Native anchors use document pixels; the timeline uses the scrollable range.
  // Land at the first card's center, after both entry fades have completed.
  const firstProductCenter = STAGES.portfolio[0] +
    (STAGES.portfolio[1] - STAGES.portfolio[0]) / (2 * Math.max(1, products.length));

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    canvasReadyRef.current = canvasReady;
  }, [canvasReady]);

  useEffect(() => {
    const capabilities = detectExperienceCapabilities();
    const allowSoftwareCapture = capture.enabled && capabilities.available;
    setWebgl(
      capabilities.available && (!capabilities.software || allowSoftwareCapture)
        ? "available"
        : "unavailable",
    );
    setTier(capture.tier ?? capabilities.tier);
  }, [capture.enabled, capture.tier]);

  useEffect(() => {
    return () => {
      const controller = audio.current;
      audio.current = null;
      if (controller) void controller.dispose();
    };
  }, []);

  useEffect(() => {
    if (!mounted || capture.enabled || !loaderVisible) return;

    const root = document.documentElement;
    const previousOverflow = root.style.overflow;
    const previousOverscroll = root.style.overscrollBehavior;
    const previousRestoration = window.history.scrollRestoration;
    const resetOpeningScroll = () => window.scrollTo(0, 0);

    window.history.scrollRestoration = "manual";
    root.style.overflow = "hidden";
    root.style.overscrollBehavior = "none";
    resetOpeningScroll();
    window.addEventListener("pageshow", resetOpeningScroll);

    return () => {
      window.removeEventListener("pageshow", resetOpeningScroll);
      root.style.overflow = previousOverflow;
      root.style.overscrollBehavior = previousOverscroll;
      window.history.scrollRestoration = previousRestoration;
    };
  }, [capture.enabled, loaderVisible, mounted]);

  useEffect(() => {
    if (!mounted) return;

    if (
      reducedMotion ||
      compactViewport ||
      forceStatic ||
      webgl !== "available" ||
      canvasFailed
    ) {
      setLoaderVisible(false);
      setLoaderProgress(1);
      return;
    }

    if (capture.enabled) {
      setLoaderVisible(capture.loader);
      setLoaderProgress(capture.loader ? capture.loaderProgress : 1);
      return;
    }

    let animationFrame = 0;
    let previousTimestamp: number | null = null;
    let visibleElapsed = 0;
    let exitStartedAt: number | null = null;
    setLoaderVisible(true);
    setLoaderProgress(0);

    const tick = (now: number) => {
      visibleElapsed += resolveVisibleFrameDelta(
        now,
        previousTimestamp,
        document.visibilityState,
      );
      previousTimestamp = now;
      const elapsed = visibleElapsed;
      const drawProgress = Math.min(
        1,
        elapsed / LOADER_DRAW_DURATION_MS,
      );
      let next = drawProgress * LOADER_HOLD_PROGRESS;

      if (
        drawProgress >= 1 &&
        !canvasReadyRef.current &&
        elapsed >= LOADER_CANVAS_TIMEOUT_MS
      ) {
        // A broken or exceptionally slow GPU must never turn the opening into
        // an interaction gate. Fall back to the complete linear document.
        setLoaderProgress(1);
        setLoaderVisible(false);
        setCanvasFailed(true);
        return;
      }

      if (drawProgress >= 1 && canvasReadyRef.current) {
        exitStartedAt ??= elapsed;
        const exitProgress = Math.min(
          1,
          Math.max(0, (elapsed - exitStartedAt) / LOADER_EXIT_DURATION_MS),
        );
        next = LOADER_HOLD_PROGRESS + exitProgress * (1 - LOADER_HOLD_PROGRESS);
      }

      setLoaderProgress(next);
      if (next < 1) {
        animationFrame = requestAnimationFrame(tick);
        return;
      }

      setLoaderVisible(false);
    };

    animationFrame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationFrame);
  }, [
    canvasFailed,
    compactViewport,
    capture.enabled,
    capture.loader,
    capture.loaderProgress,
    forceStatic,
    mounted,
    reducedMotion,
    webgl,
  ]);

  const toggleSound = useCallback(async () => {
    const controller = audio.current ?? createAmbientAudio();
    audio.current = controller;

    if (controller.isEnabled()) {
      await controller.setEnabled(false);
    } else {
      // enable() is deliberately invoked from this gesture handler; it is
      // the only operation allowed to construct an AudioContext.
      await controller.enable();
    }
    setSoundEnabled(controller.isEnabled());
  }, []);

  const handleTierChange = useCallback(
    (nextTier: QualityTier) => {
      if (capture.enabled && capture.tier) return;
      setTier((currentTier) =>
        TIER_ORDER[nextTier] >= TIER_ORDER[currentTier] ? nextTier : currentTier,
      );
    },
    [capture.enabled, capture.tier],
  );

  // Keep the server and first hydration frame identical. Capture parameters
  // take effect immediately after mount, avoiding a mismatched active panel.
  const renderedProgress = mounted ? progress : 0;
  const mode: ExperienceMode = mobile ? "mobile" : "desktop";
  const frame = useMemo(
    () => evaluateTimeline(renderedProgress, mode),
    [mode, renderedProgress],
  );
  const activeProduct = products[frame.productIndex] ?? products[0];
  // Server markup is the complete linear document. Hydration may promote it
  // to WebGL, but no-JS users and the first accessibility tree keep every
  // product, proof item and trust link discoverable.
  const useStatic =
    !mounted ||
    forceStatic ||
    reducedMotion ||
    compactViewport ||
    webgl === "unavailable" ||
    canvasFailed;
  const fallbackActive = !reducedMotion && (webgl === "unavailable" || canvasFailed);
  const experienceReady =
    mounted && (useStatic || canvasReady || (capture.enabled && capture.loader));

  return (
    <div
      className={`${styles.journey} ${useStatic ? styles.staticJourney : ""}`}
      data-yula-experience="true"
      data-experience-mounted={mounted ? "true" : "false"}
      data-experience-ready={experienceReady ? "true" : "false"}
      data-stage={frame.stage}
      data-active-product={activeProduct?.slug ?? "none"}
      data-white-mix={frame.world.whiteMix.toFixed(3)}
      data-tier={tier}
      data-loader-visible={loaderVisible ? "true" : "false"}
      data-experience-fallback={fallbackActive ? "true" : undefined}
      suppressHydrationWarning
    >
      <noscript>
        <style>{
          `[data-yula-loader="true"]{display:none!important}` +
          `[data-yula-static="true"]{display:block!important}` +
          `[data-sound-control="true"]{display:none!important}`
        }</style>
      </noscript>
      {useStatic ? (
        <div
          data-yula-static="true"
          aria-hidden={mounted && loaderVisible ? "true" : undefined}
          inert={mounted && loaderVisible}
          style={loaderVisible ? { display: "none" } : undefined}
        >
          <StaticExperience
            copy={copy}
            products={products}
            soundEnabled={soundEnabled}
            onSoundToggle={() => void toggleSound()}
          />
        </div>
      ) : (
        <>
          <span id="experience-hero" className={styles.scrollAnchor} style={{ top: 0 }} />
          <span id="experience-portfolio" className={styles.scrollAnchor} style={{ top: capture.enabled ? "8.5%" : scrollRange * firstProductCenter }} />
          <span id="experience-proof" className={styles.scrollAnchor} style={{ top: "50.5%" }} />
          <span id="experience-manifesto" className={styles.scrollAnchor} style={{ top: "69%" }} />

          <div
            className={styles.viewport}
            aria-hidden={loaderVisible || undefined}
            inert={loaderVisible}
          >
            {webgl === "available" ? (
              <div className={styles.canvasLayer} aria-hidden="true">
                <ExperienceErrorBoundary
                  fallback={null}
                  onError={() => setCanvasFailed(true)}
                >
                  <ExperienceCanvas
                    products={products}
                    progress={renderedProgress}
                    mode={mode}
                    tier={tier}
                    onTierChange={handleTierChange}
                    onReady={() => setCanvasReady(true)}
                    onContextLost={() => setCanvasFailed(true)}
                  />
                </ExperienceErrorBoundary>
              </div>
            ) : null}

            <ExperienceOverlay
              copy={copy}
              products={products}
              frame={frame}
              tier={tier}
              soundEnabled={soundEnabled}
              onSoundToggle={() => void toggleSound()}
              onLinearView={() => setForceStatic(true)}
            />
          </div>

        </>
      )}
      {loaderVisible ? (
        <ExperienceLoader lines={copy.loader} progress={loaderProgress} />
      ) : null}
    </div>
  );
}

export default YulaExperience;
