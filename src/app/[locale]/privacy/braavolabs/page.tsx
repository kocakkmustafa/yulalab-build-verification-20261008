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
    title: isTR ? "Gizlilik · Braavolabs" : "Privacy · Braavolabs",
    description: isTR
      ? "Braavolabs uygulaması için gizlilik politikası."
      : "Privacy policy for the Braavolabs application.",
    alternates: {
      canonical: isTR ? "/privacy/braavolabs" : `/${locale}/privacy/braavolabs`,
    },
  };
}

export default async function BraavolabsPrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <BraavolabsPrivacy />;
}

function BraavolabsPrivacy() {
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
            <EyebrowChip>Braavolabs</EyebrowChip>
          </div>

          <h1 className="mt-6 font-display font-extrabold text-ink-50 leading-[0.96] tracking-tightest text-[40px] sm:text-[52px] md:text-[60px]">
            {isTR ? "Braavolabs gizlilik politikası" : "Braavolabs privacy policy"}
          </h1>

          <div className="mt-4 font-mono text-[11px] tracking-widest uppercase text-ink-400">
            {isTR ? "Son güncelleme" : "Last updated"}: {LAST_UPDATED}
          </div>

          <div className="prose-yula mt-10 text-[15.5px] leading-[1.75] text-ink-200 space-y-8">
            <Section title={isTR ? "Özet" : "Summary"}>
              <p>
                {isTR
                  ? "Braavolabs (com.braavolabs.mobile), otonom AI iş akışlarınızı izlemenize ve insan-onay-döngüsünde tutmanıza yardım eden mobil bir uygulamadır. Uygulamayı kullanırken yalnızca işlevsellik için gereken minimum veriyi topluyoruz; verinizi reklam veya model eğitimi için kullanmıyoruz."
                  : "Braavolabs (com.braavolabs.mobile) is a mobile app that helps you monitor your autonomous AI workflows with a human-in-the-loop. We collect only the minimum data needed for the app to function; we never use your data for advertising or model training."}
              </p>
            </Section>

            <Section title={isTR ? "Topladığımız veriler" : "Data we collect"}>
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  <strong className="text-ink-100">{isTR ? "Hesap bilgileri" : "Account information"}</strong>:
                  {" "}{isTR
                    ? "E-posta, ad, hashlanmış parola (Argon2id). Üçüncü taraf sağlayıcılarla SSO seçtiğinizde sağlayıcının kimlik tokenı alınır."
                    : "Email, name, hashed password (Argon2id). If you sign in via a third-party SSO provider, we receive that provider's identity token."}
                </li>
                <li>
                  <strong className="text-ink-100">{isTR ? "Uygulama kullanım verileri" : "Application usage data"}</strong>:
                  {" "}{isTR
                    ? "Oluşturduğunuz workflow'lar, run sonuçları, onay kararları ve entegrasyon yapılandırmaları çalışma alanınıza aittir. Ortak bir çalışma alanında başka üyeler de bulunabilir; bu içerikler yalnızca size ait kişisel kayıtlar olarak değerlendirilmemelidir."
                    : "Workflows you create, run results, approval decisions and integration configurations belong to your workspace. A shared workspace may have other members; this content should not be treated as personal records belonging only to you."}
                </li>
                <li>
                  <strong className="text-ink-100">{isTR ? "Cihaz tanımlayıcıları" : "Device identifiers"}</strong>:
                  {" "}{isTR
                    ? "Push bildirimi göndermek için Expo Push tokenı. Reklam ID'si toplanmaz."
                    : "Expo Push token for sending notifications. We do not collect advertising IDs."}
                </li>
                <li>
                  <strong className="text-ink-100">{isTR ? "Çökme raporları" : "Crash reports"}</strong>:
                  {" "}{isTR
                    ? "Anonim çökme yığın izleri (Sentry). Kişiyi tanımlayan bilgi içermez."
                    : "Anonymous crash stack traces via Sentry. No personally identifying information is attached."}
                </li>
                <li>
                  <strong className="text-ink-100">{isTR ? "Satın alma bilgileri" : "Purchase information"}</strong>:
                  {" "}{isTR
                    ? "Apple App Store ve Google Play, ödemeyi sizden alır; biz yalnızca abonelik durumunu (aktif/pasif/seviye) ve makbuzun doğrulama bilgisini görüyoruz."
                    : "Apple App Store and Google Play receive your payment; we only see the subscription status (active/inactive/tier) and the receipt verification data."}
                </li>
              </ul>
            </Section>

            <Section title={isTR ? "Üçüncü taraflar" : "Third parties"}>
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  <strong className="text-ink-100">Apple App Store / Google Play</strong>:
                  {" "}{isTR
                    ? "Yalnızca abonelik ödemelerini işler. Makbuzu doğrulamak için Apple App Store Server API ve Google Play Developer API kullanılır."
                    : "Processes subscription payments. We use Apple's App Store Server API and Google Play Developer API to validate receipts."}
                </li>
                <li>
                  <strong className="text-ink-100">Sentry</strong>:
                  {" "}{isTR
                    ? "Çökme raporlaması (anonim). DSN üzerinden yalnızca uygulama tarafından oluşturulmuş hata bilgisi gider."
                    : "Crash reporting (anonymous). Only application-generated error data is sent via the DSN."}
                </li>
                <li>
                  <strong className="text-ink-100">Expo / EAS Push</strong>:
                  {" "}{isTR
                    ? "Bildirim teslimatı için push tokenı saklanır."
                    : "Stores push tokens for notification delivery."}
                </li>
                <li>
                  <strong className="text-ink-100">{isTR ? "Sizin yapılandırdığınız entegrasyonlar" : "Integrations you configure"}</strong>:
                  {" "}{isTR
                    ? "Slack, GitHub, vs. — bu entegrasyonların gizlilik politikaları bağımsızdır. Token'larınız şifrelenmiş olarak hesabınızda saklanır."
                    : "Slack, GitHub, etc. — their privacy policies are independent. Your tokens are stored encrypted in your account."}
                </li>
              </ul>
            </Section>

            <Section title={isTR ? "Veri saklama" : "Data retention"}>
              <p>
                {isTR
                  ? "Hesap silme, kullanıcı kaydınızı kaldırır. Çalışma alanının son üyesiyseniz çalışma alanı kayıtları da silinir; başka üyeler varsa çalışma alanı içeriği, etkinlik ve mağaza abonelik kayıtları o çalışma alanında kalır. Silme kapsamı ve geçerli saklama yükümlülükleri doğrulanmış talebiniz için açıklanır. Aboneliği iptal etmek ayrı bir işlemdir."
                  : "Account deletion removes your user record. If you are the workspace's last member, workspace records are also deleted; if other members remain, workspace content, activity and store subscription records remain with that workspace. The deletion scope and applicable retention obligations are explained for your verified request. Subscription cancellation is a separate action."}
              </p>
            </Section>

            <Section title={isTR ? "Çocuklar" : "Children"}>
              <p>
                {isTR
                  ? "Braavolabs 13 yaşın altındaki çocuklar için tasarlanmamıştır. Bu yaşın altındaki bir kullanıcıdan veri topladığımızı fark edersek, hesabı derhal silip kayıtları temizleriz."
                  : "Braavolabs is not designed for children under 13. If we discover that we have collected data from a user below this age, we delete the account and clear the records immediately."}
              </p>
            </Section>

            <Section title={isTR ? "Haklarınız" : "Your rights"}>
              <p>
                {isTR
                  ? "KVKK Madde 11 ve GDPR Madde 15-22 kapsamında: verilerinize erişme, düzeltme, silme, taşıma ve işlemeye itiraz etme haklarına sahipsiniz. Bu talepleri support@yulalab.com adresine gönderebilirsiniz; 30 gün içinde yanıtlıyoruz."
                  : "Under KVKK Article 11 and GDPR Articles 15-22, you have the right to access, correct, delete, port, and object to processing of your data. Send requests to support@yulalab.com; we respond within 30 days."}
              </p>
            </Section>

            <Section title={isTR ? "Veri güvenliği" : "Data security"}>
              <p>
                {isTR
                  ? "İletişim TLS 1.2+ ile şifrelenir. Parolalar Argon2id ile hashlenir. Veritabanı yedekleri AES-256-CBC ile şifrelenir. Üçüncü taraf entegrasyon token'ları kullanıcı başına özel anahtar ile şifrelenir."
                  : "Communication is encrypted with TLS 1.2+. Passwords are hashed with Argon2id. Database backups are encrypted with AES-256-CBC. Third-party integration tokens are encrypted per-user."}
              </p>
            </Section>

            <Section title={isTR ? "Değişiklikler" : "Changes"}>
              <p>
                {isTR
                  ? "Bu politikayı zaman zaman güncelleyebiliriz. Önemli değişiklikleri uygulama içi bildirimle ve bu sayfada belirtilen 'Son güncelleme' tarihiyle duyururuz."
                  : "We may update this policy from time to time. Significant changes will be announced via in-app notice and reflected in the 'Last updated' date on this page."}
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
