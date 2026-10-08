import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { EyebrowChip } from "@/components/common/EyebrowChip";

const LAST_UPDATED = "2026-09-06";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const isTR = locale === "tr";
  return {
    title: isTR ? "Gizlilik · Burun Farkı" : "Privacy · Burun Farkı",
    description: isTR
      ? "Burun Farkı uygulaması için gizlilik politikası."
      : "Privacy policy for the Burun Farkı application.",
    alternates: {
      canonical: isTR ? "/privacy/burunfarki" : `/${locale}/privacy/burunfarki`,
    },
  };
}

export default async function BurunfarkiPrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <BurunfarkiPrivacy />;
}

function BurunfarkiPrivacy() {
  const locale = useLocale();
  const isTR = locale === "tr";

  return (
    <div className="page-enter">
      <section className="relative pt-32 pb-16 lg:pt-40">
        <div className="max-w-3xl mx-auto px-6 lg:px-10">
          <Link
            href="/privacy"
            className="font-mono text-[11px] tracking-widest uppercase text-ink-400 hover:text-ink-200 link-wipe"
          >
            ← {isTR ? "Gizlilik" : "Privacy"}
          </Link>

          <div className="mt-6">
            <EyebrowChip>Burun Farkı</EyebrowChip>
          </div>

          <h1 className="mt-6 font-display font-extrabold text-ink-50 leading-[0.96] tracking-tightest text-[40px] sm:text-[52px] md:text-[60px]">
            {isTR ? "Burun Farkı gizlilik politikası" : "Burun Farkı privacy policy"}
          </h1>

          <div className="mt-4 font-mono text-[11px] tracking-widest uppercase text-ink-400">
            {isTR ? "Son güncelleme" : "Last updated"}: {LAST_UPDATED}
          </div>

          <div className="mt-10 text-[15.5px] leading-[1.75] text-ink-200 space-y-8">
            <Section title={isTR ? "Önemli uyarı" : "Important notice"}>
              <p>
                {isTR
                  ? "Burun Farkı (com.yulalab.burunfarki), at yarışı verisi ve makine öğrenmesi destekli analiz sunan bir uygulamadır. Bahis platformu DEĞİLDİR; herhangi bir bahis sitesine link içermez ve gerçek-parayla bahis işlemi yapmaz. Uygulama yalnızca istatistiksel analiz ve eğitim amaçlıdır."
                  : "Burun Farkı (com.yulalab.burunfarki) is an application offering horse racing data and machine learning-based analysis. It is NOT a gambling platform; it contains no links to betting sites and does not process any real-money wagers. The app is intended for statistical analysis and educational purposes only."}
              </p>
            </Section>

            <Section title={isTR ? "Topladığımız veriler" : "Data we collect"}>
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  <strong className="text-ink-100">{isTR ? "Hesap bilgileri" : "Account information"}</strong>:
                  {" "}{isTR
                    ? "E-posta, ad, profil tercihleri. Supabase Auth ile yönetilir; parolalar Supabase tarafından bcrypt ile hashlenir."
                    : "Email, name, profile preferences. Managed via Supabase Auth; passwords are bcrypt-hashed by Supabase."}
                </li>
                <li>
                  <strong className="text-ink-100">{isTR ? "Uygulama kullanım verileri" : "Application usage data"}</strong>:
                  {" "}{isTR
                    ? "Hangi yarışları görüntülediğiniz, takip ettiğiniz atlar, oluşturduğunuz kupon analizleri (kupon = sizin kendi tahminiz, gerçek bahis değildir)."
                    : "Which races you viewed, horses you follow, coupon analyses you created (a coupon = your own prediction draft, not a real wager)."}
                </li>
                <li>
                  <strong className="text-ink-100">{isTR ? "Çökme raporları" : "Crash reports"}</strong>:
                  {" "}{isTR
                    ? "Sentry üzerinden anonim çökme yığın izleri."
                    : "Anonymous crash stack traces via Sentry."}
                </li>
                <li>
                  <strong className="text-ink-100">{isTR ? "Satın alma bilgileri" : "Purchase information"}</strong>:
                  {" "}{isTR
                    ? "Apple App Store ve Google Play üzerinden ödeme alınır. Biz yalnızca abonelik seviyenizi (Starter / Analiz / Pro) ve makbuz doğrulama yanıtını görürüz."
                    : "Payments are processed via Apple App Store and Google Play. We only see your subscription tier (Starter / Analiz / Pro) and the receipt verification response."}
                </li>
                <li>
                  <strong className="text-ink-100">{isTR ? "Çerezler" : "Cookies"}</strong>:
                  {" "}{isTR
                    ? "Mobil uygulama çerez kullanmaz; oturum tokenları cihazın güvenli depolaması (Keychain / Keystore) içinde tutulur."
                    : "The mobile app uses no cookies; session tokens are stored in the device's secure storage (Keychain / Keystore)."}
                </li>
              </ul>
            </Section>

            <Section title={isTR ? "Veriniz nasıl kullanılır" : "How your data is used"}>
              <ul className="list-disc pl-5 space-y-2">
                <li>{isTR ? "Size yarış programını, AI tahminlerini ve istatistikleri sunmak için." : "To deliver race programs, AI predictions, and statistics to you."}</li>
                <li>{isTR ? "Takip ettiğiniz atlar için bildirim göndermek için." : "To send notifications for horses you follow."}</li>
                <li>{isTR ? "Modelin doğruluğunu ölçmek ve geliştirmek için (kullanıcı verisi anonim olarak agregate edilir)." : "To measure and improve model accuracy (user data is aggregated anonymously)."}</li>
              </ul>
              <p className="mt-4">
                {isTR
                  ? "Verinizi reklamcılık veya üçüncü taraflara satış için ASLA kullanmıyoruz."
                  : "We NEVER use your data for advertising or sale to third parties."}
              </p>
            </Section>

            <Section title={isTR ? "Üçüncü taraflar" : "Third parties"}>
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  <strong className="text-ink-100">Supabase</strong>:
                  {" "}{isTR ? "Kimlik doğrulama, veritabanı ve edge functions. Veritabanı projesinin bölgesi İrlanda'dır (AB, eu-west-1)." : "Authentication, database and edge functions. The database project's region is Ireland (EU, eu-west-1)."}
                </li>
                <li>
                  <strong className="text-ink-100">Apple App Store / Google Play</strong>:
                  {" "}{isTR ? "Abonelik ödemesi ve makbuz doğrulama." : "Subscription payments and receipt validation."}
                </li>
                <li>
                  <strong className="text-ink-100">Sentry</strong>:
                  {" "}{isTR ? "Anonim çökme raporlaması." : "Anonymous crash reporting."}
                </li>
                <li>
                  <strong className="text-ink-100">TJK (Türkiye Jokey Kulübü)</strong>:
                  {" "}{isTR ? "Yarış verisi kaynağı (sadece kamuya açık veri). Kullanıcı verisi TJK ile paylaşılmaz." : "Race data source (public data only). No user data is shared with TJK."}
                </li>
              </ul>
            </Section>

            <Section title={isTR ? "Veri saklama" : "Data retention"}>
              <p>
                {isTR
                  ? "Hesap silme akışı hesap, profil, kupon ve ilişkili abonelik kayıtlarını kapsar. Sağlayıcı günlükleri, yedekler ve saklama yükümlülüğü bulunan kayıtlar ayrıca değerlendirilir. Bu kayıtların saklama süresi ve silme talebinin kapsamı için support@yulalab.com adresine yazabilirsiniz."
                  : "The account deletion flow covers account, profile, coupon and associated subscription records. Provider logs, backups and records subject to retention obligations are assessed separately. Contact support@yulalab.com for the retention period of these records and the scope of a deletion request."}
              </p>
            </Section>

            <Section title={isTR ? "Yaş sınırı" : "Age restriction"}>
              <p>
                {isTR
                  ? "Yarış analizi içeriği nedeniyle Burun Farkı 18 yaş ve üstü kullanıcılar içindir. Bahis hizmetimiz olmamasına rağmen, içerik gambling-adjacent kabul edildiği için yaş duvarı uygularız."
                  : "Because of the racing analysis content, Burun Farkı is for users 18 and over. Although we do not offer betting, the content is considered gambling-adjacent and we enforce an age gate."}
              </p>
            </Section>

            <Section title={isTR ? "Haklarınız" : "Your rights"}>
              <p>
                {isTR
                  ? "KVKK Madde 11 ve GDPR Madde 15-22 kapsamında erişim, düzeltme, silme, taşıma ve itiraz haklarına sahipsiniz. Talepleri support@yulalab.com adresine gönderebilirsiniz; 30 gün içinde yanıtlanır."
                  : "Under KVKK Article 11 and GDPR Articles 15-22 you have rights of access, correction, deletion, portability, and objection. Send requests to support@yulalab.com; we respond within 30 days."}
              </p>
            </Section>

            <Section title={isTR ? "Veri güvenliği" : "Data security"}>
              <p>
                {isTR
                  ? "İletişim TLS 1.2+ üzerindendir. Supabase Row-Level Security kullanılır — kullanıcılar yalnızca kendi verilerini görür. Mobil app oturum tokenları cihaz Keychain/Keystore içinde tutulur."
                  : "Communication uses TLS 1.2+. Supabase Row-Level Security is enforced — users see only their own data. Mobile session tokens are stored in the device Keychain/Keystore."}
              </p>
            </Section>

            <Section title={isTR ? "Değişiklikler" : "Changes"}>
              <p>
                {isTR
                  ? "Bu politikayı zaman zaman güncelleyebiliriz. Önemli değişiklikler uygulama içinden bildirilir ve 'Son güncelleme' tarihi değişir."
                  : "We may update this policy from time to time. Significant changes will be announced in-app and the 'Last updated' date will change."}
              </p>
            </Section>

            <Section title={isTR ? "İletişim" : "Contact"}>
              <p>
                {isTR ? "Veri Sorumlusu" : "Data Controller"}: YULA Lab — Mustafa Kaan Koçak<br />
                {isTR ? "E-posta" : "Email"}: <a href="mailto:support@yulalab.com" className="link-wipe text-ink-50">support@yulalab.com</a><br />
                {isTR ? "Konum" : "Location"}: Türkiye
              </p>
            </Section>
          </div>
        </div>
      </section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-display font-bold text-ink-50 text-[22px] md:text-[24px] mb-3">
        {title}
      </h2>
      <div>{children}</div>
    </section>
  );
}
