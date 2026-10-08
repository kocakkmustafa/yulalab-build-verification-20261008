import type { ProjectConfig } from "@/lib/types";

export const burunfarki: ProjectConfig = {
  slug: "burunfarki",
  name: "Burun Farkı",
  monogram: "BF",
  kind: ["web", "mobile"],
  status: "live",
  category: {
    tr: "Şeffaf AI At Yarışı Analiz Platformu",
    en: "Transparent AI Horse Racing Analytics",
  },
  tagline: {
    tr: "Duyguyla değil, veriyle.",
    en: "Numbers over hunches.",
  },
  description: {
    tr: "Burun Farkı, Türkiye at yarışları için veri odaklı analiz ürünü. Canlı takip performansını burunfark.com/dogruluk kaynağıyla açıklar; modelin neden tahmin ettiğini gizlemez.",
    en: "Burun Farkı is a data-driven analytics product for Turkish horse racing. It documents live-tracking performance at burunfark.com/dogruluk and never hides why the model made a prediction.",
  },
  short: {
    tr: "Türkiye at yarışları için veri odaklı analiz ürünü. Geliştirme şu anda beklemede. Tarihli performans kayıtları ve ölçüm sınırları ürün sayfasındadır; güncel yayın durumu ayrıca doğrulanmalıdır.",
    en: "A data-driven analytics product for Turkish horse racing. Development is currently on hold. Dated performance records and measurement limits are on the product page; current publication status requires separate verification.",
  },
  brand: {
    primary: "#FAB81F",
    secondary: "#FCD25F",
    accent: "#D4AF37",
    background: "#080C16",
    foreground: "#EDE9E0",
    gradient: "linear-gradient(135deg, #FAB81F 0%, #FCD25F 50%, #8F6D24 100%)",
    glow: "0 0 60px -10px rgba(250,184,31,0.35)",
    fontDisplay: "Inter, sans-serif",
    fontBody: "Inter, sans-serif",
    fontMono: '"JetBrains Mono", ui-monospace, monospace',
    mood: "bloomberg-x-club",
  },
  visuals: {
    logo: "/projects/burunfarki/logo.png",
    icon: "/projects/burunfarki/icon.png",
    ogImage: "/projects/burunfarki/og.png",
    banner: "/projects/burunfarki/hero.jpg",
    screenshots: [
      // Atmosphere, not proof — a stock racing photo, not an app screen.
      // Never eligible for ProductShot until replaced with a real
      // decision-rationale dashboard capture (see FABLE_PLAN §8.4.4).
      {
        src: "/projects/burunfarki/hero.jpg",
        alt: "Türkiye'de bir yarış parkurunda dörtnala koşan atlar.",
        kind: "atmosphere",
      },
      // Real captures of the live /dogruluk page (harvested 2026-07-11 via
      // a headless-browser screenshot service, bypassing the need for
      // burunfark-web's CSP change — its Vercel production deploy wasn't
      // picking up that change, so the iframe path (ProjectAsset kind:
      // "live", still supported by ProductShot/types.ts) is on hold until
      // that's sorted. This is the decision-rationale evidence FABLE_PLAN
      // §8.4.4 asked for instead of the stock photo above.
      {
        src: "/projects/burunfarki/screenshot-honest-stats.png",
        alt: "Burun Farkı'nın dürüst performans çerçevesi: Top-1/Top-3 isabet oranları, son 7/30/90 gün.",
        kind: "product",
      },
      {
        src: "/projects/burunfarki/screenshot-daily-history.png",
        alt: "Burun Farkı günlük AI tahmin geçmişi: her günün Top-1/Top-3 isabet detayı.",
        kind: "product",
      },
    ],
  },
  features: [
    {
      title: { tr: "Açık özellik seti", en: "Open feature set" },
      description: {
        tr: "Modelin gördüğü tüm özellikleri — pist, mesafe, jokey, antrenör — açıkça listeleriz.",
        en: "Every feature the model sees — track, distance, jockey, trainer — listed in plain view.",
      },
      icon: "Eye",
    },
    {
      title: { tr: "Karar gerekçesi", en: "Decision rationale" },
      description: {
        tr: "Her tahminin yanında, en etkili 3 faktör sıralı gösterilir — gizli kara kutu yok.",
        en: "Each prediction shows its top 3 factors in ranked order — no hidden black box.",
      },
      icon: "BadgeCheck",
    },
    {
      title: { tr: "Tarihsel arşiv", en: "Historical archive" },
      description: {
        tr: "69 günlük canlı takipteki 1.225 yarış — modelin geçmişte nerede yanıldığını da görürsün.",
        en: "The 1,225 races in the current 69-day live-tracking window — including where the model has been wrong.",
      },
      icon: "Database",
    },
    {
      title: { tr: "Canlı takip paneli", en: "Live tracking panel" },
      description: {
        tr: "Yayımlanan 69 günlük canlı takip penceresindeki gerçek sonuçlarla modelin getirisini gün gün izle.",
        en: "Track the model's day-by-day performance against the published 69-day live-results window.",
      },
      icon: "TrendingUp",
    },
    {
      title: { tr: "Disiplin önerileri", en: "Discipline tools" },
      description: {
        tr: "Bahis değil — bütçe yönetimi, varyans, durma kuralları üzerine eğitsel araçlar.",
        en: "Not betting — educational tools for budget management, variance and stop-rules.",
      },
      icon: "ShieldAlert",
    },
    {
      title: { tr: "Açıklama önerileri", en: "Explainability" },
      description: {
        tr: "Hangi koşucu için neden — kural-tabanlı katkı sıralaması yarış-spesifik dilde anlatılır.",
        en: "Why this runner, why now — a rule-based contribution ranking translated into race-specific language.",
      },
      icon: "Microscope",
    },
  ],
  // Honest live (post-deployment) walk-forward accuracy, not training-time
  // backtest. Source: burunfark.com/dogruluk, verified 2026-08-25
  // (69 days / 1,225 races in the current live DOM). Training-time backtest separately
  // measured ~69% Top-3 — see the `short` field above for that distinction.
  // TODO(Y-P0-003): move source/verifiedAt/expiresAt into the public
  // registry schema once it exists; this comment is a stopgap until then.
  stats: [
    {
      value: "~%29",
      label: { tr: "Top-1 (canlı takip)", en: "Top-1 (live tracking)" },
      claimId: "burunfarki-topk-accuracy",
    },
    {
      value: "~%62",
      label: { tr: "Top-3 (canlı takip)", en: "Top-3 (live tracking)" },
      claimId: "burunfarki-topk-accuracy",
    },
    {
      value: "1.225",
      label: { tr: "canlı takip yarışı", en: "live-tracked races" },
      claimId: "burunfarki-topk-accuracy",
    },
  ],
  vision: {
    tr: "At yarışını duygusal bir kumardan, denetlenebilir bir kantitatif disipline çeviren açık bir araç ekosistemi.",
    en: "An open ecosystem that turns horse racing from emotional gambling into an auditable quantitative discipline.",
  },
  mission: {
    tr: "Spor verisini hak ettiği şeffaflıkta sunmak; insanın sezgisinden vazgeçmeden, veriyi yanına bir analist olarak koymak.",
    en: "Present sports data with the transparency it deserves — without abandoning intuition, just placing data alongside it as an analyst.",
  },
  order: 2,
  links: [
    { kind: "web", href: "https://burunfark.com" },
    { kind: "x", href: "https://x.com/burunfarki" },
    { kind: "instagram", href: "https://instagram.com/burunfarki" },
    { kind: "youtube", href: "https://youtube.com/@burunfarki" },
  ],
  contactEmail: "support@yulalab.com",
};
