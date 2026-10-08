import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ArrowUpRight } from "@/components/common/icons";
import { EyebrowChip } from "@/components/common/EyebrowChip";
import { projects } from "@/data/projects";
import { GlassSheen } from "@/components/common/GlassSheen";
import { leadsEnabled } from "@/server/lead-surface";
import { CURRENT_NOTICE_VERSION } from "@/lib/consent";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const isTR = locale === "tr";
  return {
    title: isTR ? "Gizlilik" : "Privacy",
    description: isTR
      ? "Braavolabs, Burun Farkı ve LifeOS için gizlilik politikalarımız."
      : "Privacy policies for Braavolabs, Burun Farkı and LifeOS.",
    alternates: {
      canonical: isTR ? "/privacy" : `/${locale}/privacy`,
    },
  };
}

export default async function PrivacyIndexPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  // The form's own switch, not a sentence written once. See below.
  return <PrivacyIndex formOpen={leadsEnabled()} />;
}

// Only products with a dedicated /privacy/<slug> route belong here — a
// "coming-soon" product is covered separately by development scope, so
// linking to a policy page that doesn't exist would be a dead link. Filter
// stays semantic (not a slug allow-list) so a future product automatically
// joins this index the moment it ships its own policy page and status.
const projectsWithPrivacyPolicy = projects.filter((p) => p.status !== "coming-soon");

function PrivacyIndex({ formOpen }: { formOpen: boolean }) {
  const locale = useLocale();
  const isTR = locale === "tr";

  return (
    <div className="page-enter relative">
      <GlassSheen />
      <div className="ambient" aria-hidden />
      <section className="relative pt-32 pb-16 lg:pt-40">
        <div className="max-w-4xl mx-auto px-6 lg:px-10">
          <EyebrowChip>{isTR ? "Gizlilik" : "Privacy"}</EyebrowChip>

          <h1 className="mt-7 font-display font-extrabold text-ink-50 leading-[0.96] tracking-tightest text-[44px] sm:text-[56px] md:text-[64px]">
            {isTR ? "Verinize saygı duyuyoruz." : "We respect your data."}
          </h1>

          <p className="mt-4 font-mono text-[11px] tracking-widest uppercase text-ink-400">
            {isTR ? "Bildirim sürümü" : "Notice version"}: {CURRENT_NOTICE_VERSION}
          </p>

          <p className="mt-7 max-w-[52ch] text-[16.5px] md:text-[17.5px] leading-[1.6] text-ink-300">
            {isTR
              ? "Verilerin işlenme biçimi ürüne ve sürüme göre değişir. İlgili ürünün gizlilik bilgilerini aşağıdan açabilir; erişim, düzeltme veya silme sorularınız için bizimle iletişime geçebilirsiniz."
              : "Data handling varies by product and version. Open the relevant privacy information below, or contact us with questions about access, correction or deletion."}
          </p>

          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-4">
            {projectsWithPrivacyPolicy.map((p) => (
              <Link
                key={p.slug}
                href={`/privacy/${p.slug}`}
                className="glass group block p-6 transition-colors focusable"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] tracking-widest uppercase text-ink-400">
                    {p.slug}
                  </span>
                  <ArrowUpRight
                    size={14}
                    strokeWidth={2}
                    className="arrow-nudge text-ink-400 group-hover:text-ink-100"
                  />
                </div>
                <div className="mt-6 font-display font-bold text-[22px] text-ink-50">
                  {p.name}
                </div>
                <div className="mt-2 text-sm text-ink-300 leading-relaxed">
                  {isTR ? "Politikayı oku →" : "Read the policy →"}
                </div>
              </Link>
            ))}

            {/* Motion family scope; app-specific data flows require their own policy details. */}
            <Link
              href="/privacy/motion"
              className="glass group block p-6 transition-colors focusable"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] tracking-widest uppercase text-ink-400">
                  motion
                </span>
                <ArrowUpRight
                  size={14}
                  strokeWidth={2}
                  className="arrow-nudge text-ink-400 group-hover:text-ink-100"
                />
              </div>
              <div className="mt-6 font-display font-bold text-[22px] text-ink-50">
                {isTR ? "Motion uygulamaları" : "Motion apps"}
              </div>
              <div className="mt-2 text-sm text-ink-300 leading-relaxed">
                {isTR
                  ? "Choreia · Lissom · Gravita · JabLab · Ostinato — gizlilik kapsamı →"
                  : "Choreia · Lissom · Gravita · JabLab · Ostinato — privacy scope →"}
              </div>
            </Link>
          </div>

          {/* This site's OWN measurement, as distinct from the products'.
              Written from the code rather than from a template: every field
              named below is a field that actually exists in
              src/lib/analytics/events.ts, and every field absent from that
              contract is named here as absent. Two separate streams are
              described separately on purpose — summing an aggregate
              page-view provider with a first-party funnel would double-count
              the same visit. */}
          <div className="mt-16 pt-10 border-t border-white/10">
            <div className="font-mono text-[11px] tracking-widest uppercase text-ink-400 mb-3">
              {isTR ? "Bu sitenin kendi ölçümü" : "This site's own measurement"}
            </div>
            <p className="text-[15px] leading-[1.65] text-ink-200 max-w-[60ch]">
              {isTR
                ? "Bu bölüm hem yulalab.com'u hem links.yulalab.com'u kapsar. yulalab.com'da Vercel Analytics yalnızca Vercel barındırma yapılandırmasında yüklenir; diğer barındırma ortamlarında yüklenmez. Etkin olduğunda sayfa görüntülemelerini toplu olarak sayar; çerez kullanmaz ve ziyaretçileri siteler arasında izlemez. links.yulalab.com'da bu araç yoktur."
                : "This section covers both yulalab.com and links.yulalab.com. On yulalab.com, Vercel Analytics loads only in the Vercel hosting configuration; it does not load in other hosting environments. When enabled, it counts page views in aggregate, sets no cookies, and does not track visitors across sites. It does not run on links.yulalab.com."}
            </p>
            <p className="mt-4 text-[15px] leading-[1.65] text-ink-200 max-w-[60ch]">
              {isTR
                ? "Buna ek olarak, hangi ürün sayfasının kaç kişiyi ürünün kendi mağazasına ya da sitesine gönderdiğini ölçen kendi huni kaydımızı yazdık — her iki site de aynı kaydı kullanır. Huni kaydı yapılandırmaya bağlıdır. Etkin olduğu akışta saklanan alanlar şunlardır: olay adı (sabit bir listeden), olay sürüm numarası, ürün kısa adı, dil, sorgu dizesi olmadan sayfa yolu, varsa kampanya etiketleri (utm_source/medium/campaign/content), tıklanan dış bağlantının adresi (sorgu dizesi ve çapa kaldırılmış hâliyle), o bağlantının sınıfı (mağaza / web / site-içi) ve zaman damgası. Her kaydın ayrıca oturum takma adı, rastgele bir kayıt numarası ve saklama süresinin sona erdiği tarih bulunur. Bu listenin dışında hiçbir şey saklanmaz."
                : "On top of that we have written our own funnel record, measuring how many people a product page sends on to that product's own store or site; both sites use the same record. Funnel recording depends on configuration. In the enabled flow, the recorded fields are: event name (from a fixed list), event version number, product short name, language, page path without any query string, campaign tags if present (utm_source/medium/campaign/content), the address of the outbound link clicked (with its query string and fragment removed), that link's class (store / web / internal), and a timestamp. Each record also carries a session pseudonym, a random record identifier and the retention expiry date. Nothing outside that list is stored."}
            </p>
            <p className="mt-4 text-[15px] leading-[1.65] text-ink-200 max-w-[60ch]">
              {isTR
                ? "Bu kayıt IP adresi veya tarayıcı kimliğini saklamaz; ad, e-posta, mesaj ya da ürün içi veri alanı istemez. Alan listesi ve kabul edilen biçimler uygulamada ve veritabanında sınırlandırılır. Kampanya etiketlerine veya sayfa yollarına kişisel bilgi eklenmemelidir. Ziyaretçiyi tanımlayan tek değer, sekmeniz kapanınca silinen rastgele bir jetondan türetilen ve her gün yenilenen takma addır; geriye çevrilemez ve iki farklı günü birbirine bağlamaz. Ham kayıtlar için 30 günlük saklama süresi tanımlıdır; süresi dolan kayıtlar yetkili temizlik işi çalıştığında silinir."
                : "This record does not store IP addresses or browser fingerprints and does not request fields for names, email addresses, messages or in-product data. Field names and accepted formats are constrained in the application and database. Campaign tags and page paths must not contain personal information. The only value identifying a visitor is a pseudonym derived from a random token that is erased when your tab closes, re-derived daily; it is not reversible and does not link two different days together. Raw records have a 30-day retention period; expired records are removed when the authorized cleanup job runs."}
            </p>
          </div>

          {/* Contact data. Written from the schema, column by column — every
              field named here exists in db/migrations/0002, and every column
              that migration creates is named here. tests/privacy-lead-anchor
              fails if the two drift. This section had to exist BEFORE
              LEADS_ENABLED could ever be set: the page described the funnel
              record in detail and said nothing at all about contact data. */}
          <div className="mt-16 pt-10 border-t border-white/10">
            <div className="font-mono text-[11px] tracking-widest uppercase text-ink-300 mb-3">
              {isTR ? "Bize yazdığınızda" : "When you write to us"}
            </div>
            {/* Which of these two sentences is true is decided by the SAME
                switch that renders the form, not by remembering to edit a
                paragraph. "There is no contact form" is a statement in a
                privacy notice; leaving it written down means it survives the
                day a form appears, and a notice that describes a site other
                than the one in front of you is worse than no notice. */}
            <p className="text-[15px] leading-[1.65] text-ink-200 max-w-[60ch]">
              {formOpen
                ? isTR
                  ? "Sitede bir iletişim formu var ve gönderdiğiniz bilgiler aşağıda anlatılan kayda girer. İletişim sayfasındaki e-posta adresi de çalışmaya devam eder; o adrese yazdığınızda mesajınız sıradan bir e-posta olarak gelir ve bu veritabanına girmez."
                  : "There is a contact form on the site, and what you send through it enters the record described below. The email address on the contact page keeps working too; writing to it means an ordinary email that never enters this database."
                : isTR
                  ? "Şu an sitede bir iletişim formu YOK: iletişim sayfası doğrudan e-posta adresimizi gösterir, yani bize yazdığınızda mesajınız sıradan bir e-posta olarak gelir ve bu sitenin bir veritabanına girmez. Aşağıdaki bölüm, form açıldığında ne olacağını önceden anlatır — açılmadan yazılmıştır, çünkü toplamaya başladıktan sonra anlatmak geç olurdu."
                  : "There is no contact form on the site today: the contact page shows our email address directly, so writing to us means an ordinary email that never enters a database here. The section below describes what will happen when a form does open — written before it opens, because describing it afterwards would be too late."}
              {" "}
              <Link href="/contact" className="underline underline-offset-4 focusable">
                {isTR ? "İletişim sayfasına git." : "Go to the contact page."}
              </Link>
            </p>
            <p className="mt-4 text-[15px] leading-[1.65] text-ink-200 max-w-[60ch]">
              {isTR
                ? formOpen
                  ? "Saklanan alanların tam listesi şudur: adınız, e-posta adresiniz, isterseniz şirket adınız, hangi konuda yazdığınız (ürün, birlikte çalışma, ortaklık, basın, veri talebi), ürün konusuysa hangi ürün, mesajınızın kendisi, sayfanın dili, talebin bizdeki durumu, kaydın oluşturulma tarihi, saklama süresinin sona erdiği tarih, rastgele bir kayıt numarası ve aynı mesajı iki kez göndermenizin iki kayıt oluşturmasını engelleyen bir eşleştirme değeri."
                  : "Form açıldığında saklanacak alanların tam listesi şudur: adınız, e-posta adresiniz, isterseniz şirket adınız, hangi konuda yazdığınız (ürün, birlikte çalışma, ortaklık, basın, veri talebi), ürün konusuysa hangi ürün, mesajınızın kendisi, sayfanın dili, talebin bizdeki durumu, kaydın oluşturulma tarihi, saklama süresinin sona erdiği tarih, rastgele bir kayıt numarası ve aynı mesajı iki kez göndermenizin iki kayıt oluşturmasını engelleyen bir eşleştirme değeri."
                : formOpen
                  ? "The complete list of what is stored is: your name, your email address, your company if you choose to give one, what you are writing about (product, working together, partnership, press, or a data request), which product if it is about one, your message itself, the page language, the status of the request on our side, the date the record was created, the retention expiry date, a random record identifier, and a matching value that stops sending the same message twice from creating two records."
                  : "When a form does open, the complete list of what is stored is: your name, your email address, your company if you choose to give one, what you are writing about (product, working together, partnership, press, or a data request), which product if it is about one, your message itself, the page language, the status of the request on our side, the date the record was created, the retention expiry date, a random record identifier, and a matching value that stops sending the same message twice from creating two records."}
            </p>
            <p className="mt-4 text-[15px] leading-[1.65] text-ink-200 max-w-[60ch]">
              {isTR
                ? "Rızanız ayrı bir kayıt olarak tutulur: hangi tarihli bildirim metnini kabul ettiğiniz, ne zaman kabul ettiğiniz ve hukuki dayanağı. Bunu bir 'onayladı' kutucuğu yerine böyle saklıyoruz çünkü kutucuk 'neye onay verdiniz' sorusunu yanıtlayamaz — sonradan bu sayfayı düzenlemek, gerçekte kabul ettiğiniz şeyi geriye dönük yeniden tarif ederdi."
                : "Your consent is kept as its own record: which dated version of the notice you accepted, when you accepted it, and the lawful basis. We store it this way rather than as a 'consented' checkbox because a checkbox cannot answer what you consented TO — editing this page later would retroactively re-describe what you actually agreed to."}
            </p>
            <p className="mt-4 text-[15px] leading-[1.65] text-ink-200 max-w-[60ch]">
              {isTR
                ? "Size makbuz göndermek ve mesajınızı doğru kişiye yönlendirmek için ayrı bir gönderim kuyruğu kullanılır. O kuyruk mesajınızın metnini TAŞIMAZ — kayıt numarası, dil, hangi konu olduğu ve nereye yönlendirileceği bulunur. Kuyruk kayıtları için 30, iletişim kayıtları için 180 günlük saklama süresi tanımlıdır; ilgili tarih her kayıtta tutulur. Teslim edilen bildirimlerin saklama tarihi, teslimatın ardından en az 24 saat kalacak şekilde uzatılabilir. Süresi dolan kayıtlar yetkili temizlik işi çalıştığında silinir."
                : "A separate delivery queue is used to send you a receipt and route your message to the right person. That queue does NOT carry the text of your message — it carries the record number, language, what the enquiry is about, and where it should go. The retention period is 30 days for queue records and 180 days for contact records; the relevant date is stored on each record. Delivered notifications may have their retention date extended to allow at least 24 hours after delivery. Expired records are removed when the authorized cleanup job runs."}
            </p>
          </div>

          <div className="mt-16 pt-10 border-t border-white/10">
            <div className="font-mono text-[11px] tracking-widest uppercase text-ink-300 mb-3">
              {isTR ? "Ortak Çerçeve" : "Shared Framework"}
            </div>
            <p className="text-[15px] leading-[1.65] text-ink-200 max-w-[60ch]">
              {isTR
                ? "Veri kategorileri, üçüncü taraflar, saklama süreleri ve hak taleplerinin kapsamı ilgili ürünün gizlilik bilgilerinde ele alınır. Motion sayfası geliştirme aşamasındaki ürünler için genel kapsam bilgisidir; uygulama ve sürüme özgü ayrıntılar için bizimle iletişime geçebilirsiniz."
                : "Data categories, third parties, retention periods and the scope of rights requests are addressed in the relevant product privacy information. The Motion page provides general scope information for products in development; contact us for app- and version-specific details."}
            </p>
            <div className="mt-6">
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 text-sm text-ink-200 hover:text-ink-50 link-wipe"
              >
                {isTR ? "Veri talebi veya soru için iletişim" : "Contact us for data requests or questions"}
                <ArrowUpRight size={14} strokeWidth={2} className="arrow-nudge" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
