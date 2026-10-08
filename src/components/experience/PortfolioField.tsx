"use client";

import { useThree } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CanvasTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  SRGBColorSpace,
  Texture,
  TextureLoader,
} from "three";
import { clamp01, segmentProgress, smoothstep } from "./timeline";
import { proofLayoutPose, shouldLoadPortfolioMedia } from "./layout";
import type {
  ExperienceMode,
  ExperienceProduct,
  ExperienceScreenshot,
  QualityTier,
  TimelineFrame,
  Vec3,
} from "./types";

export type PortfolioFieldProps = {
  products: ExperienceProduct[];
  frame: TimelineFrame;
  mode: ExperienceMode;
  tier: QualityTier;
  onAssetsSettled?: () => void;
};

type LoadedTexture = {
  texture: Texture | null;
  aspect: number;
  failed: boolean;
  status: "loading" | "loaded" | "failed";
};

const DEFAULT_ASPECT = 1.6;

function imageAspect(texture: Texture): number {
  const image = texture.image as { width?: number; height?: number } | undefined;
  const width = image?.width ?? 0;
  const height = image?.height ?? 0;
  if (width <= 0 || height <= 0) return DEFAULT_ASPECT;
  return width / height;
}

function useCardTexture(
  path: string,
  tier: QualityTier,
  onSettled: (path: string) => void,
): LoadedTexture {
  const maxAnisotropy = useThree((state) => state.gl.capabilities.getMaxAnisotropy());
  const [state, setState] = useState<LoadedTexture>({
    texture: null,
    aspect: DEFAULT_ASPECT,
    failed: false,
    status: "loading",
  });
  const onSettledRef = useRef(onSettled);

  useEffect(() => {
    onSettledRef.current = onSettled;
  }, [onSettled]);

  useEffect(() => {
    let active = true;
    let loadedTexture: Texture | null = null;
    setState({ texture: null, aspect: DEFAULT_ASPECT, failed: false, status: "loading" });

    const loader = new TextureLoader();
    loader.load(
      path,
      (texture) => {
        loadedTexture = texture;
        texture.colorSpace = SRGBColorSpace;
        texture.minFilter = LinearMipmapLinearFilter;
        texture.magFilter = LinearFilter;
        texture.generateMipmaps = true;
        texture.needsUpdate = true;

        if (!active) {
          texture.dispose();
          return;
        }
        setState({
          texture,
          aspect: imageAspect(texture),
          failed: false,
          status: "loaded",
        });
      },
      undefined,
      () => {
        if (active) {
          setState({
            texture: null,
            aspect: DEFAULT_ASPECT,
            failed: true,
            status: "failed",
          });
        }
      },
    );

    return () => {
      active = false;
      loadedTexture?.dispose();
    };
  }, [path]);

  useEffect(() => {
    if (!state.texture) return;
    state.texture.anisotropy = Math.min(
      maxAnisotropy,
      tier === "high" ? 8 : tier === "medium" ? 4 : 2,
    );
    state.texture.needsUpdate = true;
  }, [maxAnisotropy, state.texture, tier]);

  // Effects run after React has committed the loaded/fallback material. The
  // Canvas lifecycle then waits one additional rendered frame before capture.
  useEffect(() => {
    if (state.status !== "loading") onSettledRef.current(path);
  }, [path, state.status]);

  return state;
}

function dimensionsForAspect(aspect: number): readonly [number, number] {
  const safeAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : DEFAULT_ASPECT;
  const maxWidth = 3.9;
  const maxHeight = 2.65;

  if (safeAspect >= maxWidth / maxHeight) {
    return [maxWidth, maxWidth / safeAspect];
  }
  return [maxHeight * safeAspect, maxHeight];
}

function makeFallbackTexture(product: ExperienceProduct): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 768;
  canvas.height = 480;
  const context = canvas.getContext("2d");

  if (context) {
    const scale = canvas.width / 1024;
    const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, product.colors.background);
    gradient.addColorStop(0.58, product.colors.primary);
    gradient.addColorStop(1, product.colors.secondary);
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);

    context.globalAlpha = 0.28;
    context.strokeStyle = product.colors.accent;
    context.lineWidth = 3 * scale;
    for (let index = -4; index < 14; index += 1) {
      context.beginPath();
      context.moveTo(index * 110 * scale, 0);
      context.lineTo((index * 110 + 420) * scale, canvas.height);
      context.stroke();
    }

    context.globalAlpha = 1;
    context.fillStyle = "#ffffff";
    context.font = `800 ${190 * scale}px ui-sans-serif, system-ui, -apple-system, sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(product.monogram, canvas.width * 0.64, 265 * scale);
    context.font = `650 ${62 * scale}px ui-sans-serif, system-ui, -apple-system, sans-serif`;
    context.fillText(product.name, canvas.width * 0.64, 455 * scale);
  }

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.generateMipmaps = false;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

function BrandedFallback({
  product,
  opacity,
  compact = false,
}: {
  product: ExperienceProduct;
  opacity: number;
  compact?: boolean;
}) {
  const texture = useMemo(() => makeFallbackTexture(product), [product]);
  useEffect(() => () => texture.dispose(), [texture]);
  const width = compact ? 3.15 : 3.75;
  const height = width / DEFAULT_ASPECT;

  return (
    <group>
      <mesh position={[0, 0, -0.055]}>
        <boxGeometry args={[width + 0.14, height + 0.14, 0.1]} />
        <meshStandardMaterial
          color={product.colors.background}
          depthWrite={opacity > 0.9}
          metalness={0.25}
          opacity={opacity}
          roughness={0.42}
          transparent
        />
      </mesh>
      <mesh>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial
          depthWrite={false}
          map={texture}
          opacity={opacity}
          toneMapped={false}
          transparent
        />
      </mesh>
    </group>
  );
}

function ScreenshotLayer({
  screenshot,
  product,
  layerIndex,
  opacity,
  tier,
  onAssetSettled,
}: {
  screenshot: ExperienceScreenshot;
  product: ExperienceProduct;
  layerIndex: number;
  opacity: number;
  tier: QualityTier;
  onAssetSettled: (path: string) => void;
}) {
  const loaded = useCardTexture(screenshot.path, tier, onAssetSettled);
  const [width, height] = dimensionsForAspect(loaded.aspect);
  const layerOpacity = opacity * (layerIndex === 0 ? 1 : 0.82);

  if (!loaded.texture || loaded.failed) {
    return (
      <group
        position={[layerIndex * 0.16, -layerIndex * 0.12, -layerIndex * 0.16]}
        rotation={[0, 0, layerIndex === 0 ? 0 : 0.025]}
      >
        <BrandedFallback compact={layerIndex > 0} opacity={layerOpacity} product={product} />
      </group>
    );
  }

  return (
    <group
      position={[layerIndex * 0.16, -layerIndex * 0.12, -layerIndex * 0.16]}
      rotation={[0, 0, layerIndex === 0 ? 0 : 0.025]}
    >
      <mesh position={[0, 0, -0.06]}>
        <boxGeometry args={[width + 0.14, height + 0.14, 0.1]} />
        <meshStandardMaterial
          color={product.colors.background}
          depthWrite={layerOpacity > 0.9}
          metalness={0.18}
          opacity={layerOpacity}
          roughness={0.35}
          transparent
        />
      </mesh>
      <mesh>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial
          depthWrite={false}
          map={loaded.texture}
          opacity={layerOpacity}
          toneMapped={false}
          transparent
        />
      </mesh>
    </group>
  );
}

function LifeOSCore({
  product,
  opacity,
  tier,
}: {
  product: ExperienceProduct;
  opacity: number;
  tier: QualityTier;
}) {
  const segments = tier === "low" ? 2 : tier === "medium" ? 3 : 5;

  return (
    <group scale={0.88}>
      <mesh rotation={[0.55, 0.75, 0]}>
        <icosahedronGeometry args={[1.05, segments]} />
        <meshPhysicalMaterial
          clearcoat={0.8}
          color={product.colors.primary}
          depthWrite={opacity > 0.8}
          emissive={product.colors.secondary}
          emissiveIntensity={0.14}
          ior={1.35}
          metalness={tier === "low" ? 0.6 : 0.12}
          opacity={opacity * 0.88}
          roughness={tier === "low" ? 0.3 : 0.12}
          thickness={tier === "low" ? 0 : 0.75}
          transmission={tier === "low" ? 0 : 0.58}
          transparent
        />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0.18, 0]}>
        <torusGeometry args={[1.42, 0.025, 8, tier === "low" ? 48 : 96]} />
        <meshBasicMaterial
          color={product.colors.accent}
          depthWrite={false}
          opacity={opacity * 0.74}
          toneMapped={false}
          transparent
        />
      </mesh>
      <mesh rotation={[0.25, Math.PI / 2, 0]}>
        <torusGeometry args={[1.66, 0.018, 8, tier === "low" ? 48 : 96]} />
        <meshBasicMaterial
          color="#ffffff"
          depthWrite={false}
          opacity={opacity * 0.45}
          transparent
        />
      </mesh>
      <mesh>
        <boxGeometry args={[3.45, 2.65, 0.08]} />
        <meshBasicMaterial
          color={product.colors.accent}
          depthWrite={false}
          opacity={opacity * 0.28}
          transparent
          wireframe
        />
      </mesh>
    </group>
  );
}

function WireMaterial({ color, opacity }: { color: string; opacity: number }) {
  return (
    <meshBasicMaterial
      color={color}
      depthWrite={false}
      opacity={opacity}
      toneMapped={false}
      transparent
      wireframe
    />
  );
}

function ResearchWireframe({
  product,
  variant,
  opacity,
  tier,
}: {
  product: ExperienceProduct;
  variant: number;
  opacity: number;
  tier: QualityTier;
}) {
  const radialSegments = tier === "low" ? 24 : 56;

  return (
    <group scale={0.92}>
      {variant === 0 && (
        <>
          <mesh>
            <sphereGeometry args={[0.82, radialSegments, tier === "low" ? 12 : 28]} />
            <WireMaterial color={product.colors.primary} opacity={opacity * 0.7} />
          </mesh>
          {[0, 1, 2].map((index) => (
            <mesh key={index} rotation={[index * 0.72, index * 0.48, 0]}>
              <torusGeometry args={[1.18 + index * 0.18, 0.025, 6, radialSegments]} />
              <WireMaterial color={product.colors.accent} opacity={opacity * 0.62} />
            </mesh>
          ))}
        </>
      )}
      {variant === 1 && (
        <>
          <mesh rotation={[0.5, 0.2, 0]}>
            <torusKnotGeometry args={[0.84, 0.22, radialSegments * 2, 8, 2, 3]} />
            <WireMaterial color={product.colors.primary} opacity={opacity * 0.72} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[1.38, 1.43, radialSegments]} />
            <WireMaterial color={product.colors.accent} opacity={opacity * 0.52} />
          </mesh>
        </>
      )}
      {variant === 2 && (
        <>
          {[-1, 0, 1].map((index) => (
            <mesh
              key={index}
              position={[index * 0.82, Math.abs(index) * -0.28, index * -0.12]}
              rotation={[index * 0.28, index * 0.45, 0]}
            >
              <octahedronGeometry args={[index === 0 ? 0.92 : 0.58, tier === "low" ? 0 : 1]} />
              <WireMaterial
                color={index === 0 ? product.colors.primary : product.colors.accent}
                opacity={opacity * (index === 0 ? 0.75 : 0.5)}
              />
            </mesh>
          ))}
        </>
      )}
      {variant === 3 && (
        <>
          {[-1.25, -0.62, 0, 0.62, 1.25].map((x, index) => (
            <mesh key={x} position={[x, 0, 0]} rotation={[0, index * 0.18, 0]}>
              <torusGeometry args={[0.6 + Math.abs(index - 2) * 0.08, 0.045, 6, radialSegments]} />
              <WireMaterial
                color={index % 2 === 0 ? product.colors.primary : product.colors.accent}
                opacity={opacity * (0.42 + (2 - Math.abs(index - 2)) * 0.1)}
              />
            </mesh>
          ))}
        </>
      )}
      {variant === 4 && (
        <>
          <mesh rotation={[0.25, 0.55, 0]}>
            <dodecahedronGeometry args={[1.05, tier === "low" ? 0 : 1]} />
            <WireMaterial color={product.colors.primary} opacity={opacity * 0.72} />
          </mesh>
          {([
            [-1.45, 0.72, 0],
            [1.4, 0.62, -0.1],
            [-1.18, -0.92, 0.1],
            [1.32, -0.82, 0],
          ] as const).map((position, index) => (
            <mesh key={index} position={position}>
              <icosahedronGeometry args={[0.18, 1]} />
              <meshBasicMaterial
                color={product.colors.accent}
                depthWrite={false}
                opacity={opacity * 0.74}
                toneMapped={false}
                transparent
              />
            </mesh>
          ))}
        </>
      )}

      <mesh rotation={[0.08, -0.12, 0]}>
        <boxGeometry args={[3.65, 2.55, 0.16]} />
        <WireMaterial color={product.colors.secondary} opacity={opacity * 0.24} />
      </mesh>
    </group>
  );
}

function ProductCard({
  product,
  productIndex,
  opacity,
  tier,
  loadRichMedia,
  onAssetSettled,
}: {
  product: ExperienceProduct;
  productIndex: number;
  opacity: number;
  tier: QualityTier;
  loadRichMedia: boolean;
  onAssetSettled: (path: string) => void;
}) {
  if (product.screenshots.length > 0) {
    if (!loadRichMedia) {
      return <BrandedFallback opacity={opacity} product={product} />;
    }

    return (
      <group>
        {product.screenshots.map((screenshot, layerIndex) => (
          <ScreenshotLayer
            key={`${screenshot.path}:${screenshot.sourceBuild}`}
            layerIndex={layerIndex}
            opacity={opacity}
            product={product}
            screenshot={screenshot}
            tier={tier}
            onAssetSettled={onAssetSettled}
          />
        ))}
      </group>
    );
  }

  if (product.slug === "lifeos") {
    return <LifeOSCore opacity={opacity} product={product} tier={tier} />;
  }

  if (product.lifecycle === "research") {
    return (
      <group>
        <BrandedFallback opacity={opacity * 0.9} product={product} />
        <group position={[0.94, 0.1, -0.22]} rotation={[0.03, -0.12, 0]} scale={0.72}>
          <ResearchWireframe
            opacity={opacity * 0.44}
            product={product}
            tier={tier}
            variant={(productIndex - 3 + 5) % 5}
          />
        </group>
      </group>
    );
  }

  return <BrandedFallback opacity={opacity} product={product} />;
}

function lerp(a: number, b: number, amount: number): number {
  return a + (b - a) * amount;
}

function lerpVec3(a: Vec3, b: Vec3, amount: number): Vec3 {
  return [
    lerp(a[0], b[0], amount),
    lerp(a[1], b[1], amount),
    lerp(a[2], b[2], amount),
  ];
}

function productPose(index: number, frame: TimelineFrame, mode: ExperienceMode) {
  const difference = index - frame.productFloat;
  const distance = Math.abs(difference);
  const focus = 1 - smoothstep(clamp01(distance));
  const orbitAngle = difference * 0.6;
  const focusPlane = -1.25 - frame.productFloat * 1.36;
  const arcPosition: Vec3 = [
    Math.sin(orbitAngle) * 3.25,
    Math.sin(orbitAngle * 0.72) * 0.32,
    focusPlane - (1 - Math.cos(orbitAngle)) * 1.45 - Math.min(distance, 3) * 0.04,
  ];
  const arcRotation: Vec3 = [
    Math.sin(orbitAngle * 0.5) * 0.025,
    -orbitAngle * 0.72,
    -Math.sin(orbitAngle) * 0.018,
  ];
  const proof = proofLayoutPose(index, mode);
  const morph = frame.world.proofMorph;

  return {
    position: lerpVec3(arcPosition, proof.position, morph),
    rotation: lerpVec3(arcRotation, proof.rotation, morph),
    scale: lerp(0.68 + focus * 0.32, proof.scale, morph),
  };
}

export function PortfolioField({
  products,
  frame,
  mode,
  tier,
  onAssetsSettled,
}: PortfolioFieldProps) {
  const enter = smoothstep(segmentProgress(frame.progress, 0.065, 0.105));
  const leave = 1 - smoothstep(segmentProgress(frame.progress, 0.585, 0.675));
  // The final WORKS card yields to the proof ledger before the cards complete
  // their physical morph. Keeping the geometry faint preserves depth without
  // making the evidence typography compete with eight equally bright objects.
  const proofBackdropMix = smoothstep(segmentProgress(frame.progress, 0.49, 0.525));
  const proofBackdropOpacity = lerp(1, 0.24, proofBackdropMix);
  const fieldOpacity = enter * leave * proofBackdropOpacity;
  const [richMediaProducts, setRichMediaProducts] = useState<ReadonlySet<number>>(
    () => new Set(),
  );
  const eligibleMediaProducts = useMemo(
    () => products.slice(0, 8).flatMap((product, index) =>
      product.screenshots.length > 0 && shouldLoadPortfolioMedia(
        fieldOpacity,
        Math.abs(index - frame.productFloat),
        frame.world.proofMorph,
      )
        ? [index]
        : [],
    ),
    [fieldOpacity, frame.productFloat, frame.world.proofMorph, products],
  );
  const requestedMediaProducts = useMemo(
    () => new Set([...richMediaProducts, ...eligibleMediaProducts]),
    [eligibleMediaProducts, richMediaProducts],
  );

  useEffect(() => {
    if (eligibleMediaProducts.length === 0) return;

    setRichMediaProducts((current) => {
      if (eligibleMediaProducts.every((index) => current.has(index))) return current;
      return new Set([...current, ...eligibleMediaProducts]);
    });
  }, [eligibleMediaProducts]);

  const assetPaths = useMemo(
    () => [
      ...new Set(
        products.slice(0, 8).flatMap((product, index) =>
          requestedMediaProducts.has(index)
            ? product.screenshots.map((shot) => shot.path)
            : [],
        ),
      ),
    ],
    [products, requestedMediaProducts],
  );
  const assetKey = assetPaths.join("\u0000");
  const settledAssets = useRef(new Set<string>());
  const notified = useRef(false);
  const onAssetsSettledRef = useRef(onAssetsSettled);

  useEffect(() => {
    onAssetsSettledRef.current = onAssetsSettled;
  }, [onAssetsSettled]);

  useEffect(() => {
    settledAssets.current.clear();
    notified.current = false;
    if (assetPaths.length === 0) {
      notified.current = true;
      onAssetsSettledRef.current?.();
    }
  }, [assetKey, assetPaths.length]);

  const handleAssetSettled = useCallback((path: string) => {
    if (!assetPaths.includes(path)) return;
    settledAssets.current.add(path);
    if (!notified.current && settledAssets.current.size >= assetPaths.length) {
      notified.current = true;
      onAssetsSettledRef.current?.();
    }
  }, [assetPaths]);

  return (
    <group visible={fieldOpacity > 0.001}>
      {products.slice(0, 8).map((product, index) => {
        const pose = productPose(index, frame, mode);
        const portfolioDistance = Math.abs(index - frame.productFloat);
        const portfolioFocus = 1 - smoothstep(clamp01(portfolioDistance));
        const portfolioOpacity = lerp(0.045, 1, Math.pow(portfolioFocus, 0.78));
        const proofDistance = Math.abs(index - frame.proofFloat);
        const proofFocus = 1 - smoothstep(clamp01(proofDistance));
        const proofOpacity = 0.22 + proofFocus * 0.78;
        const cardOpacity = lerp(portfolioOpacity, proofOpacity, frame.world.proofMorph);
        const loadRichMedia = requestedMediaProducts.has(index);
        return (
          <group
            key={product.slug}
            position={pose.position}
            rotation={pose.rotation}
            scale={pose.scale}
            userData={{ productSlug: product.slug, registryScreenshotOnly: true }}
          >
            <ProductCard
              opacity={fieldOpacity * cardOpacity}
              product={product}
              productIndex={index}
              tier={tier}
              loadRichMedia={loadRichMedia}
              onAssetSettled={handleAssetSettled}
            />
          </group>
        );
      })}
    </group>
  );
}
