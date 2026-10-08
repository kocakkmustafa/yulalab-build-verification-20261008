import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { company } from "@/data/company";

type Props = { params: Promise<{ locale: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "consulting" });
  return { title: t("nav"), description: t("intro"), alternates: {
    canonical: locale === "tr" ? "/consulting" : "/en/consulting",
    languages: { tr: "/consulting", en: "/en/consulting" },
  } };
}
export default async function ConsultingPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "consulting" });
  const services = t.raw("services") as { title: string; body: string; output: string }[];
  const steps = t.raw("steps") as string[];
  const email = `mailto:${company.contact.email}?subject=${encodeURIComponent(t("subject"))}`;
  return (
    <div className="page-enter max-w-6xl mx-auto px-6 lg:px-10 pt-32 pb-12">
      <section aria-labelledby="consulting-title" className="max-w-3xl">
        <p className="font-mono text-xs tracking-widest text-ink-200">{t("eyebrow")}</p>
        <h1 id="consulting-title" className="mt-6 font-display text-4xl sm:text-6xl font-semibold tracking-tight leading-tight">{t("title")}</h1>
        <p className="mt-6 text-lg leading-relaxed text-ink-200">{t("intro")}</p>
        <a href="#consulting-contact" className="focusable inline-flex mt-8 rounded-full bg-ink-50 text-ink-900 px-6 py-3 font-medium">{t("cta")} <span aria-hidden="true" className="ml-3">↘</span></a>
      </section>
      <section aria-labelledby="services-title" className="mt-20">
        <h2 id="services-title" className="font-display text-3xl font-semibold">{t("servicesTitle")}</h2>
        <div className="mt-8 grid md:grid-cols-3 gap-5">
          {services.map((service, index) => <article key={service.title} className="rounded-2xl border border-hairline bg-surface p-6">
            <p aria-hidden="true" className="font-mono text-sm text-ink-300">0{index + 1}</p>
            <h3 className="mt-5 font-display text-2xl font-semibold">{service.title}</h3>
            <p className="mt-4 text-ink-200 leading-relaxed">{service.body}</p>
            <p className="mt-6 border-t border-hairline pt-5 text-sm text-ink-200 leading-relaxed">{service.output}</p>
          </article>)}
        </div>
      </section>
      <section aria-labelledby="process-title" className="mt-20 grid md:grid-cols-2 gap-10">
        <div><h2 id="process-title" className="font-display text-3xl font-semibold">{t("processTitle")}</h2><p className="mt-5 text-ink-200 leading-relaxed">{t("limits")}</p></div>
        <ol className="list-decimal pl-6 space-y-5 text-ink-200 leading-relaxed">{steps.map(step => <li key={step} className="pl-2">{step}</li>)}</ol>
      </section>
      <section aria-labelledby="proof-title" className="mt-20 border-t border-hairline pt-10">
        <h2 id="proof-title" className="font-display text-3xl font-semibold">{t("proofTitle")}</h2>
        <p className="mt-5 max-w-3xl text-ink-200 leading-relaxed">{t("proofBody")}</p>
        <Link href="/projects" className="focusable inline-flex mt-6 underline underline-offset-4">{t("proofLink")}</Link>
      </section>
      <section id="consulting-contact" aria-labelledby="contact-title" className="scroll-mt-24 mt-20 rounded-2xl border border-hairline-strong bg-surface p-6 sm:p-10">
        <h2 id="contact-title" className="font-display text-3xl font-semibold">{t("contactTitle")}</h2>
        <p className="mt-5 max-w-3xl text-ink-200 leading-relaxed">{t("contactBody")}</p>
        <a data-consulting-email href={email} className="focusable inline-flex mt-7 rounded-full bg-ink-50 text-ink-900 px-6 py-3 font-medium">{t("cta")} <span aria-hidden="true" className="ml-3">↗</span></a>
        <p className="mt-5 text-ink-200 [overflow-wrap:anywhere]">{company.contact.email}</p>
        <p className="mt-3 text-sm text-ink-300">{t("terms")}</p>
      </section>
    </div>
  );
}
