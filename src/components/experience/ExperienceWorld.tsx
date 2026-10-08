"use client";

import { Environment, Lightformer } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useMemo } from "react";
import { Color, Fog } from "three";
import { CameraRig } from "./CameraRig";
import { GridRoom } from "./GridRoom";
import { PortfolioField } from "./PortfolioField";
import { evaluateTimeline } from "./timeline";
import type {
  ExperienceMode,
  ExperienceProduct,
  QualityTier,
  TimelineFrame,
} from "./types";
import { ValueDioramas } from "./ValueDioramas";
import { VisionServicePortal } from "./VisionServicePortal";
import { WORLD_DARK_COLOR, WORLD_LIGHT_COLOR } from "./theme";

export type ExperienceWorldProps = {
  products: ExperienceProduct[];
  progress: number;
  mode: ExperienceMode;
  tier: QualityTier;
  onAssetsSettled: () => void;
};

function WorldTheme({ frame }: { frame: TimelineFrame }) {
  const renderer = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const colors = useMemo(
    () => ({
      dark: new Color(WORLD_DARK_COLOR),
      light: new Color(WORLD_LIGHT_COLOR),
      mixed: new Color(),
    }),
    [],
  );

  useFrame(() => {
    colors.mixed.lerpColors(colors.dark, colors.light, frame.world.themeMix);
    renderer.setClearColor(colors.mixed, 1);

    if (scene.fog instanceof Fog) {
      scene.fog.color.copy(colors.mixed);
      scene.fog.near = 12 + frame.world.themeMix * 4;
      scene.fog.far = 58 + frame.world.themeMix * 12;
    }
  }, -90);

  return <fog attach="fog" args={[WORLD_DARK_COLOR, 12, 58]} />;
}

export function ExperienceWorld({
  products,
  progress,
  mode,
  tier,
  onAssetsSettled,
}: ExperienceWorldProps) {
  const frame = useMemo(
    () => evaluateTimeline(progress, mode),
    [mode, progress],
  );
  const environmentResolution = tier === "high" ? 256 : tier === "medium" ? 128 : 64;

  return (
    <>
      <WorldTheme frame={frame} />
      <CameraRig mode={mode} progress={progress} />

      <ambientLight intensity={0.45 + frame.world.themeMix * 0.55} />
      <directionalLight
        castShadow={tier !== "low"}
        color={frame.world.themeMix > 0.5 ? "#fffaf0" : "#cbbdff"}
        intensity={2.2}
        position={[6, 9, 8]}
        shadow-mapSize-height={tier === "high" ? 1024 : 512}
        shadow-mapSize-width={tier === "high" ? 1024 : 512}
      />
      <pointLight color="#33dcff" intensity={24} position={[-7, 2, 4]} />
      <pointLight color="#ff3fbd" intensity={20} position={[7, -2, -8]} />

      <Environment
        background={false}
        environmentIntensity={0.85 + frame.world.themeMix * 0.35}
        frames={1}
        resolution={environmentResolution}
      >
        <Lightformer
          color="#e8ddff"
          form="rect"
          intensity={4}
          position={[-5, 4, 6]}
          rotation={[0, Math.PI / 4, 0]}
          scale={[5, 8, 1]}
        />
        <Lightformer
          color="#41d9ff"
          form="ring"
          intensity={2.2}
          position={[4, 1, -6]}
          rotation={[0, -Math.PI / 3, 0]}
          scale={5}
        />
        <Lightformer
          color="#ff54c8"
          form="rect"
          intensity={2}
          position={[2, -4, -18]}
          rotation={[Math.PI / 2, 0, 0]}
          scale={[4, 12, 1]}
        />
      </Environment>

      <GridRoom frame={frame} tier={tier} />
      <VisionServicePortal frame={frame} tier={tier} />
      <PortfolioField
        frame={frame}
        mode={mode}
        onAssetsSettled={onAssetsSettled}
        products={products}
        tier={tier}
      />
      <ValueDioramas frame={frame} tier={tier} />
    </>
  );
}
