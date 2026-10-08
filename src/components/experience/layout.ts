import type { ExperienceMode, Vec3 } from "./types";

export type ProofLayoutPose = {
  position: Vec3;
  rotation: Vec3;
  scale: number;
};

export type GlyphViewportPose = {
  offset: Vec3;
  scaleMultiplier: number;
};

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function smoothstep(value: number): number {
  const x = clamp01(value);
  return x * x * (3 - 2 * x);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * A continuous replacement for the old 767px composition switch. CSS may
 * still rearrange controls at a breakpoint, while the physical camera and Y
 * blend over a wider interval that a resized browser cannot visibly jump.
 */
export function viewportMobileMix(viewportWidth: number): number {
  if (!Number.isFinite(viewportWidth) || viewportWidth <= 0) return 0;
  return 1 - smoothstep((viewportWidth - 640) / 260);
}

/**
 * Keeps the broad Y inside portrait and near-square frustums without changing
 * the camera used by the room, wordmark and portfolio cards. Wide screens get
 * the reference's right-column object composition; compact screens move the Y
 * below the copy and use a lighter silhouette.
 */
export function glyphViewportPose(
  progress: number,
  aspect: number,
  viewportWidth = Number.POSITIVE_INFINITY,
): GlyphViewportPose {
  const safeAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
  const mobileMix = viewportMobileMix(viewportWidth);
  const viewportHeight = Number.isFinite(viewportWidth)
    ? viewportWidth / safeAspect
    : Number.POSITIVE_INFINITY;
  const shortMobileMix = mobileMix * (
    1 - smoothstep((viewportHeight - 640) / 200)
  );
  const compactMix = 1 - smoothstep((safeAspect - 1) / 0.35);
  const heroExit = smoothstep((clamp01(progress) - 0.04) / 0.045);
  const compositionStrength = 1 - heroExit;
  const proofRestore = smoothstep((clamp01(progress) - 0.505) / 0.07);
  const visionSettle = smoothstep((clamp01(progress) - 0.72) / 0.045);
  const visionRelease = smoothstep((clamp01(progress) - 0.805) / 0.05);
  const visionStrength = visionSettle * (1 - visionRelease);
  const mobilePortalSettle = smoothstep((clamp01(progress) - 0.805) / 0.02);
  const mobilePortalRelease = smoothstep((clamp01(progress) - 0.835) / 0.02);
  const mobilePortalStrength = mobilePortalSettle * (1 - mobilePortalRelease);
  const compactReduction = lerp(0.5, 0.24, mobileMix);
  const responsiveScale = 1 - compactReduction * compactMix * (1 - proofRestore);
  const openingScale = lerp(lerp(0.8, 0.9, mobileMix), 1, heroExit);
  const scaleMultiplier = responsiveScale * openingScale
    * (1 - 0.14 * shortMobileMix * compositionStrength)
    * (1 - 0.2 * mobileMix * mobilePortalStrength);
  const openingMobileY = lerp(0, 1.15, shortMobileMix)
    * compactMix
    * mobileMix
    * compositionStrength;

  return {
    offset: [
      -1.05 * visionStrength * (1 - mobileMix),
      openingMobileY + 0.55 * mobileMix * mobilePortalStrength,
      0,
    ],
    scaleMultiplier,
  };
}

/**
 * Only the active transition pair needs decoded screenshot textures. Distant
 * cards use their deterministic branded surface until they approach focus,
 * avoiding an eight-product media barrier during the opening scene.
 */
export function shouldLoadPortfolioMedia(
  fieldOpacity: number,
  portfolioDistance: number,
  proofMorph: number,
): boolean {
  if (
    !Number.isFinite(fieldOpacity) ||
    !Number.isFinite(portfolioDistance) ||
    !Number.isFinite(proofMorph)
  ) {
    return false;
  }

  return fieldOpacity > 0.01 && Math.abs(portfolioDistance) < 1.35 && proofMorph < 0.25;
}

/**
 * Proof is a compact ledger, not the wide portfolio carousel. The mobile
 * 2x4 arrangement is deliberately separate because a portrait camera has
 * less than half the horizontal frustum of the desktop camera.
 */
export function proofLayoutPose(
  index: number,
  mode: ExperienceMode,
): ProofLayoutPose {
  if (mode === "mobile") {
    const column = index % 2;
    const row = Math.floor(index / 2);
    return {
      position: [(column - 0.5) * 0.8, (1.5 - row) * 0.74, -13.82 - row * 0.08],
      rotation: [(row - 1.5) * 0.012, 0, 0],
      scale: 0.19,
    };
  }

  const column = index % 4;
  const row = Math.floor(index / 4);
  return {
    position: [(column - 1.5) * 0.68, (0.5 - row) * 1.02, -13.82 - row * 0.12],
    rotation: [row === 0 ? -0.025 : 0.025, 0, 0],
    scale: 0.24,
  };
}
