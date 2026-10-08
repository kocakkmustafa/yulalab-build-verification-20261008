import { describe, expect, it } from "vitest";
import { Color, Euler, PerspectiveCamera, Vector3 } from "three";
import {
  glyphViewportPose,
  proofLayoutPose,
  shouldLoadPortfolioMedia,
  viewportMobileMix,
} from "@/components/experience/layout";
import {
  resolveExperiencePalette,
  WORLD_DARK_COLOR,
  WORLD_LIGHT_COLOR,
} from "@/components/experience/theme";
import {
  CAMERA_TRACKS,
  CROSSING_BLADE,
  STAGES,
  evaluateTimeline,
  glyphDepthExtent,
  interpolateViewportCamera,
  interpolateKeyframes,
  segmentProgress,
} from "@/components/experience/timeline";

const GLYPH_HALF_EXTENTS = [1.05, 1, 0.24] as const;

function projectedGlyphBounds(
  progress: number,
  mode: "desktop" | "mobile",
  viewportWidth: number,
  viewportHeight: number,
) {
  const aspect = viewportWidth / viewportHeight;
  const frame = evaluateTimeline(progress, mode);
  const viewportPose = glyphViewportPose(progress, aspect, viewportWidth);
  const cameraPose = interpolateViewportCamera(progress, viewportWidth);
  const camera = new PerspectiveCamera(cameraPose.fov, aspect, 0.05, 130);
  camera.position.set(...cameraPose.position);
  camera.lookAt(new Vector3(...cameraPose.target));
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);

  const rotation = new Euler(...frame.glyph.rotation);
  const projected = [-1, 1].flatMap((xSign) =>
    [-1, 1].flatMap((ySign) =>
      [-1, 1].map((zSign) =>
        new Vector3(
          GLYPH_HALF_EXTENTS[0] * xSign,
          GLYPH_HALF_EXTENTS[1] * ySign,
          GLYPH_HALF_EXTENTS[2] * zSign,
        )
          .multiplyScalar(frame.glyph.scale * viewportPose.scaleMultiplier)
          .applyEuler(rotation)
          .add(
            new Vector3(...frame.glyph.position).add(
              new Vector3(...viewportPose.offset),
            ),
          )
          .project(camera),
      ),
    ),
  );

  const xs = projected.map((point) => point.x);
  const ys = projected.map((point) => point.y);
  return {
    left: Math.min(...xs),
    right: Math.max(...xs),
    bottom: Math.min(...ys),
    top: Math.max(...ys),
    width: (Math.max(...xs) - Math.min(...xs)) / 2,
    height: (Math.max(...ys) - Math.min(...ys)) / 2,
  };
}

describe("reference-faithful experience timeline", () => {
  it("keeps overlay text at WCAG AA contrast throughout both theme transitions", () => {
    const dark = new Color(WORLD_DARK_COLOR);
    const light = new Color(WORLD_LIGHT_COLOR);
    const luminance = (color: Color) =>
      0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b;

    for (let step = 0; step <= 1_000; step += 1) {
      const mix = step / 1_000;
      const background = dark.clone().lerp(light, mix);
      const foreground = new Color(resolveExperiencePalette(mix).foreground);
      const brighter = Math.max(luminance(background), luminance(foreground));
      const darker = Math.min(luminance(background), luminance(foreground));
      const contrast = (brighter + 0.05) / (darker + 0.05);
      expect(contrast).toBeGreaterThanOrEqual(4.5);
    }
  });

  it.each([
    [0, "hero"],
    [0.085, "portfolio"],
    [0.505, "proof"],
    [0.575, "crossing"],
    [0.69, "mission"],
    [0.765, "vision"],
    [0.835, "values"],
    [0.955, "closing"],
    [1, "closing"],
  ] as const)("maps progress %s to %s", (progress, stage) => {
    expect(evaluateTimeline(progress, "desktop").stage).toBe(stage);
  });

  it("hands full-screen overlay ownership across an empty boundary frame", () => {
    const orderedStages = Object.entries(STAGES) as [
      keyof typeof STAGES,
      readonly [number, number],
    ][];

    for (let index = 1; index < orderedStages.length; index += 1) {
      const [outgoingName] = orderedStages[index - 1];
      const [incomingName, [boundary]] = orderedStages[index];
      const boundaryFrame = evaluateTimeline(boundary, "desktop");

      expect(boundaryFrame.overlay[outgoingName], `${outgoingName} at ${boundary}`).toBe(0);
      expect(boundaryFrame.overlay[incomingName], `${incomingName} at ${boundary}`).toBe(0);

      for (let step = -100; step <= 100; step += 1) {
        const frame = evaluateTimeline(boundary + step * 0.00001, "desktop");
        const visibleStages = orderedStages.filter(
          ([stage]) => frame.overlay[stage] > Number.EPSILON,
        );
        expect(visibleStages.length, `visible overlays near ${boundary}`).toBeLessThanOrEqual(1);
      }
    }
  });

  it("clamps invalid and out-of-range progress", () => {
    expect(evaluateTimeline(Number.NaN, "desktop").progress).toBe(0);
    expect(evaluateTimeline(-10, "desktop").progress).toBe(0);
    expect(evaluateTimeline(10, "desktop").progress).toBe(1);
    expect(segmentProgress(0.4, 0.5, 0.5)).toBe(0);
    expect(segmentProgress(0.6, 0.5, 0.5)).toBe(1);
  });

  it("gives all eight products an equal, stable focus slot", () => {
    const [start, end] = STAGES.portfolio;
    for (let index = 0; index < 8; index += 1) {
      const center = start + ((index + 0.5) / 8) * (end - start);
      const frame = evaluateTimeline(center, "desktop");
      expect(frame.productIndex).toBe(index);
      expect(frame.productProgress).toBeCloseTo(0.5, 6);
    }
  });

  it("assigns each product slot boundary to exactly one semantic owner", () => {
    const [start, end] = STAGES.portfolio;
    const epsilon = (end - start) / 1_000_000;

    for (let incoming = 1; incoming < 8; incoming += 1) {
      const boundary = start + (incoming / 8) * (end - start);
      expect(evaluateTimeline(boundary - epsilon, "desktop").productIndex).toBe(incoming - 1);

      const frame = evaluateTimeline(boundary, "desktop");
      expect(frame.productIndex).toBe(incoming);
      expect(frame.productProgress).toBeCloseTo(0, 10);
      expect(evaluateTimeline(boundary + epsilon, "desktop").productIndex).toBe(incoming);
    }
  });

  it("preloads only the active portfolio card and its immediate neighbours", () => {
    expect(shouldLoadPortfolioMedia(0, 0, 0)).toBe(false);
    expect(shouldLoadPortfolioMedia(1, 0, 0)).toBe(true);
    expect(shouldLoadPortfolioMedia(1, 0.5, 0)).toBe(true);
    expect(shouldLoadPortfolioMedia(1, 1.2, 0)).toBe(true);
    expect(shouldLoadPortfolioMedia(1, 1.35, 0)).toBe(false);
    expect(shouldLoadPortfolioMedia(1, 0, 0.25)).toBe(false);
    expect(shouldLoadPortfolioMedia(Number.NaN, 0, 0)).toBe(false);
  });

  it("keeps the complete Y volume behind the active card, then crosses once during proof", () => {
    const [start, end] = STAGES.portfolio;
    for (let step = 0; step <= 320; step += 1) {
      const progress = start + (step / 320) * (end - start - Number.EPSILON);
      const frame = evaluateTimeline(progress, "desktop");
      const activeCardDepth = -1.25 - frame.productIndex * 1.36;
      const glyphFront = frame.glyph.position[2] + glyphDepthExtent(
        frame.glyph.rotation,
        frame.glyph.scale,
      );
      expect(glyphFront).toBeLessThan(activeCardDepth - 0.1);
    }

    const beforeCross = evaluateTimeline(0.515, "desktop");
    const beforeCardDepth =
      (-1.25 - 7 * 1.36) + (-13.98 - (-1.25 - 7 * 1.36)) * beforeCross.world.proofMorph;
    const beforeFront = beforeCross.glyph.position[2] + glyphDepthExtent(
      beforeCross.glyph.rotation,
      beforeCross.glyph.scale,
    );
    expect(beforeFront).toBeLessThan(beforeCardDepth);

    const afterCross = evaluateTimeline(0.565, "desktop");
    const afterCardDepth =
      (-1.25 - 7 * 1.36) + (-13.98 - (-1.25 - 7 * 1.36)) * afterCross.world.proofMorph;
    const afterBack = afterCross.glyph.position[2] - glyphDepthExtent(
      afterCross.glyph.rotation,
      afterCross.glyph.scale,
    );
    expect(afterBack).toBeGreaterThan(afterCardDepth);

    let crossings = 0;
    let previousSide = -1;
    for (let step = 1; step <= 240; step += 1) {
      const progress = STAGES.proof[0] + (step / 240) * (STAGES.proof[1] - STAGES.proof[0]);
      const frame = evaluateTimeline(progress, "desktop");
      const cardDepth =
        (-1.25 - 7 * 1.36) + (-13.98 - (-1.25 - 7 * 1.36)) * frame.world.proofMorph;
      const side = Math.sign(frame.glyph.position[2] - cardDepth) || previousSide;
      if (side !== previousSide) crossings += 1;
      previousSide = side;
    }
    expect(crossings).toBe(1);
  });

  it("gives all eight proof cards an equal, stable focus slot", () => {
    const [start, end] = STAGES.proof;
    for (let index = 0; index < 8; index += 1) {
      const center = start + ((index + 0.5) / 8) * (end - start);
      const frame = evaluateTimeline(center, "desktop");
      expect(frame.proofIndex).toBe(index);
      expect(frame.proofProgress).toBeCloseTo(0.5, 6);
    }
  });

  it("gives all four values an equal focus slot", () => {
    const [start, end] = STAGES.values;
    for (let index = 0; index < 4; index += 1) {
      const center = start + ((index + 0.5) / 4) * (end - start);
      const frame = evaluateTimeline(center, "desktop");
      expect(frame.valueIndex).toBe(index);
      expect(frame.valueProgress).toBeCloseTo(0.5, 6);
    }
  });

  it("assigns each value slot boundary to exactly one semantic owner", () => {
    const [start, end] = STAGES.values;
    const epsilon = (end - start) / 1_000_000;

    for (let incoming = 1; incoming < 4; incoming += 1) {
      const boundary = start + (incoming / 4) * (end - start);
      expect(evaluateTimeline(boundary - epsilon, "desktop").valueIndex).toBe(incoming - 1);

      const frame = evaluateTimeline(boundary, "desktop");
      expect(frame.valueIndex).toBe(incoming);
      expect(frame.valueProgress).toBeCloseTo(0, 10);
      expect(evaluateTimeline(boundary + epsilon, "desktop").valueIndex).toBe(incoming);
    }
  });

  it("exposes deterministic sub-beats for works, vision, service, and closing", () => {
    expect(evaluateTimeline(0.05, "desktop").world.worksBackdropMix).toBe(0);
    expect(evaluateTimeline(0.2, "desktop").world.worksBackdropMix).toBe(1);
    expect(evaluateTimeline(0.53, "desktop").world.worksBackdropMix).toBe(0);

    expect(evaluateTimeline(0.78, "desktop").world.visionPortal).toBe(0);
    expect(evaluateTimeline(0.84, "desktop").world.visionPortal).toBe(1);
    expect(evaluateTimeline(0.78, "desktop").world.servicePortalOpacity).toBe(0);
    expect(evaluateTimeline(0.805, "desktop").world.servicePortalOpacity).toBeGreaterThan(0.9);
    expect(evaluateTimeline(0.846, "desktop").world.servicePortalOpacity).toBeGreaterThan(0.25);
    expect(evaluateTimeline(0.846, "desktop").world.servicePortalOpacity).toBeLessThan(0.75);
    expect(evaluateTimeline(0.855, "desktop").world.servicePortalOpacity).toBeLessThan(0.05);
    expect(evaluateTimeline(0.8, "desktop").world.serviceIn).toBe(0);
    expect(evaluateTimeline(0.835, "desktop").world.serviceIn).toBeLessThan(0.1);
    expect(evaluateTimeline(0.846, "desktop").world.serviceIn).toBeGreaterThan(0.25);
    expect(evaluateTimeline(0.846, "desktop").world.serviceIn).toBeLessThan(0.75);
    expect(evaluateTimeline(0.855, "desktop").world.serviceIn).toBeGreaterThan(0.9);
    expect(evaluateTimeline(0.87, "desktop").world.serviceIn).toBe(1);
    expect(evaluateTimeline(0.91, "desktop").world.serviceOut).toBe(0);
    expect(evaluateTimeline(0.98, "desktop").world.serviceOut).toBe(1);
    expect(evaluateTimeline(0.96, "desktop").world.closingContent).toBe(0);
    expect(evaluateTimeline(1, "desktop").world.closingContent).toBe(1);
  });

  it("keeps camera vectors finite at every checkpoint", () => {
    for (let step = 0; step <= 100; step += 1) {
      const frame = evaluateTimeline(step / 100, "desktop");
      const values = [
        ...frame.camera.position,
        ...frame.camera.target,
        ...frame.glyph.position,
        ...frame.glyph.rotation,
        frame.camera.fov,
        frame.glyph.scale,
      ];
      expect(values.every(Number.isFinite)).toBe(true);
    }
  });

  it("uses a dedicated mobile camera track", () => {
    const desktop = evaluateTimeline(0.42, "desktop").camera;
    const mobile = evaluateTimeline(0.42, "mobile").camera;
    expect(mobile.position).not.toEqual(desktop.position);
    expect(mobile.target).not.toEqual(desktop.target);
    expect(mobile.fov).toBeGreaterThan(desktop.fov);
  });

  it("blends camera and glyph composition continuously across the responsive seam", () => {
    expect(Math.abs(viewportMobileMix(767) - viewportMobileMix(768))).toBeLessThan(0.01);

    const before = projectedGlyphBounds(0, "mobile", 767, 1024);
    const after = projectedGlyphBounds(0, "desktop", 768, 1024);
    expect(Math.abs(before.width - after.width)).toBeLessThan(0.02);
    expect(Math.abs(before.height - after.height)).toBeLessThan(0.02);
    expect(Math.abs((before.left + before.right) - (after.left + after.right))).toBeLessThan(0.04);
    expect(Math.abs((before.bottom + before.top) - (after.bottom + after.top))).toBeLessThan(0.04);
  });

  it("keeps glyph motion continuous at every stage boundary", () => {
    for (const [stage, [start]] of Object.entries(STAGES)) {
      if (start === 0) continue;
      const before = new Vector3(
        ...evaluateTimeline(start - 0.00001, "desktop").glyph.position,
      );
      const after = new Vector3(
        ...evaluateTimeline(start + 0.00001, "desktop").glyph.position,
      );
      expect(before.distanceTo(after), `${stage} boundary`).toBeLessThan(0.03);
    }
  });

  it("keeps the opening Y subordinate to the copy across representative viewports", () => {
    const desktop = projectedGlyphBounds(0, "desktop", 1440, 900);
    expect(desktop.width).toBeLessThanOrEqual(0.35);
    expect(desktop.height).toBeLessThanOrEqual(0.55);
    expect(desktop.height).toBeGreaterThanOrEqual(0.42);
    expect(desktop.left).toBeGreaterThanOrEqual(-0.98);
    expect(desktop.right).toBeLessThanOrEqual(0.98);
    expect(desktop.bottom).toBeGreaterThanOrEqual(-0.98);
    expect(desktop.top).toBeLessThanOrEqual(0.98);

    const tablet = projectedGlyphBounds(0, "desktop", 768, 1024);
    expect(tablet.width).toBeLessThanOrEqual(0.48);
    expect(tablet.height).toBeLessThanOrEqual(0.36);
    expect(tablet.left).toBeGreaterThanOrEqual(-0.98);
    expect(tablet.right).toBeLessThanOrEqual(0.98);

    const mobile = projectedGlyphBounds(0, "mobile", 390, 844);
    expect(mobile.width).toBeLessThanOrEqual(0.58);
    expect(mobile.height).toBeGreaterThanOrEqual(0.22);
    expect(mobile.left).toBeGreaterThanOrEqual(-0.98);
    expect(mobile.right).toBeLessThanOrEqual(0.98);
    expect(mobile.bottom).toBeGreaterThanOrEqual(-0.98);
    expect(mobile.top).toBeLessThanOrEqual(0.98);

    const narrowMobile = projectedGlyphBounds(0, "mobile", 320, 900);
    expect(narrowMobile.width).toBeLessThanOrEqual(0.86);
    expect(narrowMobile.height).toBeGreaterThanOrEqual(0.22);

    for (const mode of ["desktop", "mobile"] as const) {
      const [width, height] = mode === "desktop" ? [1440, 900] : [390, 844];
      const endOfHero = projectedGlyphBounds(
        STAGES.portfolio[0] - 0.00001,
        mode,
        width,
        height,
      );
      expect(endOfHero.width).toBeLessThanOrEqual(mode === "desktop" ? 0.46 : 0.66);
      expect(endOfHero.height).toBeLessThanOrEqual(0.68);
    }
  });

  it("centers the opening Y and gives short phones a collision-safe pose", () => {
    const desktopPose = glyphViewportPose(0, 1440 / 900, 1440);
    expect(Math.abs(desktopPose.offset[0])).toBeLessThanOrEqual(0.05);
    expect(desktopPose.scaleMultiplier).toBeGreaterThanOrEqual(0.72);
    expect(desktopPose.scaleMultiplier).toBeLessThan(0.84);

    const tallPhone = glyphViewportPose(0, 390 / 844, 390);
    const shortPhone = glyphViewportPose(0, 390 / 667, 390);
    const narrowShortPhone = glyphViewportPose(0, 320 / 700, 320);
    expect(shortPhone.offset[1]).toBeGreaterThan(tallPhone.offset[1]);
    expect(shortPhone.scaleMultiplier).toBeLessThan(tallPhone.scaleMultiplier);
    expect(narrowShortPhone.offset[1]).toBeGreaterThan(tallPhone.offset[1]);

    for (const [width, height] of [[390, 667], [320, 700]] as const) {
      const bounds = projectedGlyphBounds(0, "mobile", width, height);
      expect(bounds.left).toBeGreaterThanOrEqual(-0.88);
      expect(bounds.right).toBeLessThanOrEqual(0.88);
      expect(bounds.bottom).toBeGreaterThanOrEqual(-0.88);
      expect(bounds.top).toBeLessThanOrEqual(0.88);
    }
  });

  it("keeps the complete VISION Y inside the frustum before the SERVICE portal opens", () => {
    for (const progress of [0.765, 0.805, 0.825, 0.835]) {
      const bounds = projectedGlyphBounds(progress, "desktop", 1440, 900);
      expect(bounds.width, `width at ${progress}`).toBeGreaterThanOrEqual(0.28);
      expect(bounds.width, `width at ${progress}`).toBeLessThanOrEqual(0.46);
      expect(bounds.height, `height at ${progress}`).toBeGreaterThanOrEqual(0.45);
      expect(bounds.height, `height at ${progress}`).toBeLessThanOrEqual(0.7);
      expect(bounds.left, `left at ${progress}`).toBeGreaterThanOrEqual(-0.9);
      expect(bounds.right, `right at ${progress}`).toBeLessThanOrEqual(0.9);
      expect(bounds.bottom, `bottom at ${progress}`).toBeGreaterThanOrEqual(-0.9);
      expect(bounds.top, `top at ${progress}`).toBeLessThanOrEqual(0.9);
    }

    const mobilePortal = projectedGlyphBounds(0.825, "mobile", 390, 844);
    expect(mobilePortal.width).toBeLessThanOrEqual(0.72);
    expect(mobilePortal.bottom).toBeGreaterThanOrEqual(0);
    expect(mobilePortal.top).toBeLessThanOrEqual(0.82);
  });

  it("moves both cameras completely through the physical white blade during crossing", () => {
    const bladeExitZ = CROSSING_BLADE.centerZ - CROSSING_BLADE.halfDepth;

    for (const mode of ["desktop", "mobile"] as const) {
      let previousSide = Math.sign(
        evaluateTimeline(STAGES.crossing[0], mode).camera.position[2] - bladeExitZ,
      );
      let crossings = 0;

      for (let step = 1; step <= 320; step += 1) {
        const progress = STAGES.crossing[0] +
          (step / 320) * (STAGES.crossing[1] - STAGES.crossing[0]);
        const side = Math.sign(evaluateTimeline(progress, mode).camera.position[2] - bladeExitZ) || previousSide;
        if (side !== previousSide) crossings += 1;
        previousSide = side;
      }

      expect(crossings).toBe(1);
      expect(evaluateTimeline(STAGES.crossing[1], mode).camera.position[2]).toBeLessThan(
        bladeExitZ - 0.1,
      );
    }
  });

  it("fits the final proof ledger inside desktop and portrait camera frustums", () => {
    const cases = [
      { mode: "desktop" as const, aspect: 1440 / 900 },
      { mode: "mobile" as const, aspect: 390 / 844 },
    ];

    for (const { mode, aspect } of cases) {
      const frame = evaluateTimeline(STAGES.proof[1], mode);
      const camera = new PerspectiveCamera(frame.camera.fov, aspect, 0.05, 130);
      camera.position.set(...frame.camera.position);
      camera.lookAt(new Vector3(...frame.camera.target));
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld(true);

      for (let index = 0; index < 8; index += 1) {
        const pose = proofLayoutPose(index, mode);
        const halfWidth = 3.9 / 2;
        const halfHeight = 2.65 / 2;
        for (const x of [-halfWidth, halfWidth]) {
          for (const y of [-halfHeight, halfHeight]) {
            const scaledY = y * pose.scale;
            const point = new Vector3(
              pose.position[0] + x * pose.scale,
              pose.position[1] + scaledY * Math.cos(pose.rotation[0]),
              pose.position[2] + scaledY * Math.sin(pose.rotation[0]),
            ).project(camera);
            expect(Math.abs(point.x)).toBeLessThanOrEqual(0.96);
            expect(Math.abs(point.y)).toBeLessThanOrEqual(0.96);
          }
        }
      }
    }
  });

  it("hits camera keyframe endpoints exactly", () => {
    for (const mode of ["desktop", "mobile"] as const) {
      const keys = CAMERA_TRACKS[mode];
      expect(interpolateKeyframes(keys, 0)).toEqual({
        position: keys[0].position,
        target: keys[0].target,
        fov: keys[0].fov,
      });
      expect(interpolateKeyframes(keys, 1)).toEqual({
        position: keys.at(-1)!.position,
        target: keys.at(-1)!.target,
        fov: keys.at(-1)!.fov,
      });
    }
  });

  it("keeps the complete closing Y in front of the camera and draws its outline", () => {
    const frame = evaluateTimeline(1, "desktop");
    expect(frame.glyph.position[2] - frame.camera.position[2]).toBeLessThan(-5);
    expect(frame.glyph.scale).toBeLessThanOrEqual(2);
    expect(frame.glyph.outlineMix).toBe(1);
    expect(frame.world.closingDraw).toBe(1);
  });

  it("crosses from dark to white monotonically, then returns to dark for values", () => {
    let previous = 0;
    for (let step = 0; step <= 100; step += 1) {
      const progress = STAGES.crossing[0] +
        (step / 100) * (STAGES.crossing[1] - STAGES.crossing[0]);
      const whiteMix = evaluateTimeline(progress, "desktop").world.whiteMix;
      expect(whiteMix).toBeGreaterThanOrEqual(previous);
      previous = whiteMix;
    }
    expect(previous).toBe(1);
    expect(evaluateTimeline(0.72, "desktop").world.themeMix).toBe(1);
    expect(evaluateTimeline(0.805, "desktop").world.themeMix).toBe(1);
    expect(evaluateTimeline(0.855, "desktop").world.themeMix).toBe(0);
    expect(evaluateTimeline(0.98, "desktop").world.themeMix).toBe(0);
  });
});
