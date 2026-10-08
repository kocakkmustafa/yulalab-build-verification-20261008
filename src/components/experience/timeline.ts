import type {
  CameraKey,
  CameraPose,
  ExperienceMode,
  ExperienceStage,
  TimelineFrame,
  Vec3,
} from "./types";
import { viewportMobileMix } from "./layout";

export const STAGES = {
  hero: [0, 0.085],
  portfolio: [0.085, 0.505],
  proof: [0.505, 0.575],
  crossing: [0.575, 0.69],
  mission: [0.69, 0.765],
  vision: [0.765, 0.835],
  values: [0.835, 0.955],
  closing: [0.955, 1],
} as const satisfies Record<ExperienceStage, readonly [number, number]>;

export const CROSSING_BLADE = {
  centerZ: -14.3,
  halfDepth: 0.24,
} as const;

const GLYPH_LOCAL_HALF_EXTENTS: Vec3 = [1.05, 1, 0.24];
const GLYPH_CARD_CLEARANCE = 0.16;

const STAGE_ORDER = Object.keys(STAGES) as ExperienceStage[];

export const CAMERA_TRACKS: Record<ExperienceMode, readonly CameraKey[]> = {
  desktop: [
    { progress: 0, position: [0, 0.25, 11.5], target: [0, 0.1, 0], fov: 39 },
    { progress: 0.085, position: [0, 0.1, 8.4], target: [0, 0, 0], fov: 38 },
    { progress: 0.19, position: [-1.8, 0.45, 4.6], target: [0.2, 0, -1.8], fov: 36 },
    { progress: 0.32, position: [1.65, 0.15, 0.3], target: [-0.15, 0, -4.5], fov: 35 },
    { progress: 0.43, position: [-1.25, 0.6, -4.3], target: [0.1, 0.1, -8], fov: 35 },
    { progress: 0.505, position: [0, 0.7, -7.8], target: [0, 0.15, -11], fov: 37 },
    { progress: 0.575, position: [0, 0.1, -8.8], target: [0, -0.1, -14.2], fov: 44 },
    { progress: 0.69, position: [0, 0.85, -15], target: [0, 0.2, -19], fov: 42 },
    { progress: 0.765, position: [1.25, 0.45, -18.4], target: [0, 0.15, -22], fov: 41 },
    { progress: 0.835, position: [-1.1, 0.55, -21.8], target: [0, 0.1, -25.5], fov: 40 },
    { progress: 0.91, position: [1.35, 0.35, -25.8], target: [0, 0, -29], fov: 39 },
    { progress: 0.955, position: [-0.6, 0.7, -29.5], target: [-1.4, 0, -33], fov: 40 },
    { progress: 1, position: [-3.6, 0.15, -33.2], target: [-4.6, 0.05, -36], fov: 42 },
  ],
  mobile: [
    { progress: 0, position: [0, 0.65, 13.8], target: [0, 0.25, 0], fov: 52 },
    { progress: 0.085, position: [0, 0.45, 10.1], target: [0, 0.1, 0], fov: 51 },
    { progress: 0.19, position: [-0.6, 0.95, 5.5], target: [0, -0.2, -1.6], fov: 50 },
    { progress: 0.32, position: [0.65, 0.85, 0.9], target: [0, -0.25, -4.2], fov: 49 },
    { progress: 0.43, position: [-0.5, 1.05, -3.7], target: [0, -0.2, -7.8], fov: 49 },
    { progress: 0.505, position: [0, 1.15, -7], target: [0, -0.15, -10.7], fov: 51 },
    { progress: 0.575, position: [0, 0.55, -7.8], target: [0, -0.35, -14], fov: 57 },
    { progress: 0.69, position: [0, 1.35, -14.9], target: [0, 0, -18.7], fov: 55 },
    { progress: 0.765, position: [0.45, 1.15, -17.7], target: [0, -0.1, -21.8], fov: 54 },
    { progress: 0.835, position: [-0.4, 1.2, -21.2], target: [0, -0.15, -25.2], fov: 53 },
    { progress: 0.91, position: [0.55, 1.05, -25], target: [0, -0.2, -28.6], fov: 52 },
    { progress: 0.955, position: [-0.25, 1.2, -28.8], target: [-0.7, -0.15, -32.5], fov: 53 },
    { progress: 1, position: [-1.45, 0.75, -32.5], target: [-2.1, -0.1, -35.7], fov: 55 },
  ],
};

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export function smoothstep(value: number): number {
  const x = clamp01(value);
  return x * x * (3 - 2 * x);
}

export function smootherstep(value: number): number {
  const x = clamp01(value);
  return x * x * x * (x * (x * 6 - 15) + 10);
}

export function segmentProgress(progress: number, start: number, end: number): number {
  if (end <= start) return progress > start ? 1 : 0;
  return clamp01((clamp01(progress) - start) / (end - start));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpVec3(a: Vec3, b: Vec3, t: number): Vec3 {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

function catmull(a: number, b: number, c: number, d: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (
    2 * b +
    (-a + c) * t +
    (2 * a - 5 * b + 4 * c - d) * t2 +
    (-a + 3 * b - 3 * c + d) * t3
  );
}

function catmullVec3(a: Vec3, b: Vec3, c: Vec3, d: Vec3, t: number): Vec3 {
  return [
    catmull(a[0], b[0], c[0], d[0], t),
    catmull(a[1], b[1], c[1], d[1], t),
    catmull(a[2], b[2], c[2], d[2], t),
  ];
}

export function interpolateKeyframes(
  keys: readonly CameraKey[],
  progress: number,
): CameraPose {
  if (keys.length === 0) {
    return { position: [0, 0, 10], target: [0, 0, 0], fov: 40 };
  }
  const p = clamp01(progress);
  if (p <= keys[0].progress) {
    return { position: keys[0].position, target: keys[0].target, fov: keys[0].fov };
  }
  const last = keys[keys.length - 1];
  if (p >= last.progress) {
    return { position: last.position, target: last.target, fov: last.fov };
  }

  let index = 0;
  while (index < keys.length - 2 && p > keys[index + 1].progress) index += 1;
  const current = keys[index];
  const next = keys[index + 1];
  const previous = keys[Math.max(0, index - 1)];
  const following = keys[Math.min(keys.length - 1, index + 2)];
  const local = smootherstep((p - current.progress) / (next.progress - current.progress));

  return {
    position: catmullVec3(
      previous.position,
      current.position,
      next.position,
      following.position,
      local,
    ),
    target: lerpVec3(current.target, next.target, local),
    fov: lerp(current.fov, next.fov, local),
  };
}

export function interpolateViewportCamera(
  progress: number,
  viewportWidth: number,
  fallbackMode: ExperienceMode = "desktop",
): CameraPose {
  if (!Number.isFinite(viewportWidth) || viewportWidth <= 0) {
    return interpolateKeyframes(CAMERA_TRACKS[fallbackMode], progress);
  }

  const mobileMix = viewportMobileMix(viewportWidth);
  const desktop = interpolateKeyframes(CAMERA_TRACKS.desktop, progress);
  const mobile = interpolateKeyframes(CAMERA_TRACKS.mobile, progress);
  return {
    position: lerpVec3(desktop.position, mobile.position, mobileMix),
    target: lerpVec3(desktop.target, mobile.target, mobileMix),
    fov: lerp(desktop.fov, mobile.fov, mobileMix),
  };
}

type VecKey = { progress: number; value: Vec3 };
type NumberKey = { progress: number; value: number };

function sampleVec(keys: readonly VecKey[], progress: number): Vec3 {
  const p = clamp01(progress);
  const first = keys[0];
  const last = keys[keys.length - 1];
  if (p <= first.progress) return first.value;
  if (p >= last.progress) return last.value;
  const index = keys.findIndex((key) => key.progress >= p);
  const a = keys[index - 1];
  const b = keys[index];
  return lerpVec3(a.value, b.value, smoothstep((p - a.progress) / (b.progress - a.progress)));
}

function sampleNumber(keys: readonly NumberKey[], progress: number): number {
  const p = clamp01(progress);
  const first = keys[0];
  const last = keys[keys.length - 1];
  if (p <= first.progress) return first.value;
  if (p >= last.progress) return last.value;
  const index = keys.findIndex((key) => key.progress >= p);
  const a = keys[index - 1];
  const b = keys[index];
  return lerp(a.value, b.value, smoothstep((p - a.progress) / (b.progress - a.progress)));
}

const GLYPH_POSITION: readonly VecKey[] = [
  { progress: 0, value: [0, 0, 0] },
  { progress: 0.085, value: [0, 0, -0.6] },
  { progress: 0.505, value: [0, 0, -10.4] },
  { progress: 0.575, value: [0, 0, -13.16] },
  { progress: 0.69, value: [0, 0.2, -18.9] },
  { progress: 0.835, value: [0, 0, -25.3] },
  { progress: 0.955, value: [-1.8, 0.1, -34.5] },
  { progress: 1, value: [-6.3, 0.12, -38.4] },
];

const GLYPH_ROTATION: readonly VecKey[] = [
  { progress: 0, value: [-0.08, -0.15, 0.02] },
  { progress: 0.505, value: [0.05, 0.5, -0.03] },
  { progress: 0.575, value: [0.15, 1.15, 0.02] },
  { progress: 0.69, value: [0.02, 0.35, 0] },
  { progress: 0.765, value: [0.03, 0.12, 0] },
  { progress: 0.835, value: [0.04, 0.16, 0] },
  { progress: 0.955, value: [0, 0.32, 0] },
  { progress: 1, value: [0, 0.08, 0] },
];

const GLYPH_SCALE: readonly NumberKey[] = [
  { progress: 0, value: 2.08 },
  { progress: 0.085, value: 2.05 },
  { progress: 0.505, value: 2.4 },
  { progress: 0.575, value: 1.1 },
  { progress: 0.69, value: 0.95 },
  { progress: 0.765, value: 0.75 },
  { progress: 0.805, value: 0.75 },
  { progress: 0.835, value: 0.75 },
  { progress: 0.955, value: 1.35 },
  { progress: 1, value: 0.85 },
];

function stageAt(progress: number): ExperienceStage {
  const p = clamp01(progress);
  for (let index = STAGE_ORDER.length - 1; index >= 0; index -= 1) {
    const stage = STAGE_ORDER[index];
    if (p >= STAGES[stage][0]) return stage;
  }
  return "hero";
}

function bandOpacity(progress: number, start: number, end: number): number {
  const duration = end - start;
  const edge = Math.min(0.014, duration * 0.18);
  const fadeIn = start === 0 ? 1 : smoothstep(segmentProgress(progress, start, start + edge));
  const fadeOut = end === 1 ? 1 : 1 - smoothstep(segmentProgress(progress, end - edge, end));
  return clamp01(Math.min(fadeIn, fadeOut));
}

function slotFrame(progress: number, range: readonly [number, number], count: number) {
  const local = segmentProgress(progress, range[0], range[1]);
  const rawScaled = local * count;
  const nearestBoundary = Math.round(rawScaled);
  const scaled = Math.abs(rawScaled - nearestBoundary) <= 1e-10
    ? nearestBoundary
    : rawScaled;
  const index = Math.min(count - 1, Math.floor(scaled));
  const within = index === count - 1 && local === 1 ? 1 : scaled - index;
  return {
    float: clamp01((scaled - 0.5) / (count - 1)) * (count - 1),
    index,
    progress: clamp01(within),
  };
}

/** Conservative world-space Z extent of the bevelled Y, including fringe shells. */
export function glyphDepthExtent(rotation: Vec3, scale: number): number {
  const [x, y, z] = rotation;
  const a = Math.cos(x);
  const b = Math.sin(x);
  const c = Math.cos(y);
  const d = Math.sin(y);
  const e = Math.cos(z);
  const f = Math.sin(z);
  const matrixZx = b * f - a * e * d;
  const matrixZy = b * e + a * f * d;
  const matrixZz = a * c;

  return Math.max(0, scale) * (
    Math.abs(matrixZx) * GLYPH_LOCAL_HALF_EXTENTS[0] +
    Math.abs(matrixZy) * GLYPH_LOCAL_HALF_EXTENTS[1] +
    Math.abs(matrixZz) * GLYPH_LOCAL_HALF_EXTENTS[2]
  );
}

function resolveGlyphPosition(
  progress: number,
  productFloat: number,
  proofMorph: number,
  rotation: Vec3,
  scale: number,
): Vec3 {
  const sampled = sampleVec(GLYPH_POSITION, progress);
  const depthExtent = glyphDepthExtent(rotation, scale);
  const clearance = depthExtent + GLYPH_CARD_CLEARANCE;

  // The hero camera moves toward the room. Move the Y toward the exact first
  // portfolio clearance plane at the same time, so it no longer grows past
  // the viewport and then snaps backwards at the stage boundary.
  if (progress < STAGES.portfolio[0]) {
    const firstCardPlane = -1.25 - 0.5 * 1.36;
    const entryDepth = firstCardPlane - clearance;
    const travel = smootherstep(segmentProgress(progress, 0, STAGES.portfolio[0]));
    return [sampled[0], sampled[1], lerp(sampled[2], entryDepth, travel)];
  }

  // The reference's monogram is a physical object behind the active work,
  // not a watermark painted over it. The portfolio cards advance 1.36 world
  // units per slot. Offset the moving plane by half a slot so the full bevelled
  // volume stays behind the newly active card during hand-offs too.
  if (progress >= STAGES.portfolio[0] && progress < STAGES.proof[0]) {
    const depthIndex = Math.min(7, productFloat + 0.5);
    const activePlane = -1.25 - depthIndex * 1.36;
    return [sampled[0], sampled[1], activePlane - clearance];
  }

  // During the proof morph the eighth card travels from its arc depth into
  // the second proof row. Y follows that plane and crosses it exactly once,
  // moving the complete bevelled volume from behind to in front.
  if (progress >= STAGES.proof[0] && progress <= STAGES.proof[1]) {
    const arcDepth = -1.25 - 7 * 1.36;
    const proofDepth = -13.98;
    const cardDepth = lerp(arcDepth, proofDepth, proofMorph);
    const crossing = smoothstep(segmentProgress(progress, 0.525, 0.56));
    return [sampled[0], sampled[1], cardDepth + lerp(-clearance, clearance, crossing)];
  }

  if (progress > STAGES.proof[1] && progress < 0.62) {
    const proofEndRotation = sampleVec(GLYPH_ROTATION, STAGES.proof[1]);
    const proofEndScale = sampleNumber(GLYPH_SCALE, STAGES.proof[1]);
    const proofEndClearance =
      glyphDepthExtent(proofEndRotation, proofEndScale) + GLYPH_CARD_CLEARANCE;
    const proofExitDepth = -13.98 + proofEndClearance;
    const settle = smootherstep(segmentProgress(progress, STAGES.proof[1], 0.62));
    return [sampled[0], sampled[1], lerp(proofExitDepth, sampled[2], settle)];
  }

  return sampled;
}

export function evaluateTimeline(
  progress: number,
  mode: ExperienceMode,
): TimelineFrame {
  const p = clamp01(progress);
  const stage = stageAt(p);
  const [stageStart, stageEnd] = STAGES[stage];
  const product = slotFrame(p, STAGES.portfolio, 8);
  const proof = slotFrame(p, STAGES.proof, 8);
  const value = slotFrame(p, STAGES.values, 4);
  const whiteRise = smoothstep(segmentProgress(p, STAGES.crossing[0], STAGES.crossing[1]));
  const darkReturn = smoothstep(segmentProgress(p, 0.825, 0.855));
  const whiteMix = whiteRise * (1 - darkReturn);
  // The physical blade enters before the whole environment changes. This
  // preserves a dark upper chamber at mid-crossing, then makes the white
  // manifesto feel spatially earned. Vision opens the route back to dark.
  const themeMix = Math.pow(whiteMix, 3);
  const proofMorph = smoothstep(segmentProgress(p, STAGES.proof[0], STAGES.proof[1]));
  const closingDraw = smoothstep(segmentProgress(p, STAGES.closing[0], STAGES.closing[1]));
  const worksBackdropMix =
    smoothstep(segmentProgress(p, 0.072, 0.11)) *
    (1 - smoothstep(segmentProgress(p, 0.475, 0.515)));
  const visionPortal = smoothstep(segmentProgress(p, 0.78, 0.815));
  const servicePortalOpacity =
    smoothstep(segmentProgress(p, 0.79, 0.805)) *
    (1 - smoothstep(segmentProgress(p, 0.84, 0.855)));
  const serviceIn = smoothstep(segmentProgress(p, 0.835, 0.858));
  const serviceOut = smoothstep(segmentProgress(p, 0.925, 0.965));
  const closingContent = smoothstep(segmentProgress(p, 0.968, 0.992));
  const glyphRotation = sampleVec(GLYPH_ROTATION, p);
  const glyphScale = sampleNumber(GLYPH_SCALE, p);

  const overlay = Object.fromEntries(
    STAGE_ORDER.map((name) => [name, bandOpacity(p, STAGES[name][0], STAGES[name][1])]),
  ) as Record<ExperienceStage, number>;

  return {
    progress: p,
    stage,
    stageProgress: segmentProgress(p, stageStart, stageEnd),
    productFloat: product.float,
    productIndex: product.index,
    productProgress: product.progress,
    proofFloat: proof.float,
    proofIndex: proof.index,
    proofProgress: proof.progress,
    valueFloat: value.float,
    valueIndex: value.index,
    valueProgress: value.progress,
    camera: interpolateKeyframes(CAMERA_TRACKS[mode], p),
    glyph: {
      position: resolveGlyphPosition(
        p,
        product.float,
        proofMorph,
        glyphRotation,
        glyphScale,
      ),
      rotation: glyphRotation,
      scale: glyphScale,
      glassMix: 1 - themeMix,
      outlineMix: Math.max(themeMix, closingDraw),
    },
    world: {
      whiteMix,
      themeMix,
      bladeProgress: whiteRise,
      roomOpacity: lerp(1, 0.62, themeMix),
      wordmarkOpacity:
        p < STAGES.proof[0]
          ? lerp(
            mode === "mobile" ? 0.46 : 0.94,
            0.28,
            smoothstep(segmentProgress(p, STAGES.portfolio[0], STAGES.portfolio[1])),
          )
          : 0.18 * (1 - themeMix),
      proofMorph,
      closingDraw,
      worksBackdropMix,
      visionPortal,
      servicePortalOpacity,
      serviceIn,
      serviceOut,
      closingContent,
    },
    overlay,
  };
}
