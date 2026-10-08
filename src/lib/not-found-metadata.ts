import type { Metadata } from "next";
import type { Locale } from "@/lib/types";

const ORIGIN = "https://yulalab.com";

const copy = {
  tr: {
    title: "Sayfa bulunamadı.",
    description: "Aradığınız sayfa bulunamadı.",
    ogLocale: "tr_TR",
    canonical: `${ORIGIN}/`,
  },
  en: {
    title: "Page not found.",
    description: "The page you requested could not be found.",
    ogLocale: "en_US",
    canonical: `${ORIGIN}/en`,
  },
} as const satisfies Record<Locale, object>;

export function notFoundMetadata(locale: Locale): Metadata {
  const localized = copy[locale];
  return {
    metadataBase: new URL(ORIGIN),
    title: localized.title,
    description: localized.description,
    robots: {
      index: false,
      follow: false,
    },
    alternates: {
      canonical: localized.canonical,
    },
    openGraph: {
      type: "website",
      locale: localized.ogLocale,
      url: localized.canonical,
      siteName: "YULA Lab",
      title: localized.title,
      description: localized.description,
      images: [
        {
          url: `${ORIGIN}/opengraph-image`,
          width: 1200,
          height: 630,
          alt: "YULA Lab — product lab",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: localized.title,
      description: localized.description,
      images: [`${ORIGIN}/opengraph-image`],
    },
  };
}
