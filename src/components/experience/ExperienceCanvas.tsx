"use client";

import { PerformanceMonitor } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ACESFilmicToneMapping,
  PCFShadowMap,
  SRGBColorSpace,
} from "three";
import { downgradeTier, QUALITY } from "./quality";
import type {
  ExperienceMode,
  ExperienceProduct,
  QualityTier,
} from "./types";
import { ExperienceWorld } from "./ExperienceWorld";

export type ExperienceCanvasProps = {
  products: ExperienceProduct[];
  progress: number;
  mode: ExperienceMode;
  tier: QualityTier;
  onTierChange: (tier: QualityTier) => void;
  onReady: () => void;
  onContextLost: () => void;
};

// Antialiasing is a WebGL context-creation option, so it is intentionally
// tier-independent. Keeping this object stable lets a quality downgrade update
// DPR/shadows without remounting the Canvas and reloading portfolio textures.
const IMMUTABLE_GL_OPTIONS = {
  alpha: false,
  antialias: true,
  logarithmicDepthBuffer: false,
  powerPreference: "high-performance" as const,
  outputColorSpace: SRGBColorSpace,
  toneMapping: ACESFilmicToneMapping,
};

// PerformanceMonitor gets a bounded visible-frame warmup. Afterwards the
// progress-driven scene sleeps until scroll, resize, tier or visibility wakes it.
const PERFORMANCE_WARMUP_SECONDS = 2.5;
const PORTFOLIO_MEDIA_ENTRY_PROGRESS = 0.065;
const TRANSMISSION_RESOLUTION_SCALE: Record<QualityTier, number> = {
  high: 0.5,
  medium: 0.35,
  low: 0.25,
};

type CanvasLifecycleProps = Pick<
  ExperienceCanvasProps,
  "mode" | "onReady" | "onContextLost" | "progress" | "tier"
> & { assetsSettled: boolean };

function CanvasLifecycle({
  assetsSettled,
  mode,
  onReady,
  onContextLost,
  progress,
  tier,
}: CanvasLifecycleProps) {
  const renderer = useThree((state) => state.gl);
  const invalidate = useThree((state) => state.invalidate);
  const readySent = useRef(false);
  const postAssetsFrameSeen = useRef(false);
  const visibleWarmupElapsed = useRef(0);
  const onReadyRef = useRef(onReady);
  const onContextLostRef = useRef(onContextLost);

  useEffect(() => {
    onReadyRef.current = onReady;
    onContextLostRef.current = onContextLost;
  }, [onContextLost, onReady]);

  useEffect(() => {
    const canvas = renderer.domElement;
    const handleContextLost = (event: Event) => {
      event.preventDefault();
      onContextLostRef.current();
    };

    canvas.addEventListener("webglcontextlost", handleContextLost, false);
    return () => {
      canvas.removeEventListener("webglcontextlost", handleContextLost, false);
    };
  }, [renderer]);

  useEffect(() => {
    invalidate();
  }, [invalidate, mode, progress, tier]);

  useEffect(() => {
    const wakeVisibleCanvas = () => {
      if (document.visibilityState === "visible") invalidate();
    };

    document.addEventListener("visibilitychange", wakeVisibleCanvas);
    return () => {
      document.removeEventListener("visibilitychange", wakeVisibleCanvas);
    };
  }, [invalidate]);

  useEffect(() => {
    renderer.transmissionResolutionScale = TRANSMISSION_RESOLUTION_SCALE[tier];
    invalidate();
  }, [invalidate, renderer, tier]);

  useEffect(() => {
    postAssetsFrameSeen.current = false;
    if (assetsSettled) invalidate();
  }, [assetsSettled, invalidate]);

  useFrame((_state, delta) => {
    if (
      document.visibilityState === "visible"
      && visibleWarmupElapsed.current < PERFORMANCE_WARMUP_SECONDS
    ) {
      visibleWarmupElapsed.current += Math.min(1 / 15, Math.max(0, delta));
      invalidate();
    }

    if (!assetsSettled || readySent.current) return;
    if (!postAssetsFrameSeen.current) {
      postAssetsFrameSeen.current = true;
      invalidate();
      return;
    }
    readySent.current = true;
    onReadyRef.current();
  }, -100);

  return null;
}

export function ExperienceCanvas({
  products,
  progress,
  mode,
  tier,
  onTierChange,
  onReady,
  onContextLost,
}: ExperienceCanvasProps) {
  const quality = QUALITY[tier];
  const assetKey = products
    .flatMap((product) => product.screenshots.map((shot) => shot.path))
    .join("\u0000");
  const [assetState, setAssetState] = useState({
    key: "",
    settled: false,
  });
  // The hero deliberately requests no portfolio screenshots. Its readiness
  // therefore depends only on a committed WebGL frame; later capture points
  // still wait for every media asset that PortfolioField actually requests.
  const heroDefersPortfolioMedia = progress < PORTFOLIO_MEDIA_ENTRY_PROGRESS;
  const assetsSettled = heroDefersPortfolioMedia
    || (assetState.key === assetKey && assetState.settled);

  const requestDowngrade = useCallback(() => {
    const nextTier = downgradeTier(tier);
    if (nextTier !== tier) onTierChange(nextTier);
  }, [onTierChange, tier]);

  const handleAssetsSettled = useCallback(() => {
    setAssetState((current) => {
      if (current.key === assetKey && current.settled) return current;
      return { key: assetKey, settled: true };
    });
  }, [assetKey]);

  return (
    <Canvas
      aria-hidden="true"
      tabIndex={-1}
      camera={{
        position: mode === "mobile" ? [0, 0.65, 13.8] : [0, 0.25, 11.5],
        fov: mode === "mobile" ? 52 : 39,
        near: 0.05,
        far: 130,
      }}
      dpr={quality.dpr}
      flat={false}
      frameloop="demand"
      gl={IMMUTABLE_GL_OPTIONS}
      legacy={false}
      onCreated={({ gl }) => {
        gl.outputColorSpace = SRGBColorSpace;
        gl.toneMapping = ACESFilmicToneMapping;
        gl.shadowMap.type = PCFShadowMap;
        gl.transmissionResolutionScale = TRANSMISSION_RESOLUTION_SCALE[tier];
      }}
      shadows={quality.shadows}
      style={{ width: "100%", height: "100%", pointerEvents: "none" }}
    >
      <PerformanceMonitor
        bounds={(refreshRate) => [Math.min(45, refreshRate * 0.82), refreshRate]}
        flipflops={1}
        iterations={8}
        ms={250}
        onDecline={requestDowngrade}
        onFallback={requestDowngrade}
        threshold={0.7}
      >
        <CanvasLifecycle
          assetsSettled={assetsSettled}
          mode={mode}
          onContextLost={onContextLost}
          onReady={onReady}
          progress={progress}
          tier={tier}
        />
        <ExperienceWorld
          mode={mode}
          onAssetsSettled={handleAssetsSettled}
          products={products}
          progress={progress}
          tier={tier}
        />
      </PerformanceMonitor>
    </Canvas>
  );
}

export default ExperienceCanvas;
