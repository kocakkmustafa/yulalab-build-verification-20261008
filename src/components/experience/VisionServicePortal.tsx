"use client";

import { useFBO } from "@react-three/drei";
import { createPortal, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import {
  Color,
  Scene,
  SRGBColorSpace,
  UnsignedByteType,
} from "three";
import type { QualityTier, TimelineFrame } from "./types";
import { ServiceCorridorVisual } from "./ValueDioramas";
import { YulaGlyph } from "./YulaGlyph";

export type VisionServicePortalProps = {
  frame: TimelineFrame;
  tier: QualityTier;
};

const PORTAL_RESOLUTION: Record<QualityTier, number> = {
  high: 512,
  medium: 384,
  low: 256,
};

function fitRenderTarget(width: number, height: number, limit: number) {
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  const scale = limit / Math.max(safeWidth, safeHeight);
  return {
    width: Math.max(1, Math.round(safeWidth * scale)),
    height: Math.max(1, Math.round(safeHeight * scale)),
  };
}

/**
 * Renders only the lightweight SERVICE media surfaces into a capped target.
 * The texture is composited by YulaGlyph, so the real extruded Y is the mask.
 */
export function VisionServicePortal({ frame, tier }: VisionServicePortalProps) {
  const renderer = useThree((state) => state.gl);
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);
  const portalScene = useMemo(() => new Scene(), []);
  const savedClearColor = useMemo(() => new Color(), []);
  const targetSize = fitRenderTarget(size.width, size.height, PORTAL_RESOLUTION[tier]);
  const target = useFBO(targetSize.width, targetSize.height, {
    depthBuffer: true,
    samples: 0,
    stencilBuffer: false,
    type: UnsignedByteType,
  });
  const portalActive = frame.world.servicePortalOpacity > 0.001;

  useEffect(() => {
    target.texture.colorSpace = SRGBColorSpace;
    target.texture.needsUpdate = true;
  }, [target]);

  useFrame(() => {
    if (!portalActive) return;

    const previousTarget = renderer.getRenderTarget();
    const previousAutoClear = renderer.autoClear;
    const previousXr = renderer.xr.enabled;
    const previousClearAlpha = renderer.getClearAlpha();
    renderer.getClearColor(savedClearColor);

    try {
      renderer.xr.enabled = false;
      renderer.autoClear = true;
      renderer.setRenderTarget(target);
      renderer.setClearColor("#07050a", 0);
      renderer.clear(true, true, true);
      renderer.render(portalScene, camera);
    } finally {
      renderer.setRenderTarget(previousTarget);
      renderer.setClearColor(savedClearColor, previousClearAlpha);
      renderer.autoClear = previousAutoClear;
      renderer.xr.enabled = previousXr;
    }
  }, -40);

  return (
    <>
      {portalActive
        ? createPortal(
          <>
            <fog attach="fog" args={["#07050a", 9, 54]} />
            <ambientLight intensity={0.9} />
            <directionalLight color="#f0e5ff" intensity={2.4} position={[5, 8, 7]} />
            <pointLight color="#39e6ff" intensity={18} position={[-5, 1, -21]} />
            <pointLight color="#ff43c8" intensity={16} position={[5, -1, -27]} />
            <ServiceCorridorVisual
              frame={frame}
              opacity={1}
              tier={tier}
              withDioramas={false}
            />
          </>,
          portalScene,
        )
        : null}
      <YulaGlyph
        frame={frame}
        portalTexture={portalActive ? target.texture : null}
        tier={tier}
      />
    </>
  );
}

export default VisionServicePortal;
