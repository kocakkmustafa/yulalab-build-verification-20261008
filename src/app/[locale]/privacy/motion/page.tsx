import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { EyebrowChip } from "@/components/common/EyebrowChip";

const LAST_UPDATED = "2026-09-27";

const APPS = [
  "Choreia: Learn to Dance",
  "Lissom: Mobility & Yoga",
  "Gravita: Skills & Strength",
  "JabLab: Shadow Training",
  "Ostinato: Music Practice",
];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const isTR = locale === "tr";
  return {
    title: isTR ? "Gizlilik · Motion uygulamaları" : "Privacy · Motion apps",
    description: isTR
      ? "Motion ailesinin gizlilik bilgileri ve uygulama/sürüm kapsamı: Choreia, Lissom, Gravita, JabLab ve Ostinato."
      : "Privacy information and app/version scope for the Motion family: Choreia, Lissom, Gravita, JabLab and Ostinato.",
    alternates: {
      canonical: isTR ? "/privacy/motion" : `/${locale}/privacy/motion`,
    },
  };
}

export default async function MotionPrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <MotionPrivacy />;
}

function MotionPrivacy() {
  const locale = useLocale();
  const isTR = locale === "tr";

  return (
    <div className="page-enter">
      <section className="relative pt-32 pb-16 lg:pt-40">
        <div className="max-w-3xl mx-auto px-6 lg:px-10">
          <Link
            href="/privacy"
            className="link-wipe font-mono text-[11px] tracking-widest uppercase text-ink-400"
          >
            ← {isTR ? "Gizlilik" : "Privacy"}
          </Link>

          <EyebrowChip>Motion</EyebrowChip>

          <h1 className="mt-6 font-display font-extrabold text-ink-50 leading-[0.96] tracking-tightest text-[40px] sm:text-[52px] md:text-[60px]">
            {isTR ? "Motion gizlilik bilgileri" : "Motion privacy information"}
          </h1>

          <p className="mt-6 font-mono text-[11px] tracking-widest uppercase text-ink-400">
            {isTR ? "Son güncelleme" : "Last updated"}: {LAST_UPDATED}
          </p>

          <p className="mt-6 text-[15px] leading-[1.6] text-ink-300">
            {isTR
              ? "Bu politika, aşağıdaki beş Motion uygulamasının ilk mağaza sürümündeki ortak hesap ve uygulamaya özgü yerel veri kullanımını açıklar:"
              : "This policy describes the shared account and app-specific local data use in the first store release of these five Motion apps:"}
          </p>
          <ul className="mt-3 space-y-1 text-[15px] leading-[1.6] text-ink-200">
            {APPS.map((a) => (
              <li key={a}>· {a}</li>
            ))}
          </ul>

          <p className="mt-6 text-[15px] leading-[1.6] text-ink-200">
            <a href="#motion-account-deletion" className="link-wipe text-ink-50">
              {isTR
                ? "Motion hesabı ve ilişkili veriler için silme talebi"
                : "Request deletion of a Motion account and associated data"}
            </a>
          </p>

          <div className="mt-14 space-y-10 text-[16px] leading-[1.7] text-ink-300">
            <Section title={isTR ? "Ortak hesap ve üyelik" : "Shared account and membership"}>
              <p>
                {isTR
                  ? "Beş uygulama tek Motion hesabını kullanır. Kayıt, giriş, e-posta doğrulama ve parola kurtarma için e-posta adresiniz ve parolanız Supabase Auth'a gönderilir; isteğe bağlı görünen adınız Motion profilinde saklanır. Rastgele hesap kimliği oturumunuzu ve uygulama erişiminizi ilişkilendirir. Parolayı uygulamanın seans geçmişine kaydetmeyiz. İlk sürümde beş uygulamada da ücretli satış kapalıdır. Abonelikler açılırsa bireysel abonelik yalnız satın alındığı uygulamada, Motion+ ise beş uygulamada geçerli olacak şekilde tasarlanmıştır."
                  : "The five apps share one Motion account. Your email address and password go to Supabase Auth for sign-up, sign-in, email confirmation and password recovery; an optional display name is stored in your Motion profile. A random account ID links your session and app access. The apps do not put your password in practice history. Paid sales are disabled in the first release of all five apps. If subscriptions are enabled, an individual subscription is designed to cover its app and Motion+ all five."}
              </p>
              <p className="mt-3">
                {isTR
                  ? "Supabase Auth, parolanızı doğrulamak için bcrypt ile üretilmiş tuzlu bir parola özeti (hash) saklar. Bu kimlik doğrulama kaydı hesabınıza bağlıdır ve hesap girişi ile güvenliği için kullanılır."
                  : "Supabase Auth stores a salted password hash produced with bcrypt to verify your password. This authentication record is linked to your account and used for account sign-in and security."}
              </p>
            </Section>

            <Section title={isTR ? "Sağlayıcı günlükleri ve yaklaşık konum" : "Provider logs and approximate location"}>
              <p>
                {isTR
                  ? "Motion hesap hizmetlerine gönderilen istekler, Supabase ve hizmet sağlayıcılarının sakladığı operasyonel günlüklere IP adresi, kullanıcı aracısı (user agent), işletim sistemi, platform ve çalışma ortamı sürümleri ile istek ve kimlik doğrulama olaylarının teknik ayrıntılarını ekleyebilir. Bunlar teknik hizmet bilgileridir; uygulamalar benzersiz bir cihaz kimliği göndermez. Sağlayıcı günlükleri ayrıca IP adresine dayanan yaklaşık ülke, bölge ve şehir bilgisi içerir. Bu konum bilgisi GPS'ten alınmaz ve uygulamalar konum izni istemez."
                  : "Requests to Motion account services can add your IP address, user agent, operating system, platform and runtime versions, and request and authentication metadata to operational logs retained by Supabase and service providers. These are technical service details; the apps do not send a unique device ID. Provider logs also contain approximate country, region and city information based on the IP address. This location does not come from GPS, and the apps do not request location permission."}
              </p>
              <p className="mt-3">
                {isTR
                  ? "Günlük kayıtları hesap kimliği veya IP adresi üzerinden sizinle ilişkilendirilebilir. Hesap ve sağlayıcı verileri kimlik doğrulama, güvenlik, hizmetin işletilmesi ve teknik sorunların incelenmesi için kullanılır; reklam veya reklam amaçlı takip için kullanılmaz."
                  : "Log records can be associated with you through an account ID or IP address. Account and provider data are used for authentication, security, operating the service and investigating technical issues; they are not used for advertising or advertising tracking."}
              </p>
            </Section>

            <Section title={isTR ? "Satın alma doğrulaması" : "Purchase verification"}>
              <p>
                {isTR
                  ? "İlk sürümde uygulamalarda abonelik satın alma başlatılamaz. Ücretli üyelik ileride açılırsa Apple veya Google mağaza ürünü ve işlem kanıtı sunucuda doğrulanır. Bu akış için Motion, uygulama kimliği, mağaza, ürün, işlem referansı, üyelik durumu ve bitiş/doğrulama zamanını hesabınızla ilişkili olarak saklayacak şekilde tasarlanmıştır; Google işlem referansı satın alma belirtecini içerebilir. Doğrulama için mağaza sağlayıcısına istek gönderilir. Ödeme kartı bilgilerinizi Motion almaz."
                  : "The apps cannot start subscription purchases in the first release. If paid membership is enabled later, the store product and transaction evidence are verified with Apple or Google. That flow is designed to store the app ID, store, product, transaction reference, entitlement status, and expiry/verification times against your account; a Google transaction reference can contain a purchase token. Verification requests go to the store provider. Motion does not receive your payment card details."}
              </p>
            </Section>

            <Section title={isTR ? "Kamera, isteğe bağlı mikrofon ve cihazdaki geçmiş" : "Camera, optional microphone and on-device history"}>
              <p>
                {isTR
                  ? "İlk sürümde beş uygulamada da kamera koçluğu kapalıdır; kurslar kamera izni gerektirmez. Kamera videosu kaydedilmez veya Motion sunucusuna yüklenmez. Ostinato'nun gitar kursunda isteğe bağlı tek nota gözlemini siz başlatır ve mikrofon iznini siz verirsiniz. Yaklaşık nota gözlemi doğruluk veya ustalık puanı üretmez ve dersi tamamlamaz. Ses yalnız cihaz belleğinde işlenir; ham ses dosyası kaydedilmez veya sunucuya yüklenmez. Gözlemi durdurduğunuzda, hesap değiştirdiğinizde ya da ekran veya uygulama arka plana geçtiğinde mikrofon durur; geri dönüşte kendiliğinden başlamaz. Kurs mikrofonsuz tamamlanabilir; diğer dört Motion uygulamasının ilk kursları mikrofon istemez. Okuma, pratik ve öz bildirimli kurs ilerlemesi kamera beceri puanı değildir. Kurs ilerlemesi ve uygulamanın oluşturduğu çalışma geçmişi yalnız o uygulamanın cihazdaki alanında tutulur; Motion hesabına eşitlenmez. Misafir geçmişi giriş yaptığınızda hesabınıza otomatik taşınmaz. Motion hesap kayıtları Frankfurt'taki Supabase projesinde saklanır; iletimde HTTPS kullanılır. Uygulamalarda reklam veya davranış izleme SDK'sı yoktur."
                  : "Camera coaching is disabled in the first release of all five apps; the courses do not require camera permission. Camera video is not recorded or uploaded to Motion servers. In Ostinato's guitar course, you choose to start optional single-note observation and grant microphone permission. The approximate note observation does not produce a correctness or mastery score or complete a lesson. Audio is processed only in device memory; raw audio files are not recorded or uploaded. The microphone stops when you stop observation, change account, or the screen or app leaves the foreground; returning does not restart it. You can complete the course without it; the other four Motion apps' first courses do not request microphone access. Reading, practice and self-reported course progress are not a camera skill score. Course progress and practice history created by an app stay in that app's local device storage; they are not synced to your Motion account. Guest history is not automatically moved into an account when you sign in. Motion account records are stored in its Frankfurt Supabase project, with HTTPS in transit. The apps contain no advertising or behavioral tracking SDK."}
              </p>
            </Section>

            <section id="motion-account-deletion" className="scroll-mt-28">
              <h2 className="font-display font-bold text-ink-50 text-[22px] md:text-[24px] mb-3">
                {isTR ? "Motion hesabını ve verilerini silme" : "Delete a Motion account and its data"}
              </h2>
              <p>
                {isTR
                  ? "Herhangi bir Motion uygulamasında Hesap > Hesabı sil yolunu kullanabilirsiniz. Bu işlem ortak hesabı, profili ve sunucudaki abonelik erişim kayıtlarını siler; kullandığınız uygulamanın o hesaba ait yerel geçmişini temizler. Diğer Motion uygulamaları açılıp çevrimiçi silme kaydını denetlediklerinde kendi yerel hesap geçmişlerini temizler. Misafir kayıtları ayrı kalır."
                  : "Use Account > Delete account in any Motion app. This deletes the shared account, profile and server-side entitlement records, then clears that account's local history in the app you used. Other Motion apps clear their own local account history when next opened and able to check the online deletion receipt. Guest records remain separate."}
              </p>
              <p className="mt-3">
                {isTR
                  ? "Uygulama elinizde yoksa veya silme işlemi başarısız olursa, aşağıdaki bağlantıdan support@yulalab.com adresine Motion hesabı silme talebi gönderin. Talebi işlemek için hesap e-postanızı ve kullandığınız uygulamayı belirtin; parolanızı göndermeyin."
                  : "If you no longer have the app or deletion fails, use the link below to request deletion from support@yulalab.com. Include your account email and the app you used so we can locate the account; do not send your password."}
              </p>
              <a
                href="mailto:support@yulalab.com?subject=Motion%20account%20deletion"
                className="link-wipe text-ink-50"
              >
                {isTR ? "E-postayla silme talebi gönder" : "Email an account deletion request"}
              </a>
              <p className="mt-3">
                {isTR
                  ? "Hesap silmek Apple veya Google aboneliğini iptal etmez; yinelenen ödemeyi durdurmak için aboneliği mağaza hesabınızdan ayrıca iptal edin. Diğer cihazların silmeyi sonradan tanıması için rastgele hesap kimliğinin tek yönlü özeti sunucuda silme kaydı olarak tutulur. Sağlayıcıların operasyonel günlükleri ve yedekleri kendi saklama döngülerine tabidir; hesap silme, bu kayıtların tamamının anında silindiği anlamına gelmez."
                  : "Deleting the account does not cancel an Apple or Google subscription; cancel it separately in your store account to stop renewal. A one-way digest of the random account ID is retained on the server as a deletion receipt so other devices can recognize deletion on a later launch. Provider operational logs and backups follow their own retention cycles; deleting an account does not mean that all of those records are immediately erased."}
              </p>
            </section>

            <Section title={isTR ? "Sağlık ve fitness" : "Health and fitness"}>
              <p>
                {isTR
                  ? "Motion ürünleri hareket ve pratik desteği amacıyla geliştirilmektedir. Tıbbi cihaz değildirler; teşhis koymaz, tedavi önermez, tıbbi tavsiye vermezler. Bir rahatsızlığınız varsa hekiminize danışın."
                  : "Motion products are being developed to support movement and practice. They are not medical devices; they do not diagnose, prescribe treatment, or give medical advice. If you have a health condition, consult your physician."}
              </p>
            </Section>

            <Section title={isTR ? "Çocuklar" : "Children"}>
              <p>
                {isTR
                  ? "Uygulamalar çocuklara yönelik değildir ve çocuklardan bilerek veri toplamaz."
                  : "The applications are not directed at children and do not knowingly collect data from children."}
              </p>
            </Section>

            <Section title={isTR ? "Haklarınız" : "Your rights"}>
              <p>
                {isTR
                  ? "Hesap profilinizi uygulamada görebilir ve görünen adınızı düzeltebilirsiniz. Verilerinize erişim, düzeltme veya silme taleplerinizi hesap e-postanız ve uygulama adıyla support@yulalab.com adresine iletebilirsiniz. Uygulanabilir KVKK ve GDPR hakları saklıdır."
                  : "You can view your account profile and correct your display name in the app. Send requests to access, correct or delete data to support@yulalab.com with your account email and app name. Applicable rights under Turkish data protection law (KVKK) and GDPR remain available."}
              </p>
            </Section>

            <Section title={isTR ? "Değişiklikler" : "Changes"}>
              <p>
                {isTR
                  ? "Bu politikayı güncellersek yukarıdaki tarihi değiştiririz. Veri işleme biçimimizde esaslı bir değişiklik olursa uygulama içinde bildiririz."
                  : "If we update this policy we will change the date above. If there is a material change in how we handle data, we will notify you inside the application."}
              </p>
            </Section>

            <Section title={isTR ? "İletişim" : "Contact"}>
              <p>
                {isTR ? "Veri Sorumlusu" : "Data Controller"}: YULA Lab — Mustafa Kaan Koçak
                <br />
                {isTR ? "E-posta" : "Email"}:{" "}
                <a href="mailto:support@yulalab.com" className="link-wipe text-ink-50">
                  support@yulalab.com
                </a>
                <br />
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
