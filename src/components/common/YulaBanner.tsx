import Image from "next/image";
import { useTranslations } from "next-intl";
import { company } from "@/data/company";

/**
 * Hero banner card. Renders the real banner asset on top of the design's
 * stripe + mesh treatment so the card still feels like the prototype but
 * carries the actual brand image.
 */
export function YulaBanner() {
  const t = useTranslations("landing");
  return (
    <div className="relative w-full h-full overflow-hidden rounded-2xl border border-white/10 bg-ink-850 placeholder-stripes">
      <div className="absolute inset-0 mesh-default opacity-70" />
      <Image
        src={company.brand.banner}
        alt="YULA Lab banner"
        fill
        priority
        sizes="(max-width: 1024px) 100vw, 40vw"
        className="object-cover opacity-95 mix-blend-luminosity"
      />
      <div className="absolute inset-0 bg-gradient-to-tr from-black/40 via-black/0 to-black/30" />

      <div className="absolute top-3 left-3 font-mono text-[10px] tracking-widest text-ink-300/70 uppercase">
        {t("bannerSpec")}
      </div>
      <div className="absolute bottom-3 right-3 font-mono text-[10px] tracking-widest text-ink-300/70 uppercase">
        {t("bannerCardBottomLabel")}
      </div>

      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center px-8">
          <div className="font-display text-[12vw] md:text-[7rem] leading-none tracking-tightest font-extrabold text-ink-50/90 drop-shadow-[0_2px_24px_rgba(0,0,0,0.6)]">
            {t("bannerWord")}
          </div>
          <div className="font-mono text-[11px] mt-3 text-ink-100/90 tracking-[0.4em]">
            {t("bannerCaption")}
          </div>
        </div>
      </div>
    </div>
  );
}
