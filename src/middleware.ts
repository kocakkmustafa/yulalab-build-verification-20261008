import { NextRequest, NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";

const intl = createMiddleware(routing);

// next-intl's locale middleware should not run on Next.js metadata-file
// routes (opengraph-image, twitter-image, icon, etc.). Those live at fixed
// top-level paths and a `localePrefix: "as-needed"` rewrite would
// 404 them. The dot-exclusion in the matcher catches `/sitemap.xml`
// and `/robots.txt`, but the metadata route segments have no extension
// in the URL — so we filter them in middleware code instead.
const METADATA_ROUTES = [
  "opengraph-image",
  "twitter-image",
  "icon",
  "apple-icon",
  "manifest",
];

function isMetadataRoute(pathname: string): boolean {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return false;
  const last = segments[segments.length - 1];
  return METADATA_ROUTES.some(
    (name) => last === name || last.startsWith(`${name}.`),
  );
}

function canonicalRedirect(req: NextRequest, pathname: string, locale: "tr" | "en") {
  const destination = new URL(req.url);
  destination.pathname = pathname;
  const response = NextResponse.redirect(destination);
  // Explicit locale paths take precedence over a previous cookie or the
  // browser language, including after TR's as-needed prefix is removed.
  response.cookies.set("NEXT_LOCALE", locale, { path: "/", sameSite: "lax" });
  return response;
}

export default function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  // Netlify can forward next-intl's internal /tr rewrite before evaluating
  // Next config redirects. Resolve this external alias before locale routing
  // so /links cannot become an unknown localized page. Never forward query
  // values: the destination is the fixed public hub, not a caller's returnTo.
  if (/^\/(?:tr\/|en\/)?links\/?$/.test(decoded)) {
    const destination = new URL("https://links.yulalab.com/");
    if (decoded.startsWith("/en/")) destination.searchParams.set("lang", "en");
    return NextResponse.redirect(destination, 308);
  }

  // Config headers match the encoded URL, while route matching can decode
  // segments. Canonicalize capability aliases before a successful response
  // so the generic policy cannot mask the route's random nonce policy.
  if (/^\/(?:tr\/|en\/)?data-request\/verify\/?$/.test(decoded)) {
    const canonical = decoded.startsWith("/en/")
      ? "/en/data-request/verify"
      : "/data-request/verify";
    if (pathname !== canonical) {
      return canonicalRedirect(req, canonical, canonical.startsWith("/en/") ? "en" : "tr");
    }
  }

  // Canonicalize external TR URLs here only. A config redirect would run
  // again after Netlify forwards next-intl's internal /tr rewrite to Next.
  if (pathname === "/tr" || pathname.startsWith("/tr/")) {
    const canonical = pathname.slice(3) || "/";
    const decodedCanonical = decoded.slice(3) || "/";
    if (/^\/[\\/]/.test(decodedCanonical) || decodedCanonical.includes("\\")) {
      return new NextResponse(null, { status: 400 });
    }
    return canonicalRedirect(req, canonical, "tr");
  }

  if (isMetadataRoute(req.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const firstSegment = req.nextUrl.pathname.split("/")[1];
  if (
    /^[a-z]{2}$/.test(firstSegment) &&
    !routing.locales.some((locale) => locale === firstSegment)
  ) {
    return new NextResponse(null, { status: 404 });
  }

  return intl(req);
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
