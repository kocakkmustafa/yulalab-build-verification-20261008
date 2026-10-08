import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

async function verificationPage(locale: "tr" | "en") {
  const { GET } = await import("@/app/[locale]/data-request/verify/route");
  return GET(
    new Request(`https://yulalab.com/${locale === "en" ? "en/" : ""}data-request/verify`),
    { params: Promise.resolve({ locale }) },
  );
}

describe("plain data-request verification capability route", () => {
  it.each(["tr", "en"] as const)(
    "%s is no-store, no-referrer, noindex/noarchive and third-party free",
    async (locale) => {
      const response = await verificationPage(locale);
      const html = await response.text();

      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toMatch(/no-store/i);
      expect(response.headers.get("referrer-policy")).toBe("no-referrer");
      expect(response.headers.get("x-robots-tag")).toMatch(/noindex.*noarchive/i);
      expect(response.headers.get("content-security-policy")).toMatch(/default-src 'none'/i);
      expect(response.headers.get("content-security-policy")).toMatch(/connect-src 'self'/i);
      expect(response.headers.get("content-security-policy")).not.toMatch(/https?:\/\//i);
      expect(html).not.toMatch(/vercel|analytics|google|<link\b|<iframe\b|<img\b|@import|@font-face|url\(/i);
      expect(html).not.toContain("__next");
      const nonce = /<script nonce="([^"]+)"/.exec(html)?.[1];
      expect(nonce).toBeTruthy();
      expect(html).toContain(`<style nonce="${nonce}">`);
      expect(response.headers.get("content-security-policy")).toContain(`style-src 'nonce-${nonce}'`);
      expect(response.headers.get("content-security-policy")).not.toContain("unsafe-inline");
    },
  );

  it("scrubs the fragment before any network-capable code and POSTs only on click", async () => {
    const html = await (await verificationPage("tr")).text();
    const scrub = html.indexOf("history.replaceState");
    const fetchCall = html.indexOf("fetch(");
    const clickBinding = html.indexOf('addEventListener("click"');

    expect(scrub).toBeGreaterThan(-1);
    expect(fetchCall).toBeGreaterThan(scrub);
    expect(clickBinding).toBeGreaterThan(scrub);
    expect(html).toContain("location.hash");
    expect(html).toContain("/api/data-request");
    expect(html).not.toMatch(/document\.referrer|navigator\.sendBeacon|new Image/i);
  });

  it.each(["tr", "en"] as const)("%s has an inert no-script state and a localized exit", async (locale) => {
    const html = await (await verificationPage(locale)).text();
    expect(html).toContain('<button id="verify" type="button" hidden>');
    expect(html).toContain("<noscript><p>");
    expect(html).toContain(`href="${locale === "en" ? "/en" : ""}/contact"`);
  });

  it("a scanner GET performs no server-side POST or external request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const response = await verificationPage("en");
    expect(response.status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
