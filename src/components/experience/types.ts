export type ExperienceMode = "desktop" | "mobile";
export type QualityTier = "high" | "medium" | "low";
export type ExperienceStage =
  | "hero"
  | "portfolio"
  | "proof"
  | "crossing"
  | "mission"
  | "vision"
  | "values"
  | "closing";

export type Vec3 = readonly [number, number, number];

export type CameraPose = {
  position: Vec3;
  target: Vec3;
  fov: number;
};

export type CameraKey = CameraPose & {
  progress: number;
};

export type TimelineFrame = {
  progress: number;
  stage: ExperienceStage;
  stageProgress: number;
  productFloat: number;
  productIndex: number;
  productProgress: number;
  proofFloat: number;
  proofIndex: number;
  proofProgress: number;
  valueFloat: number;
  valueIndex: number;
  valueProgress: number;
  camera: CameraPose;
  glyph: {
    position: Vec3;
    rotation: Vec3;
    scale: number;
    glassMix: number;
    outlineMix: number;
  };
  world: {
    whiteMix: number;
    themeMix: number;
    bladeProgress: number;
    roomOpacity: number;
    wordmarkOpacity: number;
    proofMorph: number;
    closingDraw: number;
    worksBackdropMix: number;
    visionPortal: number;
    servicePortalOpacity: number;
    serviceIn: number;
    serviceOut: number;
    closingContent: number;
  };
  overlay: Record<ExperienceStage, number>;
};

export type ExperienceScreenshot = {
  path: string;
  alt: string;
  sourceBuild: string;
  capturedAt: string;
};

export type ExperienceClaim = {
  id: string;
  figure: string | null;
  statement: string;
  evidenceKind: string;
  source: string;
  scope: string;
  verifiedAt: string;
  expiresAt: string;
};

export type ExperienceProduct = {
  slug: string;
  name: string;
  monogram: string;
  lifecycle: "live" | "beta" | "research" | "archived";
  category: string;
  tagline: string;
  short: string;
  href: string;
  ctaLabel: string;
  lifecycleLabel: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
  };
  screenshots: ExperienceScreenshot[];
  claims: ExperienceClaim[];
  updatedAt: string;
};

export type ExperienceValue = {
  title: string;
  description: string;
};

export type ExperienceCopy = {
  locale: "tr" | "en";
  navigation: {
    home: string;
    consulting: string;
    projects: string;
    manifesto: string;
    transparency: string;
    contact: string;
    soundOn: string;
    soundOff: string;
  };
  loader: readonly [string, string, string, string];
  hero: {
    eyebrow: string;
    title: string;
    lede: string;
    notice: string;
    scroll: string;
  };
  portfolio: {
    kicker: string;
    liveAction: string;
    researchAction: string;
    noPublicBuild: string;
    productCounter: string;
  };
  proof: {
    kicker: string;
    title: string;
    source: string;
    scope: string;
    verified: string;
    stale: string;
    freshnessPending: string;
    refreshDue: string;
  };
  mission: { kicker: string; title: string; body: string };
  vision: { kicker: string; title: string; body: string };
  values: {
    kicker: string;
    title: string;
    items: ExperienceValue[];
  };
  closing: {
    kicker: string;
    title: string;
    body: string;
    email: string;
    privacy: string;
    terms: string;
    support: string;
    rights: string;
  };
  fallback: {
    label: string;
    reason: string;
  };
};
