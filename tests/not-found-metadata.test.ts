import { describe, expect, it } from "vitest";
import { notFoundMetadata } from "@/lib/not-found-metadata";

describe("locale-aware not-found metadata", () => {
  const cases = [
    {
      locale: "tr" as const,
      title: "Sayfa bulunamadı.",
      description: "Aradığınız sayfa bulunamadı.",
      canonical: "https://yulalab.com/",
      ogLocale: "tr_TR",
    },
    {
      locale: "en" as const,
      title: "Page not found.",
      description: "The page you requested could not be found.",
      canonical: "https://yulalab.com/en",
      ogLocale: "en_US",
    },
  ];

  for (const expected of cases) {
    it(`returns the complete ${expected.locale} 404 contract`, () => {
      const metadata = notFoundMetadata(expected.locale);

      expect(metadata.metadataBase?.toString()).toBe("https://yulalab.com/");
      expect(metadata.title).toBe(expected.title);
      expect(metadata.description).toBe(expected.description);
      expect(metadata.robots).toEqual({ index: false, follow: false });
      expect(metadata.alternates?.canonical).toBe(expected.canonical);
      expect(metadata.openGraph).toMatchObject({
        type: "website",
        locale: expected.ogLocale,
        url: expected.canonical,
        siteName: "YULA Lab",
        title: expected.title,
        description: expected.description,
      });
      expect(metadata.twitter).toMatchObject({
        card: "summary_large_image",
        title: expected.title,
        description: expected.description,
      });
    });
  }
});
