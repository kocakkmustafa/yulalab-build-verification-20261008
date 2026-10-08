import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Inter, Manrope, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "../globals.css";
import { Analytics } from "@vercel/analytics/react";
import { MotionConfig } from "framer-motion";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { PageTransition } from "@/components/layout/PageTransition";
import { JsonLd } from "@/components/common/JsonLd";
import { routing } from "@/i18n/routing";
import { company } from "@/data/company";
import { studioEnabled } from "@/server/studio-surface";

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-sans",
  display: "swap",
});

const manrope = Manrope({
  subsets: ["latin", "latin-ext"],
  variable: "--font-display",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin", "latin-ext"],
  variable: "--font-grotesk",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#09060e",
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

function siteOrigin(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "https://yulalab.com";
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "site" });
  return {
    metadataBase: new URL(siteOrigin()),
    title: {
      default: t("title"),
      template: "%s · YULA Lab",
    },
    description: t("description"),
    applicationName: company.name,
    authors: [{ name: company.founder.name }],
    openGraph: {
      type: "website",
      locale: locale === "tr" ? "tr_TR" : "en_US",
      siteName: company.name,
      title: t("title"),
      description: t("description"),
      images: [{ url: "/opengraph-image", width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: t("title"),
      description: t("description"),
      images: ["/opengraph-image"],
    },
    alternates: {
      canonical: locale === "tr" ? "/" : `/${locale}`,
      languages: {
        tr: "/",
        en: "/en",
      },
    },
    icons: {
      icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
      apple: [{ url: "/apple-icon.svg", type: "image/svg+xml" }],
    },
    manifest: "/manifest.webmanifest",
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);
  const studioOpen = studioEnabled();

  return (
    <html
      lang={locale}
      className={`${inter.variable} ${manrope.variable} ${spaceGrotesk.variable} ${jetbrains.variable}`}
    >
      <body className="bg-ink-900 text-ink-50 antialiased">
        <JsonLd />
        <NextIntlClientProvider>
          {/* reducedMotion="user" makes every Framer Motion animation on the
              site (LandingHero, ProductShot, FeatureCard, ProjectCard, page
              transitions) respect prefers-reduced-motion automatically —
              transform/scale animations resolve instantly, opacity still
              cross-fades. The CSS-only .reveal/.word system has its own
              @media (prefers-reduced-motion) rule in globals.css; this is
              the Framer Motion half of the same promise. */}
          <MotionConfig reducedMotion="user">
            <Header studioEnabled={studioOpen} />
            <main>
              <PageTransition>{children}</PageTransition>
            </main>
            <Footer studioEnabled={studioOpen} />
          </MotionConfig>
        </NextIntlClientProvider>
        {process.env.VERCEL === "1" ? <Analytics /> : null}
      </body>
    </html>
  );
}
