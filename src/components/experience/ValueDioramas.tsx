"use client";

import { RoundedBox } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import {
  Color,
  DoubleSide,
  PlaneGeometry,
  ShaderMaterial,
} from "three";
import { clamp01, segmentProgress, smoothstep } from "./timeline";
import type { QualityTier, TimelineFrame, Vec3 } from "./types";

export type ValueDioramasProps = {
  frame: TimelineFrame;
  tier: QualityTier;
};

type DioramaProps = {
  opacity: number;
  tier: QualityTier;
};

const SERVICE_PANEL_VERTEX_SHADER = `
  uniform float uMotion;
  uniform float uIndex;
  varying vec2 vUv;
  varying float vWave;

  void main() {
    vUv = uv;
    vec3 transformed = position;
    float longitudinal = (uv.x - 0.5) * 2.0;
    float envelope = sin(uv.y * 3.14159265);
    float wave = sin(longitudinal * 4.7 + uMotion * 0.72 + uIndex * 1.3);
    transformed.z += wave * envelope * 0.14;
    transformed.y += sin(longitudinal * 2.4 - uMotion * 0.34 + uIndex) * 0.07;
    vWave = wave;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
  }
`;

const SERVICE_PANEL_FRAGMENT_SHADER = `
  uniform vec3 uBackground;
  uniform vec3 uPrimary;
  uniform vec3 uAccent;
  uniform float uMotion;
  uniform float uIndex;
  uniform float uOpacity;
  varying vec2 vUv;
  varying float vWave;

  float boxMask(vec2 point, vec2 center, vec2 halfSize) {
    vec2 distanceToEdge = abs(point - center) - halfSize;
    return 1.0 - smoothstep(0.0, 0.018, max(distanceToEdge.x, distanceToEdge.y));
  }

  void main() {
    vec2 drift = vec2(fract(vUv.x + uMotion * 0.008 + uIndex * 0.11), vUv.y);
    float frameA = boxMask(drift, vec2(0.2, 0.62), vec2(0.15, 0.26));
    float frameB = boxMask(drift, vec2(0.53, 0.42), vec2(0.14, 0.31));
    float frameC = boxMask(drift, vec2(0.84, 0.58), vec2(0.13, 0.24));
    float frames = max(frameA, max(frameB, frameC));

    float footage = 0.5 + 0.5 * sin(
      drift.x * 19.0 + sin(drift.y * 11.0 - uMotion * 0.08) * 2.2 + uIndex * 2.7
    );
    float bands = 0.5 + 0.5 * sin(drift.y * 32.0 + uMotion * 0.12 + drift.x * 5.0);
    vec3 media = mix(uPrimary, uAccent, clamp(footage * 0.72 + bands * 0.28, 0.0, 1.0));
    vec3 color = mix(uBackground, media, frames * (0.55 + footage * 0.42));

    vec2 gridUv = fract(vUv * vec2(18.0, 10.0));
    float gridLine = 1.0 - smoothstep(0.0, 0.055, min(gridUv.x, gridUv.y));
    float scan = 0.5 + 0.5 * sin((vUv.y + uMotion * 0.006) * 220.0);
    color += uAccent * gridLine * 0.075;
    color += uPrimary * scan * 0.025;
    color *= 0.92 + vWave * 0.08;

    float edge = smoothstep(0.0, 0.16, vUv.x) * smoothstep(0.0, 0.16, 1.0 - vUv.x)
      * smoothstep(0.0, 0.18, vUv.y) * smoothstep(0.0, 0.18, 1.0 - vUv.y);
    gl_FragColor = vec4(color, uOpacity * edge * 0.96);
  }
`;

const SERVICE_PALETTES = [
  { background: "#231226", primary: "#ff796f", accent: "#ffd39a" },
  { background: "#140f25", primary: "#9f69ff", accent: "#47cfff" },
  { background: "#082126", primary: "#2bdeb6", accent: "#e6fff8" },
  { background: "#211126", primary: "#9d32ca", accent: "#f3dfff" },
] as const;

function CurvedServicePanel({
  index,
  motion,
  opacity,
  showFrame,
  tier,
}: {
  index: number;
  motion: number;
  opacity: number;
  showFrame: boolean;
  tier: QualityTier;
}) {
  const palette = SERVICE_PALETTES[index];
  const geometry = useMemo(() => {
    const horizontalSegments = tier === "low" ? 18 : tier === "medium" ? 32 : 48;
    const verticalSegments = tier === "low" ? 10 : tier === "medium" ? 18 : 24;
    const result = new PlaneGeometry(5.5, 3.25, horizontalSegments, verticalSegments);
    const positions = result.attributes.position;

    for (let vertex = 0; vertex < positions.count; vertex += 1) {
      const x = positions.getX(vertex);
      const y = positions.getY(vertex);
      const normalizedX = x / 2.75;
      const normalizedY = y / 1.625;
      const curve = -0.16 * normalizedX * normalizedX;
      const ripple = Math.sin(normalizedX * Math.PI * 2.1 + normalizedY * 1.4) * 0.075;
      positions.setZ(vertex, curve + ripple);
    }

    positions.needsUpdate = true;
    result.computeVertexNormals();
    return result;
  }, [tier]);

  useEffect(() => () => geometry.dispose(), [geometry]);
  const surfaceMaterial = useRef<ShaderMaterial | null>(null);
  const surfaceUniforms = useMemo(
    () => ({
      uBackground: { value: new Color(palette.background) },
      uPrimary: { value: new Color(palette.primary) },
      uAccent: { value: new Color(palette.accent) },
      uMotion: { value: 0 },
      uIndex: { value: index },
      uOpacity: { value: 0 },
    }),
    [index, palette.accent, palette.background, palette.primary],
  );

  useFrame(() => {
    if (!surfaceMaterial.current) return;
    surfaceMaterial.current.uniforms.uMotion.value = motion;
    surfaceMaterial.current.uniforms.uOpacity.value = opacity;
  // CameraRig settles at -50 and the portal target renders at -40. Updating
  // between them guarantees the offscreen SERVICE pass sees this frame's
  // motion/opacity rather than the previous demand-loop frame.
  }, -45);

  return (
    <group>
      <mesh geometry={geometry}>
        <shaderMaterial
          ref={surfaceMaterial}
          depthWrite={false}
          fragmentShader={SERVICE_PANEL_FRAGMENT_SHADER}
          side={DoubleSide}
          toneMapped={false}
          transparent
          uniforms={surfaceUniforms}
          vertexShader={SERVICE_PANEL_VERTEX_SHADER}
        />
      </mesh>
      {showFrame ? (
        <>
          <mesh geometry={geometry} position={[0, 0, 0.012]} scale={1.008}>
            <meshBasicMaterial
              color={palette.accent}
              depthWrite={false}
              opacity={opacity * 0.12}
              toneMapped={false}
              transparent
              wireframe
            />
          </mesh>
          <mesh position={[0, -1.46, 0.16]}>
            <planeGeometry args={[4.7, 0.018]} />
            <meshBasicMaterial
              color={palette.primary}
              depthWrite={false}
              opacity={opacity * 0.7}
              toneMapped={false}
              transparent
            />
          </mesh>
        </>
      ) : null}
    </group>
  );
}

function TransparencyDiorama({ opacity, tier }: DioramaProps) {
  const detail = tier === "low" ? 1 : tier === "medium" ? 2 : 3;
  const petals = [
    { position: [0, 0.7, 0.02] as Vec3, rotation: [0.2, -0.24, 0] as Vec3 },
    { position: [-0.66, 0.18, 0.14] as Vec3, rotation: [-0.12, 0.32, 1.24] as Vec3 },
    { position: [-0.42, -0.58, -0.06] as Vec3, rotation: [0.16, -0.3, 2.5] as Vec3 },
    { position: [0.42, -0.58, 0.12] as Vec3, rotation: [-0.18, 0.26, -2.5] as Vec3 },
    { position: [0.66, 0.18, -0.1] as Vec3, rotation: [0.1, -0.34, -1.24] as Vec3 },
  ];

  return (
    <group userData={{ value: "Transparency" }} rotation={[0.08, -0.12, 0.08]}>
      <mesh rotation={[0.35, -0.42, 0.18]}>
        <icosahedronGeometry args={[1.52, detail]} />
        <meshBasicMaterial
          color="#ffba78"
          depthWrite={false}
          opacity={opacity * 0.14}
          transparent
          wireframe
        />
      </mesh>
      {petals.map((petal, index) => (
        <RoundedBox
          args={[1.5, 0.48, 0.15]}
          key={index}
          position={petal.position}
          radius={0.22}
          rotation={petal.rotation}
          smoothness={tier === "low" ? 2 : tier === "medium" ? 4 : 6}
        >
          <meshPhysicalMaterial
            clearcoat={0.92}
            color={index % 2 === 0 ? "#ff796f" : "#ffd39a"}
            depthWrite={tier === "low"}
            emissive={index % 2 === 0 ? "#5f122d" : "#5c3019"}
            emissiveIntensity={0.12}
            ior={1.36}
            metalness={tier === "low" ? 0.24 : 0.02}
            opacity={opacity * (0.5 + index * 0.06)}
            roughness={tier === "low" ? 0.28 : 0.12}
            thickness={tier === "low" ? 0 : 0.55}
            transmission={tier === "low" ? 0 : 0.66}
            transparent
          />
        </RoundedBox>
      ))}
      <mesh rotation={[-0.3, 0.52, -0.2]}>
        <dodecahedronGeometry args={[0.42, tier === "high" ? 1 : 0]} />
        <meshPhysicalMaterial
          clearcoat={0.9}
          color="#fff4dc"
          emissive="#b34a49"
          emissiveIntensity={0.16}
          metalness={0.12}
          opacity={opacity * 0.88}
          roughness={0.16}
          transparent
        />
      </mesh>
    </group>
  );
}

function CraftDiorama({ opacity, tier }: DioramaProps) {
  const layers = [
    { position: [-0.72, -0.22, 0.28] as Vec3, color: "#af75ff", scale: [1.2, 0.3, 0.82] as Vec3 },
    { position: [0, 0.15, 0] as Vec3, color: "#47cfff", scale: [1.35, 0.3, 0.86] as Vec3 },
    { position: [0.78, 0.52, -0.26] as Vec3, color: "#ff5dc8", scale: [1.1, 0.3, 0.76] as Vec3 },
  ];

  return (
    <group userData={{ value: "Craft", product: "braavolabs" }}>
      <RoundedBox args={[3.75, 0.18, 2.45]} position={[0, -0.88, 0]} radius={0.09} smoothness={tier === "low" ? 2 : 5}>
        <meshStandardMaterial
          color="#17121f"
          metalness={0.52}
          opacity={opacity * 0.9}
          roughness={0.32}
          transparent
        />
      </RoundedBox>
      {layers.map((layer, index) => (
        <group key={index} position={layer.position}>
          <RoundedBox
            args={[layer.scale[0], layer.scale[1], layer.scale[2]]}
            radius={0.08}
            smoothness={tier === "low" ? 2 : 5}
          >
            <meshPhysicalMaterial
              clearcoat={0.65}
              color={layer.color}
              emissive={layer.color}
              emissiveIntensity={0.08}
              metalness={0.28}
              opacity={opacity * (0.72 + index * 0.08)}
              roughness={0.24}
              transparent
            />
          </RoundedBox>
          {[0, 1, 2].map((port) => (
            <mesh key={port} position={[-0.38 + port * 0.38, 0.18, 0.01]}>
              <cylinderGeometry args={[0.035, 0.035, 0.13, tier === "low" ? 8 : 16]} />
              <meshBasicMaterial
                color="#ffffff"
                opacity={opacity * 0.58}
                transparent
              />
            </mesh>
          ))}
        </group>
      ))}
      <mesh position={[0, -0.2, -0.72]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.035, 0.035, 3.1, tier === "low" ? 8 : 16]} />
        <meshBasicMaterial color="#8f7ea8" opacity={opacity * 0.48} transparent />
      </mesh>
    </group>
  );
}

function PrivacyDiorama({ opacity, tier }: DioramaProps) {
  const detail = tier === "low" ? 2 : tier === "medium" ? 3 : 5;
  const ringSegments = tier === "low" ? 40 : 96;

  return (
    <group userData={{ value: "Privacy", product: "lifeos" }}>
      <mesh rotation={[0.55, -0.42, 0.2]}>
        <icosahedronGeometry args={[0.98, detail]} />
        <meshPhysicalMaterial
          attenuationColor="#49d8c2"
          attenuationDistance={1.4}
          clearcoat={0.9}
          color="#2bdeb6"
          emissive="#073f40"
          emissiveIntensity={0.35}
          ior={1.35}
          metalness={tier === "low" ? 0.65 : 0.08}
          opacity={opacity * 0.9}
          roughness={tier === "low" ? 0.27 : 0.1}
          thickness={tier === "low" ? 0 : 0.8}
          transmission={tier === "low" ? 0 : 0.55}
          transparent
        />
      </mesh>
      {([
        [Math.PI / 2, 0.18, 0],
        [0.18, Math.PI / 2, 0.24],
        [0.72, 0.42, Math.PI / 2],
      ] as const).map((rotation, index) => (
        <mesh key={index} rotation={rotation}>
          <torusGeometry args={[1.35 + index * 0.25, 0.022, 7, ringSegments]} />
          <meshBasicMaterial
            color={index === 1 ? "#ffffff" : "#42f0ca"}
            depthWrite={false}
            opacity={opacity * (0.58 - index * 0.1)}
            toneMapped={false}
            transparent
          />
        </mesh>
      ))}
      <RoundedBox args={[3.45, 2.8, 0.12]} radius={0.12} smoothness={tier === "low" ? 2 : 4}>
        <meshBasicMaterial
          color="#3af0ca"
          depthWrite={false}
          opacity={opacity * 0.2}
          transparent
          wireframe
        />
      </RoundedBox>
      {([
        [-1.55, 1.15, 0.04],
        [1.55, 1.15, 0.04],
        [-1.55, -1.15, 0.04],
        [1.55, -1.15, 0.04],
      ] as const).map((position, index) => (
        <mesh key={index} position={position}>
          <boxGeometry args={[0.13, 0.13, 0.13]} />
          <meshBasicMaterial color="#ffffff" opacity={opacity * 0.68} transparent />
        </mesh>
      ))}
    </group>
  );
}

function ScienceDiorama({ opacity, tier }: DioramaProps) {
  const tubeSegments = tier === "low" ? 44 : tier === "medium" ? 84 : 132;
  const radialSegments = tier === "low" ? 5 : tier === "medium" ? 8 : 12;

  return (
    <group userData={{ value: "Science" }} rotation={[0.18, -0.3, -0.14]}>
      <mesh rotation={[0.42, 0.14, -0.22]}>
        <torusKnotGeometry
          args={[1.02, 0.16, tubeSegments, radialSegments, 2, 3]}
        />
        <meshPhysicalMaterial
          clearcoat={0.84}
          color="#9d32ca"
          emissive="#4c105e"
          emissiveIntensity={0.24}
          metalness={0.46}
          opacity={opacity * 0.9}
          roughness={0.2}
          transparent
        />
      </mesh>
      {tier !== "low" && (
        <mesh rotation={[-0.34, 0.64, 0.38]} scale={0.74}>
          <torusKnotGeometry
            args={[1.02, 0.07, tubeSegments, radialSegments, 3, 2]}
          />
          <meshPhysicalMaterial
            clearcoat={0.95}
            color="#f3dfff"
            depthWrite={false}
            emissive="#8a3ca7"
            emissiveIntensity={0.2}
            opacity={opacity * 0.62}
            roughness={0.13}
            thickness={0.35}
            transmission={0.34}
            transparent
          />
        </mesh>
      )}
      <mesh rotation={[-0.18, 0.38, 0.26]}>
        <dodecahedronGeometry args={[0.48, tier === "high" ? 1 : 0]} />
        <meshPhysicalMaterial
          clearcoat={0.88}
          color="#211525"
          emissive="#7c2492"
          emissiveIntensity={0.28}
          metalness={0.54}
          opacity={opacity}
          roughness={0.18}
          transparent
        />
      </mesh>
      <mesh rotation={[0.28, -0.18, 0.5]} scale={1.42}>
        <icosahedronGeometry args={[1, tier === "high" ? 2 : 1]} />
        <meshBasicMaterial
          color="#b26ad0"
          depthWrite={false}
          opacity={opacity * 0.12}
          transparent
          wireframe
        />
      </mesh>
    </group>
  );
}

export type ServiceCorridorVisualProps = ValueDioramasProps & {
  opacity: number;
  withDioramas?: boolean;
};

export function ServiceCorridorVisual({
  frame,
  tier,
  opacity: journeyOpacity,
  withDioramas = true,
}: ServiceCorridorVisualProps) {
  const components = [
    TransparencyDiorama,
    CraftDiorama,
    PrivacyDiorama,
    ScienceDiorama,
  ] as const;

  return (
    <group visible={journeyOpacity > 0.001}>
      {components.map((Diorama, index) => {
        const difference = index - frame.valueFloat;
        const distance = Math.abs(difference);
        const focus = 1 - smoothstep(clamp01(distance));
        const opacity = journeyOpacity * (0.025 + focus * 0.915);
        const ribbonPhase = difference * 0.82;
        const focusDepth = -25.4 - frame.valueFloat * 2.25;
        const showcase = index === components.length - 1
          ? smoothstep(segmentProgress(frame.progress, 0.925, 0.955))
          : 0;
        const scale = (0.62 + focus * 0.23) * (1 + showcase * 0.48);
        const position: Vec3 = [
          Math.sin(ribbonPhase) * 3.2 * (1 - showcase),
          Math.sin(ribbonPhase * 1.65) * 0.58 * (1 - showcase),
          focusDepth - (1 - Math.cos(ribbonPhase)) * 1.7,
        ];

        return (
          <group
            key={index}
            position={position}
            rotation={[
              Math.sin(ribbonPhase * 0.72) * -0.09,
              -Math.sin(ribbonPhase) * 0.58 * (1 - showcase),
              Math.sin(ribbonPhase * 1.35) * -0.08,
            ]}
            scale={scale}
          >
            <CurvedServicePanel
              index={index}
              motion={frame.progress * 18 + index * 0.7}
              opacity={opacity}
              showFrame={withDioramas}
              tier={tier}
            />
            {withDioramas ? (
              <group position={[0, 0.04, 0.34]} scale={0.45}>
                <Diorama opacity={opacity} tier={tier} />
              </group>
            ) : null}
          </group>
        );
      })}
    </group>
  );
}

export function ValueDioramas({ frame, tier }: ValueDioramasProps) {
  const enter = frame.world.serviceIn;
  const leave = 1 - frame.world.serviceOut;
  return (
    <ServiceCorridorVisual
      frame={frame}
      opacity={enter * leave}
      tier={tier}
    />
  );
}
