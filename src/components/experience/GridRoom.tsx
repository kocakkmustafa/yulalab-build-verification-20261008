"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import {
  BackSide,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  DoubleSide,
  LinearFilter,
  ShaderMaterial,
  SRGBColorSpace,
  Vector3,
} from "three";
import type { QualityTier, TimelineFrame } from "./types";
import { CROSSING_BLADE, STAGES } from "./timeline";

export type GridRoomProps = {
  frame: TimelineFrame;
  tier: QualityTier;
};

const ROOM_VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  varying float vViewDepth;

  void main() {
    vUv = uv;
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    vViewDepth = -viewPosition.z;
    gl_Position = projectionMatrix * viewPosition;
  }
`;

const ROOM_FRAGMENT_SHADER = /* glsl */ `
  uniform float uWhiteMix;
  uniform float uOpacity;
  varying vec2 vUv;
  varying float vViewDepth;

  float gridLine(vec2 uv, vec2 density) {
    vec2 coordinate = uv * density;
    vec2 derivative = max(fwidth(coordinate), vec2(0.0001));
    vec2 distanceToLine = abs(fract(coordinate - 0.5) - 0.5) / derivative;
    return 1.0 - min(min(distanceToLine.x, distanceToLine.y), 1.0);
  }

  void main() {
    float minor = gridLine(vUv, vec2(72.0, 28.0));
    float major = gridLine(vUv, vec2(18.0, 7.0));
    float distanceFade = 1.0 - smoothstep(26.0, 72.0, vViewDepth);
    float verticalFade = smoothstep(0.0, 0.1, vUv.y) * (1.0 - smoothstep(0.9, 1.0, vUv.y));

    vec3 darkMinor = vec3(0.29, 0.09, 0.55);
    vec3 darkMajor = vec3(0.68, 0.30, 1.0);
    vec3 lightMinor = vec3(0.66, 0.64, 0.69);
    vec3 lightMajor = vec3(0.24, 0.21, 0.29);
    vec3 color = mix(
      mix(darkMinor, darkMajor, major),
      mix(lightMinor, lightMajor, major),
      uWhiteMix
    );
    float alpha = (minor * 0.25 + major * 0.72) * distanceFade * verticalFade * uOpacity;

    if (alpha < 0.006) discard;
    gl_FragColor = vec4(color, alpha);
  }
`;

const HALFTONE_VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const HALFTONE_FRAGMENT_SHADER = /* glsl */ `
  uniform float uWhiteMix;
  uniform float uOpacity;
  varying vec2 vUv;

  void main() {
    vec2 cells = vec2(46.0, 28.0);
    vec2 local = fract(vUv * cells) - 0.5;
    float radial = length(local);
    float field = 0.18 + 0.15 * sin(vUv.x * 11.0 + vUv.y * 7.0);
    float dotMask = 1.0 - smoothstep(field, field + 0.08, radial);
    float edgeFade = smoothstep(0.0, 0.16, vUv.x) *
      (1.0 - smoothstep(0.84, 1.0, vUv.x)) *
      smoothstep(0.0, 0.2, vUv.y) *
      (1.0 - smoothstep(0.8, 1.0, vUv.y));
    vec3 color = mix(vec3(0.54, 0.22, 0.88), vec3(0.25, 0.23, 0.28), uWhiteMix);
    float alpha = dotMask * edgeFade * uOpacity * mix(0.32, 0.17, uWhiteMix);

    if (alpha < 0.008) discard;
    gl_FragColor = vec4(color, alpha);
  }
`;

function makeWordmarkTexture(label: string): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 2048;
  canvas.height = 512;
  const context = canvas.getContext("2d");

  if (context) {
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#f2eaff";
    context.font = "900 300px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(label, canvas.width / 2, canvas.height / 2 + 12);

    context.globalCompositeOperation = "destination-out";
    context.globalAlpha = 0.13;
    context.fillText(label, canvas.width / 2 + 11, canvas.height / 2 + 12);
  }

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.generateMipmaps = false;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

function makeLineGeometry(positions: number[]): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
  return geometry;
}

function ClosingGeometry({ draw }: { draw: number }) {
  const geometries = useMemo(() => {
    const grid: number[] = [];
    for (let index = -5; index <= 5; index += 1) {
      const offset = index * 0.72;
      grid.push(-3.6, offset, 0, 3.6, offset, 0);
      grid.push(offset, -3.6, 0, offset, 3.6, 0);
    }

    const axes = makeLineGeometry([
      -5.2, 0, 0, 5.2, 0, 0,
      0, -4.4, 0, 0, 4.4, 0,
      0, 0, -2.2, 0, 0, 2.2,
    ]);
    const gridGeometry = makeLineGeometry(grid);
    const circle = new BufferGeometry().setFromPoints(
      Array.from({ length: 97 }, (_, index) => {
        const angle = (index / 96) * Math.PI * 2;
        return new Vector3(Math.cos(angle) * 2.55, Math.sin(angle) * 2.55, 0);
      }),
    );

    return { axes, grid: gridGeometry, circle };
  }, []);

  useEffect(
    () => () => {
      geometries.axes.dispose();
      geometries.grid.dispose();
      geometries.circle.dispose();
    },
    [geometries],
  );

  const scale = Math.max(0.0001, draw);

  return (
    <group position={[-2.2, 0, -36.3]} scale={[scale, scale, 1]}>
      <lineSegments geometry={geometries.grid}>
        <lineBasicMaterial
          color="#4c4652"
          depthWrite={false}
          opacity={draw * 0.36}
          transparent
        />
      </lineSegments>
      <lineSegments geometry={geometries.axes}>
        <lineBasicMaterial
          color="#17131b"
          depthWrite={false}
          opacity={draw * 0.88}
          transparent
        />
      </lineSegments>
      <lineLoop geometry={geometries.circle}>
        <lineBasicMaterial
          color="#aa36c9"
          depthWrite={false}
          opacity={draw * 0.76}
          transparent
        />
      </lineLoop>
    </group>
  );
}

export function GridRoom({ frame, tier }: GridRoomProps) {
  const gridMaterial = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: {
          uWhiteMix: { value: 0 },
          uOpacity: { value: 1 },
        },
        vertexShader: ROOM_VERTEX_SHADER,
        fragmentShader: ROOM_FRAGMENT_SHADER,
        transparent: true,
        depthWrite: false,
        side: BackSide,
        toneMapped: false,
      }),
    [],
  );
  const halftoneMaterial = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: {
          uWhiteMix: { value: 0 },
          uOpacity: { value: 1 },
        },
        vertexShader: HALFTONE_VERTEX_SHADER,
        fragmentShader: HALFTONE_FRAGMENT_SHADER,
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
        toneMapped: false,
      }),
    [],
  );
  const yulaWordmark = useMemo(() => makeWordmarkTexture("YULA"), []);
  const worksWordmark = useMemo(() => makeWordmarkTexture("WORKS"), []);
  const bladeColor = useMemo(() => new Color("#fffdf7"), []);
  const radialSegments = tier === "high" ? 112 : tier === "medium" ? 72 : 40;
  const heightSegments = tier === "low" ? 12 : 24;

  useFrame(() => {
    gridMaterial.uniforms.uWhiteMix.value = frame.world.themeMix;
    gridMaterial.uniforms.uOpacity.value = frame.world.roomOpacity;
    halftoneMaterial.uniforms.uWhiteMix.value = frame.world.themeMix;
    halftoneMaterial.uniforms.uOpacity.value = frame.world.roomOpacity;
  });

  useEffect(
    () => () => {
      gridMaterial.dispose();
      halftoneMaterial.dispose();
      yulaWordmark.dispose();
      worksWordmark.dispose();
    },
    [gridMaterial, halftoneMaterial, worksWordmark, yulaWordmark],
  );

  const blade = frame.world.bladeProgress;
  const bladeY = -1.65 + blade * 1.35;
  const wordmarkZ = frame.progress < STAGES.portfolio[0]
    ? -1.25
    : -2.35 - frame.productFloat * 1.36;

  return (
    <group>
      <mesh position={[0, 0, -11.5]} rotation={[0, -Math.PI * 0.08, 0]}>
        <cylinderGeometry
          args={[
            28,
            28,
            19,
            radialSegments,
            heightSegments,
            true,
            Math.PI * 0.17,
            Math.PI * 1.66,
          ]}
        />
        <primitive attach="material" object={gridMaterial} />
      </mesh>

      {[
        { position: [-7.2, 0.8, -4.8] as const, rotation: [0, 0.22, 0.04] as const },
        { position: [7.4, -0.7, -13.2] as const, rotation: [0, -0.24, -0.03] as const },
        { position: [-6.4, 1.1, -22.5] as const, rotation: [0, 0.18, 0] as const },
      ].map((panel, index) => (
        <mesh
          key={index}
          position={panel.position}
          rotation={panel.rotation}
          scale={index === 1 ? [1.2, 1.2, 1] : [1, 1, 1]}
        >
          <planeGeometry args={[7.5, 5.2, 1, 1]} />
          <primitive attach="material" object={halftoneMaterial} />
        </mesh>
      ))}

      <mesh position={[0, 0.1, wordmarkZ]} renderOrder={-2}>
        <planeGeometry args={[14.2, 3.55]} />
        <meshBasicMaterial
          color={frame.world.themeMix > 0.5 ? "#26212b" : "#ffffff"}
          depthTest
          depthWrite={false}
          map={yulaWordmark}
          opacity={frame.world.wordmarkOpacity * (1 - frame.world.worksBackdropMix)}
          toneMapped={false}
          transparent
        />
      </mesh>

      <mesh position={[0, 0.1, wordmarkZ - 0.02]} renderOrder={-2}>
        <planeGeometry args={[15.8, 3.55]} />
        <meshBasicMaterial
          color="#ffffff"
          depthTest
          depthWrite={false}
          map={worksWordmark}
          opacity={frame.world.worksBackdropMix * 0.82}
          toneMapped={false}
          transparent
        />
      </mesh>

      <mesh
        castShadow={tier !== "low"}
        position={[0, bladeY, CROSSING_BLADE.centerZ]}
        receiveShadow={tier !== "low"}
        scale={[1, Math.max(0.0001, blade * 0.18), 1]}
        visible={blade > 0.001}
      >
        <boxGeometry args={[15.5, 9.8, CROSSING_BLADE.halfDepth * 2, 1, 1, 1]} />
        <meshBasicMaterial
          color={bladeColor}
          toneMapped={false}
        />
      </mesh>

      <ClosingGeometry draw={frame.world.closingDraw} />
    </group>
  );
}
