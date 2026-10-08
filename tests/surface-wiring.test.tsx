import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import ContactPage from "@/app/[locale]/contact/page";
import StudioPage from "@/app/[locale]/studio/page";
import PrivacyPage from "@/app/[locale]/privacy/page";
import { mailTransport } from "@/server/mail";
import { APPROVED_MAIL_IDENTITY, MAIL_IDENTITY_ENV } from "@/server/mail-identity";
import { studioEnabled } from "@/server/studio-surface";

/**
 * The three booleans that decide whether the site collects personal data,
 * and whether it says so.
 *
 * Grepping the source for `leadsEnabled()` does NOT guard these: negating
 * the call satisfies the grep, and the resulting page tells a reader there
 * is no contact form while a live form collects their name, email and
 * message. Nothing in the e2e suite catches it either — LEADS_ENABLED is
 * set nowhere in CI, so every rendered test only ever sees the closed
 * branch.
 *
 * A server component is a function returning an element, so the wiring can
 * be read off `props` without rendering anything.
 */
vi.mock("next-intl/server", () => ({ setRequestLocale: () => {} }));
// next-intl's navigation helpers reach for next/navigation, which does not
// resolve outside a Next runtime. Neither page's wiring depends on it.
vi.mock("@/i18n/navigation", () => ({ Link: "a" }));
const redirectSpy = vi.hoisted(() =>
  vi.fn((destination: string): never => {
    throw new Error(`NEXT_REDIRECT:${destination}`);
  }),
);
vi.mock("next/navigation", () => ({ redirect: redirectSpy }));

const original = { ...process.env };
afterEach(() => {
  process.env = { ...original };
  redirectSpy.mockClear();
});

async function contactProps() {
  const element = await ContactPage({ params: Promise.resolve({ locale: "tr" }) });
  return (
    element as {
      props: { enabled: boolean; mailConfigured: boolean; studioEnabled: boolean };
    }
  ).props;
}

async function privacyProps() {
  const element = await PrivacyPage({ params: Promise.resolve({ locale: "tr" }) });
  return (element as { props: { formOpen: boolean } }).props;
}

async function studioProps(locale: "tr" | "en" = "tr") {
  const element = await StudioPage({ params: Promise.resolve({ locale }) });
  return (element as { props: { open: boolean } }).props;
}

describe("the Studio surface is fail-closed", () => {
  it.each([undefined, "", "false", "0", "1", "TRUE", "yes"])(
    "stays disabled for %s",
    (value) => {
      if (value === undefined) delete process.env.STUDIO_ENABLED;
      else process.env.STUDIO_ENABLED = value;
      expect(studioEnabled()).toBe(false);
    },
  );

  it("is enabled only by the exact server-owned value true", () => {
    process.env.STUDIO_ENABLED = "true";
    expect(studioEnabled()).toBe(true);
  });

  it.each([
    ["tr", "/contact"],
    ["en", "/en/contact"],
  ] as const)("redirects disabled %s Studio to localized contact", async (locale, destination) => {
    delete process.env.STUDIO_ENABLED;
    await expect(StudioPage({ params: Promise.resolve({ locale }) })).rejects.toThrow(
      `NEXT_REDIRECT:${destination}`,
    );
    expect(redirectSpy).toHaveBeenCalledWith(destination);
  });

  it("renders information but no form when Studio is enabled and leads are closed", async () => {
    process.env.STUDIO_ENABLED = "true";
    delete process.env.LEADS_ENABLED;
    expect((await studioProps()).open).toBe(false);
  });

  it("opens the qualified form only when both Studio and leads are enabled", async () => {
    process.env.STUDIO_ENABLED = "true";
    process.env.LEADS_ENABLED = "1";
    expect((await studioProps()).open).toBe(true);
  });
});

describe("Studio CTA wiring follows the rollback switch", () => {
  const root = process.cwd();
  const header = readFileSync(path.join(root, "src/components/layout/Header.tsx"), "utf8");
  const footer = readFileSync(path.join(root, "src/components/layout/Footer.tsx"), "utf8");
  const contact = readFileSync(path.join(root, "src/app/[locale]/contact/page.tsx"), "utf8");
  const layout = readFileSync(path.join(root, "src/app/[locale]/layout.tsx"), "utf8");

  it("passes one server-owned value to both global navigation surfaces", () => {
    expect(layout.match(/studioEnabled=\{studioOpen\}/g)).toHaveLength(2);
    expect(header.match(/navigation\.map/g)).toHaveLength(2);
    expect(header).toMatch(/studioEnabled \? NAV : NAV\.filter/);
    expect(footer).toMatch(/studioEnabled[\s\S]*navStudio/);
  });

  it("does not advertise the Studio CTA on Contact while Studio is disabled", async () => {
    delete process.env.STUDIO_ENABLED;
    expect((await contactProps()).studioEnabled).toBe(false);
    expect(contact).toMatch(/\{studioEnabled \? \([\s\S]*data-contact-studio/);
    expect(contact).toMatch(/<LeadForm[\s\S]*studioEnabled=\{studioEnabled\}/);
  });
});

describe("the contact page follows the switch", () => {
  it("hides the form while collection is closed", async () => {
    delete process.env.LEADS_ENABLED;
    expect((await contactProps()).enabled).toBe(false);
  });

  it("shows it when collection is open", async () => {
    // Inverting the wiring renders a form while the sink answers 503.
    process.env.LEADS_ENABLED = "1";
    expect((await contactProps()).enabled).toBe(true);
  });
});

describe("the privacy notice follows the same switch", () => {
  it("says there is no form while there is none", async () => {
    delete process.env.LEADS_ENABLED;
    expect((await privacyProps()).formOpen).toBe(false);
  });

  it("says there is one when there is", async () => {
    // The direction that matters: negated wiring leaves a legal notice
    // stating no form exists while one collects name, email and message.
    process.env.LEADS_ENABLED = "1";
    expect((await privacyProps()).formOpen).toBe(true);
  });
});

describe("the emailed-a-copy claim follows the transport", () => {
  it("is false when nothing can send", async () => {
    process.env.LEADS_ENABLED = "1";
    delete process.env.SENDGRID_API_KEY;
    expect((await contactProps()).mailConfigured).toBe(false);
    expect(mailTransport().configured).toBe(false);
  });

  it("tracks mailTransport(), not a constant", async () => {
    process.env.LEADS_ENABLED = "1";
    process.env.SENDGRID_API_KEY = "SG.key";
    process.env[MAIL_IDENTITY_ENV.fromEmail] = APPROVED_MAIL_IDENTITY.fromEmail;
    process.env[MAIL_IDENTITY_ENV.fromName] = APPROVED_MAIL_IDENTITY.fromName;
    process.env[MAIL_IDENTITY_ENV.replyToEmail] = APPROVED_MAIL_IDENTITY.replyToEmail;
    expect((await contactProps()).mailConfigured).toBe(true);
    expect((await contactProps()).mailConfigured).toBe(mailTransport().configured);
  });

  it("does not advertise mailed copy delivery for legacy-only identity config", async () => {
    process.env.LEADS_ENABLED = "1";
    process.env.SENDGRID_API_KEY = "SG.key";
    process.env.MAIL_FROM = "hello@yulalab.com";
    process.env.LEADS_INTERNAL_ADDRESS = "yula@yulalab.com";

    expect((await contactProps()).mailConfigured).toBe(false);
    expect(mailTransport().configured).toBe(false);
  });
});
