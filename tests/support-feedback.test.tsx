// @vitest-environment jsdom
import type { AnchorHTMLAttributes } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import SupportPage from "@/app/[locale]/support/page";
import en from "../messages/en.json";
import tr from "../messages/tr.json";

vi.mock("next-intl/server", () => ({ setRequestLocale: vi.fn() }));
vi.mock("@/components/common/GlassSheen", () => ({ GlassSheen: () => null }));
vi.mock("@/i18n/navigation", () => ({
  Link: (props: AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props} />,
}));

afterEach(cleanup);

async function show(locale: "tr" | "en") {
  const page = await SupportPage({ params: Promise.resolve({ locale }) });
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === "tr" ? tr : en} timeZone="Europe/Istanbul">
      {page}
    </NextIntlClientProvider>,
  );
}

describe.each(["tr", "en"] as const)("%s support feedback", (locale) => {
  it("offers the same encoded draft from both support links", async () => {
    const { container } = await show(locale);
    const links = [...container.querySelectorAll<HTMLAnchorElement>('a[href^="mailto:"]')];
    expect(links).toHaveLength(2);
    expect(links[0].getAttribute("href")).toBe(links[1].getAttribute("href"));
    const href = links[0].getAttribute("href")!;
    expect(href).toMatch(/^mailto:support@yulalab\.com\?subject=/);
    expect(href).not.toMatch(/[\r\n]/);
    const draft = new URL(href);
    expect(draft.searchParams.get("subject")).toBe(locale === "tr" ? "Ürün desteği / geri bildirim" : "Product support / feedback");
    const body = draft.searchParams.get("body")!;
    for (const field of locale === "tr"
      ? ["Ürün:", "Sürüm / build:", "Cihaz ve işletim sistemi:", "Beklenen sonuç:", "Gerçek sonuç / takıldığım adım:", "Tekrar oluşturma adımları:"]
      : ["Product:", "Version / build:", "Device and operating system:", "Expected result:", "Actual result / step where I got stuck:", "Steps to reproduce:"]) {
      expect(body).toContain(field);
    }
  });

  it("explains the user's send step without a response-time promise or intake form", async () => {
    const { container } = await show(locale);
    expect(screen.getByText(locale === "tr" ? "E-posta taslağını açar; mesajı siz gönderirsiniz" : "Opens an email draft; you send the message")).toBeTruthy();
    expect(container.textContent).not.toMatch(/48\s*(saat|hours)|\b(ACIL|URGENT)\b/);
    expect(container.querySelector("form")).toBeNull();
  });

  it("keeps secrets and personal screenshot content out of the requested diagnostics", async () => {
    const { container } = await show(locale);
    const href = container.querySelector<HTMLAnchorElement>('a[href^="mailto:"]')!.getAttribute("href")!;
    const body = new URL(href).searchParams.get("body")!;
    expect(body).toContain(locale === "tr"
      ? "Şifre, doğrulama kodu, API anahtarı veya özel kayıt eklemeyin."
      : "Do not include passwords, verification codes, API keys or private records.");
    expect(body).toContain(locale === "tr"
      ? "Ekran görüntüsündeki kişisel bilgileri kapatın."
      : "Redact personal information in screenshots.");
  });
});
