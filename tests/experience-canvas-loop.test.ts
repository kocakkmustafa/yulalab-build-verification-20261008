// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const canvasSource = readFileSync(
  resolve(process.cwd(), "src/components/experience/ExperienceCanvas.tsx"),
  "utf8",
);

describe("experience Canvas frame-loop policy", () => {
  it("sleeps after warmup and wakes through R3F invalidation", () => {
    expect(canvasSource).toContain('frameloop="demand"');
    expect(canvasSource).toContain('document.addEventListener("visibilitychange"');
    expect(canvasSource).toContain('document.removeEventListener("visibilitychange"');
    expect(canvasSource).toContain("visibleWarmupElapsed.current");
  });

  it("preserves R3F render ownership instead of installing a second loop", () => {
    expect(canvasSource).not.toContain("setAnimationLoop");
    expect(canvasSource).not.toMatch(/state\.gl\.render\(state\.scene, state\.camera\)/);
    expect(canvasSource).not.toMatch(/useFrame\([\s\S]*?\},\s*[1-9]\d*\);/);
  });
});
