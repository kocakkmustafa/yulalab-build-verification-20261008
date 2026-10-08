import type { LocalizedString } from "@/lib/types";

export type Note = {
  slug: string;
  /** ISO date (YYYY-MM-DD). */
  date: string;
  title: LocalizedString;
  body: LocalizedString;
};

/**
 * Flat, hand-written changelog — no CMS, no MDX. One entry per real,
 * user-visible change. Newest first.
 */
export const notes: Note[] = [
  {
    slug: "site-motion",
    date: "2026-07-10",
    title: {
      tr: "Vitrine biraz can kattık",
      en: "Gave the showcase some life",
    },
    body: {
      tr: "Sayfa geçişleri artık bir sahne değişimi gibi hissediyor, kartlar hover'da markanın kendi rengiyle canlanıyor. Erişilebilirlik ayarı (reduce motion) açık olanlarda hareketler anında sonuçlanıyor.",
      en: "Page transitions now read as a scene change instead of a hard cut, and cards light up in the product's own color on hover. With reduce-motion enabled, everything resolves instantly instead.",
    },
  },
  {
    slug: "terms-of-service",
    date: "2026-07-10",
    title: {
      tr: "Kullanım Şartları sayfası eklendi",
      en: "Added a Terms of Service page",
    },
    body: {
      tr: "Ürünlerimiz için ortak bir kullanım şartları / EULA sayfası yayında — footer'dan erişilebilir.",
      en: "A shared terms of service / EULA page for our products is live — reachable from the footer.",
    },
  },
  {
    slug: "lifeos-live",
    date: "2026-07-10",
    title: {
      tr: "LifeOS artık App Store'da",
      en: "LifeOS is live on the App Store",
    },
    body: {
      tr: "LifeOS'u aylardır 'yakında' göstermek dürüstlük sözümüze aykırıydı. Artık gerçekten indirilebilir — düzelttik.",
      en: "Showing LifeOS as 'coming soon' for months didn't match our honesty promise. It's actually downloadable now — fixed.",
    },
  },
];
