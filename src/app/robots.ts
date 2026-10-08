import type { MetadataRoute } from "next";

function siteOrigin(): string {
  // Keep this in lockstep with src/app/sitemap.ts: the apex domain is the
  // canonical, NEXT_PUBLIC_SITE_URL overrides for staging, never fall back
  // to VERCEL_URL here or robots.txt advertises a sitemap on a different
  // host than the one we publish from.
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  return "https://yulalab.com";
}

export default function robots(): MetadataRoute.Robots {
  const origin = siteOrigin();
  return {
    rules: [{ userAgent: "*", allow: "/" }],
    sitemap: `${origin}/sitemap.xml`,
    host: origin,
  };
}
