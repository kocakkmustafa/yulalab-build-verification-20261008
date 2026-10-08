import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { useTranslations } from "next-intl";
import { redirect } from "next/navigation";
import { EyebrowChip } from "@/components/common/EyebrowChip";
import { GlassSheen } from "@/components/common/GlassSheen";
import { StaggerWords } from "@/components/common/StaggerWords";
import { StudioApplicationForm } from "@/components/studio/StudioApplication";
import { TrackView } from "@/components/common/TrackView";
import { leadsEnabled } from "@/server/lead-surface";
import { studioEnabled } from "@/server/studio-surface";

/**
 * Studio / Build with YULA (roadmap §5.5, Y-P1-004).
 *
 * The page most tempted to promise something. Three rules hold it down: it
 * says who it is NOT for as plainly as who it is for; it names no price,
 * because commercial terms are the founder's to state (R3); and it promises
 * no outcome, because /case-studies is empty and this site does not assert
 * what it has not verified.
 *
 * Copy lives in messages/*.json like every other page — not because of
 * convention for its own sake, but because that is where the claim scanner
 * can read published sentences without tripping over identifiers and code
 * comments. Inline copy here made the guard noisy, and a noisy guard is one
 * somebody turns off.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "studio" });
  return {
    title: t("title"),
    description: t("intro"),
    alternates: {
      canonical: locale === "tr" ? "/studio" : `/${locale}/studio`,
      languages: { tr: "/studio", en: "/en/studio" },
    },
  };
}

export default async function StudioPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!studioEnabled()) {
    redirect(locale === "tr" ? "/contact" : `/${locale}/contact`);
  }
  setRequestLocale(locale);
  return <Studio open={leadsEnabled()} />;
}

function Studio({ open }: { open: boolean }) {
  const t = useTranslations("studio");
  const forList = t.raw("for") as string[];
  const notForList = t.raw("notFor") as string[];
  const stages = t.raw("stages") as { title: string; body: string; deliverable: string }[];

  return (
    <div className="page-enter relative">
      <TrackView event="studio_view" />
      <GlassSheen />
      <div className="ambient" aria-hidden />

      <section className="mx-auto max-w-3xl px-6 pb-12 pt-32 lg:px-10 lg:pt-40">
        <EyebrowChip>{t("eyebrow")}</EyebrowChip>
        <h1 className="mt-7 font-display text-[40px] font-extrabold leading-[0.96] tracking-tightest text-ink-50 sm:text-[56px] md:text-[68px]">
          <StaggerWords text={t("title")} />
        </h1>
        <p className="mt-7 max-w-[58ch] text-[16.5px] leading-[1.65] text-ink-300">{t("intro")}</p>
      </section>

      <section className="mx-auto max-w-3xl px-6 pb-14 lg:px-10">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-hairline bg-surface p-6">
            <h2 className="font-display text-lg font-semibold text-ink-50">{t("forTitle")}</h2>
            <ul className="mt-4 space-y-3 text-[14.5px] leading-relaxed text-ink-300">
              {forList.map((item) => (
                <li key={item} className="flex gap-2">
                  <span aria-hidden className="text-ink-500">—</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          {/* A page that only lists fit is a brochure. */}
          <div data-studio-notfor className="rounded-2xl border border-hairline bg-surface-inset p-6">
            <h2 className="font-display text-lg font-semibold text-ink-50">{t("notForTitle")}</h2>
            <ul className="mt-4 space-y-3 text-[14.5px] leading-relaxed text-ink-300">
              {notForList.map((item) => (
                <li key={item} className="flex gap-2">
                  <span aria-hidden className="text-ink-400">!</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 pb-14 lg:px-10">
        <h2 className="font-display text-2xl font-semibold tracking-tight text-ink-50">
          {t("stagesTitle")}
        </h2>
        <ol data-studio-stages className="mt-6 space-y-4">
          {stages.map((stage, i) => (
            <li
              key={stage.title}
              className="flex gap-5 rounded-2xl border border-hairline bg-surface p-5"
            >
              <span className="font-mono text-[11px] text-ink-300">0{i + 1}</span>
              <div>
                <div className="font-display text-base font-semibold text-ink-50">{stage.title}</div>
                <p className="mt-1.5 text-[14.5px] leading-relaxed text-ink-300">{stage.body}</p>
                {/* Roadmap §5.5 asks for exact deliverables, not just activity.
                    Anchored so an e2e test counts what is RENDERED: the keys
                    existed in both message files for a round while nothing
                    on the page printed them. */}
                <p
                  data-studio-deliverable
                  className="mt-2 font-mono text-[11px] uppercase tracking-widest text-ink-300"
                >
                  {stage.deliverable}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto max-w-3xl px-6 pb-14 lg:px-10">
        <div className="rounded-2xl border border-hairline bg-surface-inset p-6">
          <h2 className="font-display text-lg font-semibold text-ink-50">{t("dataTitle")}</h2>
          <p className="mt-3 text-[14.5px] leading-relaxed text-ink-300">{t("dataBody")}</p>
          <h3 className="mt-6 font-display text-base font-semibold text-ink-50">
            {t("noPromiseTitle")}
          </h3>
          <p data-studio-nopromise className="mt-2 text-[14.5px] leading-relaxed text-ink-300">
            {t("noPromiseBody")}
          </p>
          <p className="mt-4 font-mono text-[10px] uppercase tracking-widest text-ink-300">
            {t("termsNote")}
          </p>
        </div>
      </section>

      <section id="basvuru" className="mx-auto max-w-3xl px-6 pb-24 lg:px-10">
        <h2 className="font-display text-2xl font-semibold tracking-tight text-ink-50">
          {t("applyTitle")}
        </h2>
        <p className="mt-3 max-w-[58ch] text-[15px] leading-[1.65] text-ink-300">
          {t("applyIntro")}
        </p>
        <div className="mt-6">
          <StudioApplicationForm open={open} />
        </div>
      </section>
    </div>
  );
}
