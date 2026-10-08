import { describe, expect, it, beforeAll } from "vitest";

// next.config.mjs reads NODE_ENV at import time to decide whether
// 'unsafe-eval' is allowed in script-src (dev-only, for Fast Refresh).
// Vitest's default NODE_ENV is "test", not "development", so importing
// it here exercises the same (stricter) CSP that ships to production.
let headerList: { key: string; value: string }[];
let registryJsonHeaders: { key: string; value: string }[];

beforeAll(async () => {
  const config = (await import("../next.config.mjs")).default;
  if (!config.headers) {
    throw new Error("next.config.mjs must define headers() — regression?");
  }
  const headerEntries = await config.headers();
  headerList = headerEntries
    .filter((e) => e.source !== "/portfolio-registry.json")
    .flatMap((e) => e.headers ?? []);
  const registryEntry = headerEntries.find((e) => e.source === "/portfolio-registry.json");
  registryJsonHeaders = registryEntry?.headers ?? [];
});

function header(key: string) {
  return headerList.find((h) => h.key === key)?.value;
}

describe("security headers (Y-P0-002 — Apple/Google reviewers + Lighthouse check these)", () => {
  it("sends HSTS with a 2-year max-age, includeSubDomains and preload", () => {
    const hsts = header("Strict-Transport-Security");
    expect(hsts).toContain("max-age=63072000");
    expect(hsts).toContain("includeSubDomains");
    expect(hsts).toContain("preload");
  });

  it("disables MIME-sniffing", () => {
    expect(header("X-Content-Type-Options")).toBe("nosniff");
  });

  it("blocks framing (clickjacking)", () => {
    expect(header("X-Frame-Options")).toBe("DENY");
  });

  it("sends a Referrer-Policy", () => {
    expect(header("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
  });

  it("denies camera/mic/geolocation via Permissions-Policy", () => {
    const pp = header("Permissions-Policy");
    expect(pp).toContain("camera=()");
    expect(pp).toContain("microphone=()");
    expect(pp).toContain("geolocation=()");
  });

  describe("Content-Security-Policy", () => {
    let csp: string;
    beforeAll(() => {
      csp = header("Content-Security-Policy") ?? "";
    });

    it("is present", () => {
      expect(csp).not.toBe("");
    });

    it("has no wildcard script/style/default source (would defeat the policy)", () => {
      for (const directive of ["default-src", "script-src", "style-src"]) {
        const match = csp.match(new RegExp(`${directive} ([^;]+)`));
        expect(match?.[1]).toBeDefined();
        expect(match![1].split(" ")).not.toContain("*");
      }
    });

    it("does not allow 'unsafe-eval' outside development (would widen XSS blast radius)", () => {
      // NODE_ENV=test at import time (see beforeAll above) — this must be
      // the same script-src production ships. If this ever fails, either
      // NODE_ENV leaked "development" into a prod build, or unsafe-eval
      // was added unconditionally — both are regressions worth blocking on.
      expect(csp).not.toContain("unsafe-eval");
    });

    it("restricts frame-ancestors to none (defense in depth alongside X-Frame-Options)", () => {
      expect(csp).toContain("frame-ancestors 'none'");
    });

    it("restricts object-src to none", () => {
      expect(csp).toContain("object-src 'none'");
    });

    it("upgrades insecure requests", () => {
      expect(csp).toContain("upgrade-insecure-requests");
    });
  });
});

describe("portfolio-registry.json CORS (Y-P0-003 — links.yulalab.com fetches this cross-origin)", () => {
  function registryHeader(key: string) {
    return registryJsonHeaders.find((h) => h.key === key)?.value;
  }

  it("allows links.yulalab.com specifically, not a wildcard", () => {
    expect(registryHeader("Access-Control-Allow-Origin")).toBe("https://links.yulalab.com");
  });

  it("allows only GET", () => {
    expect(registryHeader("Access-Control-Allow-Methods")).toBe("GET");
  });
});
