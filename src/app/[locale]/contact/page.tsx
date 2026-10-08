import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { useTranslations } from "next-intl";
import { EyebrowChip } from "@/components/common/EyebrowChip";
import { StaggerWords } from "@/components/common/StaggerWords";
import { MailCard } from "@/components/contact/MailCard";
import { company } from "@/data/company";
import { LeadForm } from "@/components/contact/LeadForm";
import { leadsEnabled } from "@/server/lead-surface";
import { mailTransport } from "@/server/mail";
import { Link } from "@/i18n/navigation";
import { publicRegistry } from "@/data/public-registry";
import { partitionForIndex } from "@/lib/product-index";
import { GlassSheen } from "@/components/common/GlassSheen";
import { studioEnabled } from "@/server/studio-surface";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "contact" });
  return {
    title: t("eyebrow"),
    description: t("intro"),
    alternates: {
      canonical: locale === "tr" ? "/contact" : `/${locale}/contact`,
    },
  };
}

export default async function ContactPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  // Evaluated here, on the server, and baked in at build — see
  // `leadsEnabled`. The mail links below stay whether or not the form does:
  // they work today, they need no consent record, and they are the fallback
  // the form's own "closed" message points at.
  return (
    <Contact
      enabled={leadsEnabled()}
      mailConfigured={mailTransport().configured}
      studioEnabled={studioEnabled()}
    />
  );
}

function Contact({
  enabled,
  mailConfigured,
  studioEnabled,
}: {
  enabled: boolean;
  mailConfigured: boolean;
  studioEnabled: boolean;
}) {
  const t = useTranslations("contact");
  const studioT = useTranslations("studio");
  const consultingT = useTranslations("consulting");
  return (
    <div className="page-enter relative">
      <GlassSheen />
      <div className="ambient" aria-hidden />
      <div aria-hidden className="absolute inset-x-0 top-0 h-[60vh] pointer-events-none">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(255,255,255,0.05), transparent 70%)",
          }}
        />
      </div>

      <section className="relative max-w-3xl mx-auto px-6 lg:px-10 pt-32 lg:pt-40 pb-12">
        <EyebrowChip>{t("eyebrow")}</EyebrowChip>
        <h1 className="mt-7 font-display font-extrabold text-ink-50 leading-[0.96] tracking-tightest text-[44px] sm:text-[60px] md:text-[80px]">
          <StaggerWords text={t("title")} />
        </h1>
        <p className="mt-7 max-w-[55ch] text-[16.5px] leading-[1.65] text-ink-300">
          {t("intro")}
        </p>
      </section>

      <section className="relative max-w-3xl mx-auto px-6 lg:px-10 pb-4">
        <Link href="/consulting" className="focusable text-ink-100 underline underline-offset-4">{consultingT("cta")}</Link>
      </section>

      {enabled ? (
        <section className="relative max-w-3xl mx-auto px-6 lg:px-10 pt-6 pb-4">
          <LeadForm
            mailConfigured={mailConfigured}
            studioEnabled={studioEnabled}
            products={partitionForIndex(publicRegistry).primary.map((record) => ({
              slug: record.slug,
              name: record.name,
            }))}
          />
        </section>
      ) : null}

      <section className="relative max-w-3xl mx-auto px-6 lg:px-10 pt-6 pb-12">
        <MailCard
          label={t("generalLabel")}
          address={company.contact.email}
          hint={t("generalHint")}
          accent="#C3F400"
        />
      </section>

      {/* A project enquiry sent here costs the sender a round trip: the reply
          is three qualifying questions /studio already asks. Pointing at it is
          the whole modification the roadmap asks of this page — the general
          address stays, because not every message is a project. */}
      {studioEnabled ? (
        <section className="relative max-w-5xl mx-auto px-6 lg:px-10 pt-6 pb-6">
          <div className="glass p-7">
            <div className="font-mono text-[11px] tracking-widest uppercase text-ink-400 mb-2">
              {t("studioEyebrow")}
            </div>
            <h2 className="font-display text-2xl font-semibold tracking-tight text-ink-50">
              {enabled ? t("studioTitle") : studioT("form.closedTitle")}
            </h2>
            <p className="mt-3 max-w-[62ch] text-[14.5px] leading-relaxed text-ink-300">
              {enabled ? t("studioBody") : studioT("form.closedBody")}
            </p>
            <Link
              href="/studio"
              data-contact-studio
              className="focusable mt-5 inline-flex rounded-full border border-hairline-strong px-6 py-3 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-50"
            >
              {enabled ? t("studioLink") : studioT("title")}
            </Link>
          </div>
        </section>
      ) : null}

      <section className="relative max-w-5xl mx-auto px-6 lg:px-10 pt-12 pb-16">
        <div className="glass p-7 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
          <div>
            <div className="font-mono text-[11px] tracking-widest uppercase text-ink-400 mb-2">
              {t("locationEyebrow")}
            </div>
            <div className="font-display text-2xl font-semibold tracking-tight text-ink-50">
              {t("locationTitle")}
            </div>
            <div className="text-[14px] text-ink-400 mt-1">{t("locationNote")}</div>
          </div>
          <div className="flex items-center gap-3 text-[12px] font-mono tracking-widest uppercase text-ink-400">
            <span>Türkiye</span>
            <span className="w-px h-3 bg-white/10" />
            <span>GMT+3</span>
          </div>
        </div>
      </section>
    </div>
  );
}
