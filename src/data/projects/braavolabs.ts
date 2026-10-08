import type { ProjectConfig } from "@/lib/types";

export const braavolabs: ProjectConfig = {
  slug: "braavolabs",
  name: "Braavolabs",
  monogram: "B",
  kind: ["platform", "web", "mobile"],
  status: "beta",
  category: {
    tr: "Otonom AI Şirket İşletim Sistemi",
    en: "Autonomous AI Company OS",
  },
  tagline: {
    tr: "AI ekibini tek merkezden yönet.",
    en: "Manage your AI team in one place.",
  },
  description: {
    tr: "Braavolabs, küçük ekiplerin AI ajanlarını ve otomasyonlarını tek panelden kurup yönetmesini sağlayan bir işletim sistemi.",
    en: "Braavolabs is an operating system for small teams to build and manage AI agents and automations from a single panel.",
  },
  short: {
    tr: "Küçük ekipler için otonom AI şirket OS'i. Primitifler, ajan ağları ve şeffaf maliyet — tek panel.",
    en: "An autonomous AI company OS for small teams. Primitives, agent networks and transparent cost — one panel.",
  },
  brand: {
    primary: "#00D1FF",
    secondary: "#4060FF",
    accent: "#6D11AD",
    background: "#050810",
    foreground: "#E1E2EB",
    gradient: "linear-gradient(135deg, #00D1FF 0%, #4060FF 50%, #6D11AD 100%)",
    glow: "0 0 80px -10px rgba(64,96,255,0.55)",
    fontDisplay: '"Space Grotesk", Inter, sans-serif',
    fontBody: "Inter, sans-serif",
    fontMono: '"JetBrains Mono", ui-monospace, monospace',
    mood: "linear-superhuman-vercel",
  },
  visuals: {
    logo: "/projects/braavolabs/logo.png",
    icon: "/projects/braavolabs/icon.png",
    ogImage: "/projects/braavolabs/og.png",
    // Real captures from the live product (braavolabs.com), not mockups —
    // harvested 2026-07-11 via headless browser, cropped to the UI itself.
    screenshots: [
      {
        src: "/projects/braavolabs/screenshot-audit-trail.png",
        alt: "Braavolabs canlı denetim izi: her ajan adımının araç çağrısı ve maliyeti gerçek zamanlı akıyor.",
        kind: "product",
      },
      {
        src: "/projects/braavolabs/screenshot-builder.png",
        alt: "Braavolabs AI Şirket Kurucusu: tek bir komutla çok-ajanlı bir ekip kuruluyor.",
        kind: "product",
      },
    ],
  },
  features: [
    {
      title: { tr: "Primitive katmanı", en: "Primitive layer" },
      description: {
        tr: "Bellek, plan, eylem, gözlem — 9 yeniden kullanılabilir primitif üzerine inşa edilir.",
        en: "Memory, plan, action, observation — built on 9 reusable primitives.",
      },
      icon: "LayoutGrid",
    },
    {
      title: { tr: "Çoklu sağlayıcı", en: "Multi-provider" },
      description: {
        tr: "OpenAI, Anthropic, Mistral, Gemini ve 10 daha — tek arayüzden, tek faturalama mantığıyla.",
        en: "OpenAI, Anthropic, Mistral, Gemini and 10 more — one interface, one billing logic.",
      },
      icon: "KeyRound",
    },
    {
      title: { tr: "Şeffaf maliyet", en: "Transparent cost" },
      description: {
        tr: "Her ajan, her token, her saniye — kim ne harcadı, hangi karara mal oldu, açık panelde.",
        en: "Every agent, every token, every second — who spent what for which decision, in plain view.",
      },
      icon: "FileSearch",
    },
    {
      title: { tr: "Görev grafiği", en: "Task graph" },
      description: {
        tr: "Ajanlar arası bağımlılığı görsel grafikle çiz; insan onayı gereken düğümleri işaretle.",
        en: "Draw inter-agent dependencies as a visual graph; mark nodes that need human approval.",
      },
      icon: "Network",
    },
    {
      title: { tr: "Politika motoru", en: "Policy engine" },
      description: {
        tr: "Roller, izinler, kotalar. Bir ajan asla limitin ötesine geçmez — tasarımdan gelir.",
        en: "Roles, permissions, quotas. Agents can't drift past their limits — by design.",
      },
      icon: "ShieldCheck",
    },
    {
      title: { tr: "6 dil, 1 ekip", en: "6 languages, 1 team" },
      description: {
        tr: "Türkçe, İngilizce, Almanca, Fransızca, İspanyolca, Arapça — aynı bağlam, aynı bellek.",
        en: "Turkish, English, German, French, Spanish, Arabic — same context, same memory.",
      },
      icon: "Globe",
    },
  ],
  stats: [
    {
      value: "9",
      label: { tr: "Primitif", en: "Primitives" },
      claimId: "braavolabs-primitive-count",
    },
    {
      value: "14",
      label: { tr: "LLM Sağlayıcı", en: "LLM Providers" },
      claimId: "braavolabs-provider-count",
    },
    { value: "6", label: { tr: "Dil", en: "Languages" } },
  ],
  vision: {
    tr: "Her küçük ekibin, kendi otonom dijital iş gücünü onlarca dakika içinde kurabildiği bir dünya.",
    en: "A world where every small team can stand up their own autonomous digital workforce in minutes.",
  },
  mission: {
    tr: "Ajan tabanlı sistemleri spor salonu jargonundan çıkarıp, gerçekten kullanışlı, ölçülebilir, denetlenebilir bir mühendislik disiplinine çevirmek.",
    en: "Move agent-based systems out of marketing jargon and into a useful, measurable, auditable engineering discipline.",
  },
  order: 1,
  links: [
    { kind: "web", href: "https://braavolabs.com" },
    { kind: "appstore", href: "https://apps.apple.com/us/app/braavolabs/id6771440905" },
    { kind: "x", href: "https://x.com/braavolabs" },
    { kind: "linkedin", href: "https://www.linkedin.com/company/braavolabs" },
  ],
  contactEmail: "hello@braavolabs.com",
};
