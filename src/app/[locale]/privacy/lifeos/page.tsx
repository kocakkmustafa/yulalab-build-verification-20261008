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
    title: isTR ? "Gizlilik · LifeOS" : "Privacy · LifeOS",
    description: isTR
      ? "LifeOS'un cihazda saklama, isteğe bağlı hizmetler ve veri haklarına ilişkin gizlilik bilgileri."
      : "LifeOS privacy information about on-device storage, optional services and your data rights.",
    alternates: {
      canonical: isTR ? "/privacy/lifeos" : `/${locale}/privacy/lifeos`,
    },
  };
}

export default async function LifeosPrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <LifeosPrivacy />;
}

function LifeosPrivacy() {
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
            <EyebrowChip>LifeOS</EyebrowChip>
          </div>

          <h1 className="mt-6 font-display font-extrabold text-ink-50 leading-[0.96] tracking-tightest text-[40px] sm:text-[52px] md:text-[60px]">
            {isTR ? "LifeOS gizlilik politikası" : "LifeOS privacy policy"}
          </h1>

          <div className="mt-4 font-mono text-[11px] tracking-widest uppercase text-ink-400">
            {isTR ? "Son güncelleme" : "Last updated"}: {LAST_UPDATED}
          </div>

          <div className="mt-10 text-[15.5px] leading-[1.75] text-ink-200 space-y-8">
            <Section title={isTR ? "Tek satırlık özet" : "One-line summary"}>
              <p className="text-ink-100">
                {isTR
                  ? "LifeOS, cihaz üstü veri saklamayı temel alan offline-first bir uygulamadır. Hesap, satın alma durumu, çökme raporlaması ve isteğe bağlı bulut yedekleme için işlenen veriler aşağıda ayrı ayrı açıklanır. Cihazda tutulan içerikle bu hizmetlere gönderilen hesap ve hizmet verileri aynı kapsamda değildir."
                  : "LifeOS is an offline-first app built around on-device data storage. Data processed for accounts, purchase state, crash reporting and optional cloud backup is described separately below. Content kept on your device is distinct from the account and service data sent to those services."}
              </p>
            </Section>

            <Section title={isTR ? "Cihaz üstü kalan veriler" : "Data that stays on your device"}>
              <ul className="list-disc pl-5 space-y-2">
                <li>{isTR ? "Sağlık verileri (Apple Health / Health Connect üzerinden okunan adım, kalp atışı, uyku, egzersiz)" : "Health data (read from Apple Health / Health Connect: steps, heart rate, sleep, exercise)"}</li>
                <li>{isTR ? "Finans kayıtları (gelir, gider, hedefler)" : "Financial records (income, expenses, goals)"}</li>
                <li>{isTR ? "Eğitim ve hedef takibi" : "Learning and goal tracking"}</li>
                <li>{isTR ? "Sesli günlük ve Z-Rapor kayıtları (ses cihazda metne dönüştürülür)" : "Voice journal and Z-Report entries (audio is transcribed on-device)"}</li>
                <li>{isTR ? "Fotoğraflar ve diğer ek dosyalar" : "Photos and other attachments"}</li>
              </ul>
              <p className="mt-4">
                {isTR
                  ? "Uygulamanın ana veritabanı cihazda SQLCipher + AES-256 ile şifrelenir. Veritabanı anahtarı cihazın Keychain (iOS) veya Keystore (Android) içinde saklanır. Ses, fotoğraf, dışa aktarılan dosyalar ve diğer ek dosyalar ayrı dosyalar olabilir; veritabanı şifrelemesi bu dosyaların tamamını kapsadığı anlamına gelmez."
                  : "The app's main database is encrypted on-device with SQLCipher + AES-256. Its key is stored in the device's Keychain (iOS) or Keystore (Android). Audio, photos, exports and other attachments may be separate files; database encryption does not mean that it covers every one of those files."}
              </p>
            </Section>

            <Section title={isTR ? "Sunucumuza giden veriler" : "Data sent to our servers"}>
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  <strong className="text-ink-100">{isTR ? "Hesap bilgileri" : "Account information"}</strong>:
                  {" "}{isTR
                    ? "E-posta ve cihaz ID (yalnızca bir hesap oluşturursanız). Hesap oluşturmadan da uygulamayı çoğu özelliğiyle kullanabilirsiniz."
                    : "Email and device ID (only if you create an account). You can use the app with most features without creating an account."}
                </li>
                <li>
                  <strong className="text-ink-100">{isTR ? "Çökme raporları" : "Crash reports"}</strong>:
                  {" "}{isTR
                    ? "Çökme raporlaması için Sentry kullanılır. Raporlama tercihinizi Ayarlar > Gizlilik bölümünden kontrol edebilir ve değiştirebilirsiniz. Raporlama açıkken uygulama hatalarına ilişkin tanılama verileri Sentry'ye gönderilir."
                    : "Sentry is used for crash reporting. You can check and change your reporting preference in Settings > Privacy. When reporting is enabled, diagnostic data about application errors is sent to Sentry."}
                </li>
                <li>
                  <strong className="text-ink-100">{isTR ? "Satın alma durumu" : "Purchase state"}</strong>:
                  {" "}{isTR
                    ? "Apple App Store / Google Play makbuz doğrulaması. Sadece aktif/pasif ve seviye (Plus / Pro) bilgisi saklanır."
                    : "Apple App Store / Google Play receipt validation. We only store active/inactive and tier (Plus / Pro)."}
                </li>
                <li>
                  <strong className="text-ink-100">{isTR ? "Bulut eşzamanlama (isteğe bağlı)" : "Cloud sync (optional)"}</strong>:
                  {" "}{isTR
                    ? "Bulut eşzamanlamayı etkinleştirirseniz, eşzamanlama kapsamındaki kayıtlar Supabase hizmetine aktarılabilir. Cihazdaki veritabanının şifreli olması, bulut kopyasının uçtan uca şifreli olduğu anlamına gelmez. Aktarılan veri kapsamı ve şifreleme özellikleri için kullandığınız sürümün uygulama içi bilgilerini kontrol edin; kişisel içerik göndermeden önce destek ekibinden açıklama isteyebilirsiniz."
                    : "If you enable cloud sync, records included in sync may be transferred to Supabase. Encryption of the database on your device does not mean that the cloud copy is end-to-end encrypted. Check the in-app information for your version for the data included and the available encryption features; you can ask support for clarification before sending personal content."}
                </li>
              </ul>
            </Section>

            <Section title={isTR ? "HealthKit / Health Connect" : "HealthKit / Health Connect"}>
              <p>
                {isTR
                  ? "Sağlık verisini okumak için Apple HealthKit (iOS) ve Android Health Connect izinleri istenir. Bu izinleri opsiyonel olarak verirsiniz. Okunan sağlık verisi cihaz üstünde işlenir, sunucuya GÖNDERİLMEZ, model eğitimi için KULLANILMAZ. Apple Health Veri Kullanım Politikası ile tam uyumludur."
                  : "We request Apple HealthKit (iOS) and Android Health Connect permissions to read health data. You grant these optionally. Health data is processed on-device, is NOT sent to any server, and is NOT used for model training. Fully compliant with Apple's Health Data Use Policy."}
              </p>
            </Section>

            <Section title={isTR ? "Üçüncü taraflar" : "Third parties"}>
              <ul className="list-disc pl-5 space-y-2">
                <li><strong className="text-ink-100">Supabase</strong>: {isTR ? "Hesap kaydı ve opsiyonel bulut yedek. AB içi (Frankfurt) sunucularda barınır." : "Account registration and optional cloud backup. Hosted on EU (Frankfurt) servers."}</li>
                <li><strong className="text-ink-100">Apple HealthKit / Health Connect</strong>: {isTR ? "Sağlık verisi okuma izni (opsiyonel)." : "Health data read permission (optional)."}</li>
                <li><strong className="text-ink-100">Apple App Store / Google Play</strong>: {isTR ? "Abonelik ödemesi ve makbuz doğrulama." : "Subscription payments and receipt validation."}</li>
                <li><strong className="text-ink-100">Sentry</strong>: {isTR ? "Çökme raporları; uygulamadaki raporlama tercihine bağlıdır." : "Crash reports, subject to your reporting preference in the app."}</li>
              </ul>
            </Section>

            <Section title={isTR ? "Veri saklama" : "Data retention"}>
              <p>
                {isTR
                  ? "Cihaz verisi siz silene kadar kalır. Hesap silme işlemi ile cihazdaki dosyaların silinmesi ayrı işlemlerdir. Hesap silme işleminin tamamlandığını belgeleyen makbuz kayıtları, hesap silindikten sonra da kullanıcı kimliğiyle birlikte tutulabilir. Bu nedenle tüm sunucu kayıtlarının 30 gün içinde silineceğine dair genel bir garanti vermiyoruz. Hesabınızla ilişkili kayıtların kapsamı, saklama süresi ve silme talebi için support@yulalab.com adresine yazabilirsiniz."
                  : "Device data is kept until you delete it. Deleting an account and removing files from your device are separate actions. Receipts documenting completion of an account deletion may retain the user identifier after the account has been deleted. We therefore do not give a blanket guarantee that all server-side records are removed within 30 days. For the scope and retention period of records associated with your account, or a deletion request, contact support@yulalab.com."}
              </p>
            </Section>

            <Section title={isTR ? "Çocuklar" : "Children"}>
              <p>
                {isTR
                  ? "LifeOS 13 yaş ve üzeri kullanıcılar içindir. 13 yaşından küçük bir kullanıcıdan veri topladığımızı fark edersek hesabı silip kayıtları temizleriz."
                  : "LifeOS is for users 13 and older. If we learn that we have collected data from a child under 13, we will delete the account and clear the records."}
              </p>
            </Section>

            <Section title={isTR ? "Tıbbi uyarı" : "Medical disclaimer"}>
              <p>
                {isTR
                  ? "LifeOS bir sağlık takip aracıdır, TIBBİ TAVSİYE SAĞLAMAZ. Sağlık kararlarınız için lütfen lisanslı bir sağlık profesyoneline danışın. Uygulama herhangi bir hastalığı teşhis, tedavi veya önleme amacı taşımaz."
                  : "LifeOS is a health tracking tool and does NOT provide medical advice. Please consult a licensed health professional for medical decisions. The app is not intended to diagnose, treat, or prevent any disease."}
              </p>
            </Section>

            <Section title={isTR ? "Haklarınız" : "Your rights"}>
              <p>
                {isTR
                  ? "KVKK Madde 11 ve GDPR Madde 15-22 kapsamındaki erişim, düzeltme, silme, taşıma ve itiraz haklarına sahipsiniz. Cihaz kayıtları için kullandığınız sürümdeki dışa aktarma ve silme araçlarının kapsadığı verileri kontrol edin; ayrı ek dosyalar ayrıca işlem gerektirebilir. Hesap ve sunucu kayıtlarına ilişkin taleplerinizi support@yulalab.com adresine iletin."
                  : "You have rights of access, correction, deletion, portability, and objection under KVKK Article 11 and GDPR Articles 15-22. For device records, check which data the export and deletion tools in your version cover; separate attachments may require an additional action. Send requests about account and server-side records to support@yulalab.com."}
              </p>
              <p className="mt-4">
                {isTR ? "Hesap silme adımları ve uygulama dışından talep yolu: " : "Account deletion steps and the request path outside the app: "}
                <Link href="/delete-account/lifeos" className="link-wipe text-ink-50">
                  {isTR ? "LifeOS hesabını ve verilerini silme" : "Delete your LifeOS account and data"}
                </Link>.
              </p>
            </Section>

            <Section title={isTR ? "Veri güvenliği" : "Data security"}>
              <p>
                {isTR
                  ? "Ana cihaz veritabanı SQLCipher + AES-256 ile şifrelenir; anahtarı Keychain/Keystore içinde tutulur. Bu koruma kapsamı, ayrı ek dosyalardan ve isteğe bağlı bulut eşzamanlamadan farklıdır. Bulut eşzamanlama için bu sayfada tüm sürümleri kapsayan uçtan uca şifreleme veya sunucunun veriyi okuyamaması garantisi verilmez."
                  : "The main device database is encrypted with SQLCipher + AES-256, with its key held in Keychain/Keystore. This protection has a different scope from separate attachments and optional cloud sync. This page does not guarantee end-to-end encryption or server unreadability of cloud sync data across all versions."}
              </p>
            </Section>

            <Section title={isTR ? "Değişiklikler" : "Changes"}>
              <p>
                {isTR
                  ? "Bu politikayı zaman zaman güncelleyebiliriz. Önemli değişiklikleri uygulama içi bildirimle ve 'Son güncelleme' tarihiyle duyururuz."
                  : "We may update this policy from time to time. Significant changes will be announced via in-app notice and reflected in the 'Last updated' date."}
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
