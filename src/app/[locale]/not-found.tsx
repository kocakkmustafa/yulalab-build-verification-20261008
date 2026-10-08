import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ArrowLeft } from "@/components/common/icons";

export default function NotFound() {
  const t = useTranslations("notFound");
  const tc = useTranslations("common");

  return (
    <div className="page-enter max-w-3xl mx-auto px-6 pt-40 pb-32 text-center">
      <div className="font-mono text-[11px] tracking-widest uppercase text-ink-300 mb-4">
        404
      </div>
      <h1 className="font-display text-5xl font-semibold tracking-tight text-ink-50">
        {t("title")}
      </h1>
      <Link
        href="/"
        className="mt-8 inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-3 text-[14px] hover:border-white/30 hover:bg-white/[0.04] transition-colors"
      >
        <ArrowLeft size={14} strokeWidth={2} /> {tc("home")}
      </Link>
    </div>
  );
}
