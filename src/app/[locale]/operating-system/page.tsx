import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { EyebrowChip } from "@/components/common/EyebrowChip";
import { GlassSheen } from "@/components/common/GlassSheen";
import { StaggerWords } from "@/components/common/StaggerWords";
import {
  EVIDENCE_LEVELS,
  evidenceCounts,
  forbiddenPatternCount,
  lapsedSurfaceCount,
  lifecycleRows,
  portfolioCounts,
} from "@/lib/operating-system";
// The scanner's own array — the count cannot disagree with the scanner.
import { FORBIDDEN } from "../../../../scripts/forbidden-patterns.mjs";
import { RAW_RETENTION_DAYS } from "@/lib/analytics/session-hash";
import type { Locale } from "@/lib/types";

/**
 * Operating System / how this lab works (roadmap §4.5, §5.6).
 *
 * Every number on this page is derived from the live registry
 * (src/lib/operating-system.ts), and the "Current limitations" section is
 * as load-bearing as the rest: a page describing how we stay honest, that
 * omits what is currently NOT honest, would be the exact failure it claims
 * to prevent.
 */
/**
 * Same 15-minute window the product routes use (Y-P0-003): the limitations
 * section reports how many surface assertions have lapsed RIGHT NOW, and a
 * fully static page would freeze that number at build time — the page would
 * keep claiming a stale count long after the data moved.
 */
export const revalidate = 900;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const tr = locale === "tr";
  return {
    title: tr ? "Nasıl çalışıyoruz" : "How we work",
    description: tr
      ? "Kanıt seviyeleri, ürün durum makinesi, iddia politikası, AI ile insan arasındaki karar sınırı ve bugünkü kısıtlar."
      : "Evidence levels, the product state machine, our claim policy, the AI/human decision boundary, and today's limitations.",
    alternates: {
      canonical: tr ? "/operating-system" : `/${locale}/operating-system`,
      languages: { tr: "/operating-system", en: "/en/operating-system" },
    },
  };
}

export default async function OperatingSystemPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <OperatingSystem />;
}

function OperatingSystem() {
  const locale = useLocale() as Locale;
  const tr = locale === "tr";
  const counts = evidenceCounts();
  const totals = portfolioCounts();
  const lifecycles = lifecycleRows();
  // Read at render time (the route revalidates), so this figure ages with
  // the data instead of with the deploy.
  const lapsed = lapsedSurfaceCount(new Date());
  // Read from the scanner source itself. Stating this as a literal was
  // wrong in both directions: the page could name a number the scanner did
  // not have, and the scanner could gain a pattern the page never mentioned.
  const forbiddenCount = forbiddenPatternCount(FORBIDDEN);
  const lifecycleCount = lifecycles.length;

  return (
    <div className="page-enter relative">
      <GlassSheen />
      <div className="ambient" aria-hidden />

      <section className="mx-auto max-w-3xl px-6 pb-12 pt-32 lg:px-10 lg:pt-40">
        <EyebrowChip>{tr ? "İşletim biçimi" : "Operating system"}</EyebrowChip>
        <h1 className="mt-7 font-display text-[40px] font-extrabold leading-[0.96] tracking-tightest text-ink-50 sm:text-[56px] md:text-[68px]">
          <StaggerWords text={tr ? "Nasıl çalışıyoruz." : "How we work."} />
        </h1>
        <p className="mt-7 max-w-[58ch] text-[16.5px] leading-[1.65] text-ink-300">
          {tr
            ? "Bu sayfa, kaynakta tanımlı mekanizmaları ve kapsamlarını anlatır. Ürün, iddia, kanıt seviyesi, durum ve süresi dolmuş yüzey sayıları kayıtlı veriden hesaplanır; canlı işlerin çalışması ayrıca çalışma kayıtlarıyla doğrulanır."
            : "This page describes the mechanisms defined in the source and their scope. Product, claim, evidence-level, lifecycle and expired-surface counts are computed from recorded data; live jobs require separate execution evidence."}
        </p>
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            [totals.products, tr ? "ürün" : "products"],
            [totals.claims, tr ? "kayıtlı iddia" : "recorded claims"],
            [totals.screenshots, tr ? "kaynaklı ekran" : "sourced screenshots"],
            [totals.caseStudies, tr ? "vaka çalışması" : "case studies"],
          ].map(([n, label]) => (
            <div key={String(label)} className="rounded-2xl border border-hairline bg-surface p-4">
              <div className="font-display text-3xl font-bold text-ink-50">{n}</div>
              <div className="mt-1 font-mono text-[10px] uppercase tracking-widest text-ink-400">
                {label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ---- Evidence levels ---- */}
      <Block
        title={tr ? "Kanıt seviyeleri" : "Evidence levels"}
        intro={
          tr
            ? "Kayıtlı her iddia bir seviyeyle etiketlenir. Bu bir kalite sıralaması değil, kapsam etiketidir: okuyucunun 'kodu okuyup saydık' ile 'kendi metnimiz böyle diyor'u ayırt edebilmesi için."
            : "Every recorded claim is tagged with a level. Not a quality ranking — a scope label, so a reader can tell 'we read the code and counted' apart from 'our own copy says so'."
        }
      >
        <div className="space-y-3">
          {EVIDENCE_LEVELS.map((lvl) => (
            <div
              key={lvl.level}
              className="flex flex-col gap-2 rounded-2xl border border-hairline bg-surface p-5 sm:flex-row sm:items-baseline sm:gap-5"
            >
              <div className="flex shrink-0 items-baseline gap-3 sm:w-40">
                <span className="font-mono text-sm font-medium text-ink-100">{lvl.level}</span>
                <span className="text-[14px] text-ink-200">
                  {tr ? lvl.labelTr : lvl.labelEn}
                </span>
              </div>
              <div className="flex-1">
                <p className="text-[14.5px] leading-relaxed text-ink-300">
                  {tr ? lvl.meaningTr : lvl.meaningEn}
                </p>
              </div>
              <div className="shrink-0 font-mono text-[11px] text-ink-400">
                {counts[lvl.kind]} {tr ? "iddia" : "claims"}
              </div>
            </div>
          ))}
        </div>
      </Block>

      {/* ---- State machine ---- */}
      <Block
        title={tr ? "Ürün durum makinesi" : "Product state machine"}
        intro={
          tr
            ? `${lifecycleCount} durum var ve her biri mekanik olarak bir şeyi değiştirir. Hiçbir şeyi değiştirmeyen bir durum etikettir; onu burada aşama diye listelemek tam olarak kaçındığımız şey olurdu.`
            : `${lifecycleCount} states, each of which mechanically changes something. A state that changes nothing is a label — listing it here as a stage would be the theatre this page exists to avoid.`
        }
      >
        <div className="space-y-3">
          {lifecycles.map((row) => (
            <div key={row.key} className="rounded-2xl border border-hairline bg-surface p-5">
              <div className="flex items-baseline justify-between gap-4">
                <span className="font-display text-lg font-semibold text-ink-50">
                  {tr ? row.labelTr : row.labelEn}
                </span>
                <span className="font-mono text-[11px] text-ink-400">
                  {row.count} {tr ? "ürün" : "products"}
                </span>
              </div>
              <p className="mt-2 text-[14.5px] leading-relaxed text-ink-300">
                {tr ? row.effectTr : row.effectEn}
              </p>
            </div>
          ))}
        </div>
      </Block>

      {/* ---- Claim policy ---- */}
      <Block
        title={tr ? "İddia politikası" : "Public claim policy"}
        intro={
          tr
            ? "Kayıtlı iddiaların yapısı, bağlı istatistikler, ekran görüntüleri ve vaka çalışmaları otomatik kontrollerden geçer. Serbest tanıtım metinleri ayrıca gözden geçirilir."
            : "Recorded claims, linked statistics, screenshots and case studies have automated checks. Free-form promotional copy is reviewed separately."
        }
      >
        <RuleList
          items={
            tr
              ? [
                  "Yapısal eksik build'i düşürür: kaynağı, kapsamı, sahibi veya tarihi olmayan bir iddia yayına giremez.",
                  "Tarihler sıfır dolgulu olmak zorunda — tek eksik sıfır (2026-9-18) iddianın yıl dönene kadar hiç bayatlamamasına yol açardı.",
                  "Süre dolması build'i DÜŞÜRMEZ, sayfayı değiştirir: bayat iddia yanlış değil, doğrulanmamıştır — silinmez, 'yeniden doğrulama bekliyor' olarak gösterilir.",
                  "Bir istatistik kartı, bağlandığı iddianın metninde geçmeyen bir rakamı basamaz.",
                  "Yayınlanmamış ürün sahte ekran görüntüsü gösteremez; her ekran görüntüsü hangi build'den, hangi tarihte alındığını taşır.",
                  `Metin taraması, geçmişte yanlış çıkmış ${forbiddenCount} ifadeyi adıyla arar ve dönmelerini engeller.`,
                  "Vaka çalışması kapısı: izin, başlangıç, artefakt, ölçülmüş sonuç, başarısızlık dersi ve geçerlilik tarihi olmadan bir vaka yayınlanamaz.",
                ]
              : [
                  "A structural gap fails the build: a claim with no source, scope, owner or date cannot ship.",
                  "Dates must be zero-padded — one missing zero (2026-9-18) would keep a claim from ever expiring until the year turned.",
                  "Expiry does NOT fail the build, it changes the page: a lapsed claim is not false, it is unverified — never deleted, shown as awaiting re-verification.",
                  "A stat card may not print a figure the claim it links to does not contain.",
                  "An unreleased product may not show a fabricated screen; every screenshot carries the build it came from and the date it was taken.",
                  `A prose scan looks for ${forbiddenCount} statements that turned out false in the past, by name, and stops them coming back.`,
                  "The case-study gate: no permission, baseline, artifact, measured outcome, failure lesson and validity date — no case.",
                ]
          }
        />
      </Block>

      {/* ---- Privacy / security ---- */}
      <Block
        title={tr ? "Gizlilik ve güvenlik" : "Privacy and security"}
        intro={
          tr
            ? "İletişim formu, huni ölçümü ve e-posta gönderimi ayrı kontrollerle yönetilir. Toplanan veri türleri ve kullanım amaçları gizlilik sayfasında açıklanır."
            : "The contact form, funnel measurement and email delivery have separate controls. The privacy page describes the data categories and their purposes."
        }
      >
        <RuleList
          items={
            tr
              ? [
                  "Yeni iletişim başvuruları kapalıyken form uç noktası 503 döner. Daha önce kabul edilmiş bildirimlerin gönderimi ayrı posta yapılandırmasına ve kuyruk işinin çalışmasına bağlıdır; başvuru alımını kapatmak bekleyen postayı iptal etmez.",
                  "Rıza bir kutucuk değil, tarihli bildirim sürümüyle kendi kaydıdır — 'onayladı' bilgisi 'neye onayladı' sorusunu yanıtlayamaz.",
                  `Huni ölçümü serbest metin kabul etmez: alan değerleri kısıtlıdır ve sayfa yolundan sorgu dizesi çıkarılır. Ham kayıtlar için ${RAW_RETENTION_DAYS} günlük saklama süresi ve süresi dolan kayıtları temizleyen bir iş tanımlıdır; canlı silme işleminin tamamlandığı çalışma kaydıyla doğrulanır.`,
                  "Kişisel veri taleplerinde e-posta adresi doğrulanır. Adresin doğrulanması, erişim, düzeltme veya silme talebinin tamamlandığı anlamına gelmez.",
                  "Site, içerik kaynaklarını sınırlayan CSP ve başka sitelerde çerçevelenmeyi engelleyen başlıklarla yapılandırılmıştır. Genel sayfalarla e-posta doğrulama sayfası farklı CSP kuralları kullanır.",
                ]
              : [
                  "When new contact submissions are disabled, the form endpoint returns 503. Delivery of previously accepted notifications depends on separate mail configuration and execution of the queue worker; closing intake does not cancel pending mail.",
                  "Consent is not a checkbox but its own record, stamped with a dated notice version — knowing someone agreed cannot answer what they agreed to.",
                  `Funnel measurement refuses free text: field values are constrained and query strings are removed from page paths. Raw records have a ${RAW_RETENTION_DAYS}-day retention period and a job that removes expired records; completed deletion in production is confirmed through execution records.`,
                  "Data requests include email-address verification. Verifying the address does not mean that an access, correction or deletion request has been fulfilled.",
                  "The site is configured with a CSP that restricts content sources and headers that prevent other sites from framing it. General pages and the email-verification page use different CSP rules.",
                ]
          }
        />
      </Block>

      {/* ---- AI vs human ---- */}
      <Block
        title={tr ? "AI ile insan arasındaki sınır" : "The AI/human boundary"}
        intro={
          tr
            ? "Bu site büyük ölçüde AI oturumlarıyla yazılıyor. Sınır belirsiz bırakılmadı; risk sınıfına bağlı ve kurallı."
            : "This site is largely written by AI sessions. The boundary is not left vague — it is bound to a risk class."
        }
      >
        <RuleList
          items={
            tr
              ? [
                  "Kurucu kapısı: mağaza gönderimi, fiyat, gerçek para, hesap sahipliği, hukuk ve geri dönülmez kararlar yalnız insana aittir.",
                  "Güvenlik, ödeme, migration ve gizlilik sınıfı işlerde bağımsız bir inceleme zorunludur; kimse kendi işini onaylayamaz. Bu inceleme pratikte reddediyor da — kayıtta üst üste RED almış turlar var.",
                  "'Bitti' bir yüzde değildir: bir iş yalnız KABUL EDİLDİ durumuna geçtiğinde biter, o da kanıt satırı yazılmadan mümkün değil.",
                  "İnsan, cihaz veya takvim gerektiren adımlar DIŞ KAPI olarak kaydedilir; beklenen işlem ve tamamlandığını gösterecek kanıt açıkça belirtilir.",
                ]
              : [
                  "Founder gate: store submission, pricing, real money, account ownership, legal questions and irreversible decisions belong to a human only.",
                  "Security, payment, migration and privacy work requires an independent review before acceptance; nobody approves their own work. That review does reject in practice — the record contains rounds that were turned down more than once.",
                  "'Done' is not a percentage: work ends only when it reaches ACCEPTED, and it cannot get there without an evidence row.",
                  "Steps needing a person, a device or a calendar are recorded as EXTERNAL GATES, with the required action and completion evidence stated explicitly.",
                ]
          }
        />
      </Block>

      {/* ---- Limitations: the section that earns the page ---- */}
      <Block
        title={tr ? "Bugünkü kısıtlar" : "Current limitations"}
        intro={
          tr
            ? "Bu bölüm sayfanın bedelidir. Nasıl dürüst kaldığını anlatan bir sayfanın, şu an dürüst OLMAYAN yerlerini atlaması tam olarak engellemeye çalıştığı şey olurdu."
            : "This section is the price of the page. One that describes how we stay honest while omitting where we currently are not would be the exact failure it claims to prevent."
        }
      >
        <RuleList
          tone="warn"
          items={
            tr
              ? [
                  "Metin taraması her build'de koşuyor, ama depo-dışı hedefleri yalnız yerelde ve CI'da var — bu sayfayı sunan deploy taramanın daha dar bir sürümünü çalıştırıyor.",
                  "Vaka çalışması kendi rakamını yazmaz: kayıtlı bir iddianın doğrulanmış figürlerinden hangisini raporladığını söyler, ekranda gördüğünüz sayı kayıttan okunur. Aynı kural başlığı, ölçüm etiketini ve 'sonrasında ne değişti' bölümünü de kapsar — çünkü bunlar iddia gibi okunur. Başlangıç durumu, kısıt, karar özetleri, artefakt etiketleri, izin kapsamı ve başarısızlık dersi serbest metindir; oralarda rakam olağandır. Bilinen sınır: 'Doğruluk-95' gibi tanımlayıcı biçimli bir dize etiket olarak kabul edilir.",
                  `Ürün detay sayfası mağaza ve erişim yüzeylerinin doğrulama tarihini kullanır; süresi dolan erişim iddiası yeniden doğrulama uyarısıyla gösterilir. Kayıttaki ${lapsed} yüzeyin doğrulama penceresi kapanmıştır. Bu kontrol bütün tanıtım metinlerini kapsamaz.`,
                  "Bağlantı erişilebilirliği CI'da engelleyici değil: bozuk bir mağaza adresi uyarı üretir, boru hattını düşürmez.",
                  "CI; lint, tip denetimi, test, build ve bağımlılık kontrollerini içerir. Sonuçlar ilgili değişiklik ve çalıştırma kaydıyla değerlendirilir; yerel kontroller üretim yayını anlamına gelmez.",
                  "Varsayılan dağıtım yapılandırmasında posta işi günde bir kez zamanlanır. Bu bir teslim süresi taahhüdü değildir; gönderim posta yapılandırmasına, sağlayıcıya ve işin başarıyla çalışmasına bağlıdır.",
                ]
              : [
                  "The prose scan runs on every build, but its cross-repository targets exist only locally and in CI — the deploy that serves this page runs a narrower version of it.",
                  "A case study does not supply its own number: it names which of a registry claim's verified figures it reports, and the numeral you see is read from the registry. The same rule covers the title, the metric label and the 'what changed after' section, because those read as claims. Baseline, constraint, decision summaries, artifact labels, the permission scope and the failure lesson stay free prose — a number is ordinary there. The known edge: an identifier-shaped string such as 'Accuracy-95' is accepted as a label.",
                  `Product detail pages use verification dates for store and availability surfaces; expired availability assertions show a re-verification notice. Verification windows have closed for ${lapsed} recorded surfaces. This check does not cover every piece of promotional copy.`,
                  "Link reachability is not blocking in CI: a dead store URL raises a warning, it does not fail the pipeline.",
                  "CI includes lint, type checking, tests, a build and dependency checks. Results are assessed against the relevant change and run record; local checks do not establish a production release.",
                  "The default deployment configuration schedules the mail job once a day. This is not a delivery-time commitment; sending depends on mail configuration, the provider and successful job execution.",
                ]
          }
        />
        <p className="mt-6 text-[14px] leading-relaxed text-ink-400">
          {tr ? "İlgili: " : "Related: "}
          <Link href="/transparency" className="link-wipe text-ink-200">
            {tr ? "ürün şeffaflığı" : "product transparency"}
          </Link>
          {" · "}
          <Link href="/case-studies" className="link-wipe text-ink-200">
            {tr ? "vaka çalışmaları" : "case studies"}
          </Link>
        </p>
      </Block>
    </div>
  );
}

function Block({
  title,
  intro,
  children,
}: {
  title: string;
  intro: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mx-auto max-w-3xl px-6 pb-14 lg:px-10">
      <h2 className="font-display text-2xl font-semibold tracking-tight text-ink-50">{title}</h2>
      <p className="mt-3 max-w-[58ch] text-[15px] leading-[1.65] text-ink-300">{intro}</p>
      <div className="mt-6">{children}</div>
    </section>
  );
}

function RuleList({ items, tone }: { items: string[]; tone?: "warn" }) {
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li
          key={item}
          className={`flex gap-3 rounded-2xl border p-4 text-[14.5px] leading-relaxed ${
            tone === "warn"
              ? "border-hairline bg-surface-inset text-ink-300"
              : "border-hairline bg-surface text-ink-300"
          }`}
        >
          <span aria-hidden className={tone === "warn" ? "text-ink-400" : "text-ink-500"}>
            {tone === "warn" ? "!" : "—"}
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
