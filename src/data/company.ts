import type { CompanyConfig } from "@/lib/types";

export const company: CompanyConfig = {
  name: "YULA Lab",
  legalName: "YULA Lab",
  tagline: {
    tr: "Geleceğin ürünlerini bugün tasarlıyoruz.",
    en: "We design tomorrow's products today.",
  },
  shortDescription: {
    tr: "YULA Lab, yapay zeka ve veri odaklı, insanın hayatını sadeleştiren ürünler tasarlayan bağımsız bir ürün laboratuvarıdır. Her projemiz; estetik, etik ve etki üçgeninde inşa edilir.",
    en: "YULA Lab is an independent product lab designing AI-native, data-driven products that simplify everyday life — each crafted at the intersection of aesthetics, ethics, and impact.",
  },
  vision: {
    tr: "İnsanların hayatını anlamlı şekilde iyileştiren, yapay zekanın en iyi yanlarını gündelik hayata taşıyan bir ürün ailesi kurmak.",
    en: "Build a family of products that meaningfully improves human life by bringing the best of AI into everyday hands.",
  },
  mission: {
    tr: "Her ürünümüzde şeffaf metodoloji, sade tasarım ve gerçek bir kullanıcı yararını birleştiren bir mühendislik kültürü inşa etmek; yapay zekayı abartmadan, doğru yerde, doğru zamanda kullanmak.",
    en: "Build an engineering culture that combines transparent methodology, minimal design and real user value in every product — using AI exactly where it helps, never just because it can.",
  },
  values: [
    {
      title: { tr: "Şeffaflık", en: "Transparency" },
      description: {
        tr: "Kara kutu yok. Modellerimizin nasıl karar verdiğini, hangi veriden öğrendiğini açıkça paylaşırız.",
        en: "No black boxes. We show how our models decide and what data they learn from.",
      },
    },
    {
      title: { tr: "Sadelik", en: "Craft" },
      description: {
        tr: "Az ama özenli. Her ekran, her etkileşim üzerinde uğraşıldığını hisseder.",
        en: "Less, but with care. Every screen and interaction feels deliberately crafted.",
      },
    },
    {
      title: { tr: "Gizlilik", en: "Privacy" },
      description: {
        tr: "Veri sahibi kullanıcıdır. Tasarımlarımız bunu varsayımdan değil, mimariden başlatır.",
        en: "The user owns their data. Our designs start from architecture, not afterthought.",
      },
    },
    {
      title: { tr: "Bilim", en: "Science" },
      description: {
        tr: "Trende değil, kanıta yaslanırız. Doğrulanmış yöntemler, ölçülebilir sonuçlar.",
        en: "We lean on evidence, not trends. Validated methods, measurable outcomes.",
      },
    },
  ],
  founder: {
    name: "Mustafa Kaan Koçak",
    role: { tr: "Kurucu & Laboratuvar Lideri", en: "Founder & Lab Lead" },
    email: "kocakmkaan@gmail.com",
  },
  contact: {
    email: "support@yulalab.com",
  },
  socials: {
    // linkedin: temporarily removed — the /company/yulalab page 404s
    // (verified 2026-07-23, DEFTER Y-004). Restore once it's live.
    x: "https://x.com/yulalab",
    instagram: "https://instagram.com/yulalab",
  },
  brand: {
    banner: "/brand/yulalab-banner.png",
  },
};
