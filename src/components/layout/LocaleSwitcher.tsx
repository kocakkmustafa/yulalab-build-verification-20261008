"use client";

import { useLocale } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import { useRouter } from "@/i18n/navigation";

type Props = { onNavigate?: () => void };

export function LocaleSwitcher({ onNavigate }: Props) {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  const otherLocale = locale === "tr" ? "en" : "tr";

  const handleClick = () => {
    // Keep normal page sections, especially account deletion, reachable in
    // either language. Query values are deliberately not copied between URLs.
    router.replace(`${pathname}${window.location.hash}`, { locale: otherLocale });
    onNavigate?.();
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="inline-flex items-center gap-1 rounded-full border border-white/10 px-3 py-1.5 text-[11.5px] font-mono tracking-widest uppercase text-ink-200 hover:text-ink-50 hover:border-white/25 transition-colors focusable"
      aria-label={locale === "tr" ? "TR/EN — İngilizceye geç" : "TR/EN — switch to TR"}
    >
      <span className={locale === "tr" ? "text-ink-50" : "opacity-60"}>TR</span>
      <span className="opacity-30">/</span>
      <span className={locale === "en" ? "text-ink-50" : "opacity-60"}>EN</span>
    </button>
  );
}
