import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { useLocale, useTranslations } from "next-intl";
import { EyebrowChip } from "@/components/common/EyebrowChip";
import { StaggerWords } from "@/components/common/StaggerWords";
import { notes } from "@/data/notes";
import type { Locale } from "@/lib/types";
import { GlassSheen } from "@/components/common/GlassSheen";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "notes" });
  return {
    title: t("title"),
    description: t("intro"),
    alternates: {
      canonical: locale === "tr" ? "/notes" : `/${locale}/notes`,
    },
  };
}

export default async function NotesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <Notes />;
}

function Notes() {
  const t = useTranslations("notes");
  const locale = useLocale() as Locale;

  return (
    <div className="page-enter relative">
      <GlassSheen />
      <div className="ambient" aria-hidden />
      <section className="max-w-3xl mx-auto px-6 lg:px-10 pt-32 lg:pt-40 pb-12">
        <EyebrowChip>{t("eyebrow")}</EyebrowChip>
        <h1 className="mt-7 font-display font-extrabold text-ink-50 leading-[0.96] tracking-tightest text-[40px] sm:text-[56px] md:text-[68px]">
          <StaggerWords text={t("title")} />
        </h1>
        <p className="mt-7 max-w-[58ch] text-[16.5px] leading-[1.65] text-ink-300">
          {t("intro")}
        </p>
      </section>

      <section className="max-w-3xl mx-auto px-6 lg:px-10 pb-24 space-y-10">
        {notes.map((note) => (
          <article
            key={note.slug}
            className="rounded-2xl border border-hairline bg-surface p-7"
          >
            <time
              dateTime={note.date}
              className="font-mono text-[11px] tracking-widest uppercase text-ink-400"
            >
              {note.date}
            </time>
            <h2 className="mt-3 font-display text-xl font-semibold tracking-tight text-ink-50">
              {note.title[locale]}
            </h2>
            <p className="mt-2 text-[15px] leading-relaxed text-ink-300">
              {note.body[locale]}
            </p>
          </article>
        ))}
      </section>
    </div>
  );
}
