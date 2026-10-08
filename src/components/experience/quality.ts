import type { QualityTier } from "./types";

export type QualitySettings = {
  dpr: number | [number, number];
  shadows: "basic" | false;
};

/**
 * Canvas-level settings that React Three Fiber can update without rebuilding
 * the WebGL renderer. Geometry and material detail remain local to the scene
 * components that actually consume those values.
 */
export const QUALITY: Record<QualityTier, QualitySettings> = {
  high: {
    dpr: [1, 1.75],
    shadows: "basic",
  },
  medium: {
    dpr: [1, 1.5],
    shadows: false,
  },
  low: {
    dpr: 1,
    shadows: false,
  },
};

export function downgradeTier(tier: QualityTier): QualityTier {
  if (tier === "high") return "medium";
  return "low";
}

export function supportsWebGL(): boolean {
  if (typeof document === "undefined") return false;

  return withTemporaryWebGL2Context(() => true) ?? false;
}

export type ExperienceCapabilities = {
  available: boolean;
  software: boolean;
  tier: QualityTier;
};

type NavigatorWithDeviceMemory = Navigator & { deviceMemory?: number };

function finitePositive(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : null;
}

function prefersReducedMotion(): boolean {
  if (typeof window.matchMedia !== "function") return false;

  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

function withTemporaryWebGL2Context<T>(
  inspect: (context: WebGL2RenderingContext) => T,
): T | null {
  const canvas = document.createElement("canvas");

  try {
    const context = canvas.getContext("webgl2");
    if (!context) return null;

    try {
      return inspect(context);
    } finally {
      context.getExtension("WEBGL_lose_context")?.loseContext();
    }
  } catch {
    return null;
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}

function isSoftwareRenderer(context: WebGL2RenderingContext): boolean {
  const rendererInfo = context.getExtension("WEBGL_debug_renderer_info") as
    | { UNMASKED_RENDERER_WEBGL: number }
    | null;
  const renderer = context.getParameter(
    rendererInfo?.UNMASKED_RENDERER_WEBGL ?? context.RENDERER,
  );
  return typeof renderer === "string" &&
    /(swiftshader|llvmpipe|software rasterizer|mesa offscreen)/i.test(renderer);
}

export function detectExperienceCapabilities(): ExperienceCapabilities {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return { available: false, software: false, tier: "low" };
  }

  const probe = withTemporaryWebGL2Context((context) => ({
    software: isSoftwareRenderer(context),
  }));
  if (!probe) return { available: false, software: false, tier: "low" };
  if (prefersReducedMotion() || probe.software) {
    return { available: true, software: probe.software, tier: "low" };
  }

  const dpr = finitePositive(window.devicePixelRatio) ?? 1;
  const width = finitePositive(window.innerWidth) ?? 0;
  const height = finitePositive(window.innerHeight) ?? 0;
  const viewportArea = width * height;
  const renderedPixelArea = viewportArea * dpr * dpr;
  const cores = finitePositive(navigator.hardwareConcurrency);
  const memory = finitePositive((navigator as NavigatorWithDeviceMemory).deviceMemory);

  const constrainedHardware =
    (cores !== null && cores <= 4) || (memory !== null && memory <= 4);
  const constrainedDisplay = dpr > 3 || renderedPixelArea > 8_000_000;

  if (constrainedHardware || constrainedDisplay) {
    return { available: true, software: false, tier: "low" };
  }

  const capableHardware =
    (cores === null || cores >= 8) && (memory === null || memory >= 8);
  const capableDisplay = viewportArea >= 1_000_000 && dpr <= 2;

  return {
    available: true,
    software: false,
    tier: capableHardware && capableDisplay ? "high" : "medium",
  };
}

export function detectInitialTier(): QualityTier {
  return detectExperienceCapabilities().tier;
}
