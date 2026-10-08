import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { EyebrowChip } from "@/components/common/EyebrowChip";

const LAST_UPDATED = "2026-09-23";
const REQUEST_EMAIL = "support@yulalab.com";
const REQUEST_HREF = `mailto:${REQUEST_EMAIL}?subject=LifeOS%20account%20deletion`;
const DATA_REQUEST_HREF = `mailto:${REQUEST_EMAIL}?subject=LifeOS%20data%20deletion`;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const isTR = locale === "tr";
  return {
    title: isTR ? "LifeOS hesap ve veri silme" : "LifeOS account and data deletion",
    description: isTR
      ? "LifeOS hesabınızı ve ilişkili verilerinizi uygulama içinden veya uygulamaya erişmeden nasıl sileceğinizi öğrenin."
      : "Learn how to request deletion of your LifeOS account and associated data, in the app or without access to it.",
    alternates: {
      canonical: isTR ? "/delete-account/lifeos" : `/${locale}/delete-account/lifeos`,
    },
  };
}

export default async function LifeosAccountDeletionPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isTR = locale === "tr";

  return (
    <div className="page-enter">
      <section className="relative pt-32 pb-16 lg:pt-40">
        <div className="max-w-3xl mx-auto px-6 lg:px-10">
          <Link
            href="/privacy/lifeos"
            className="font-mono text-[11px] tracking-widest uppercase text-ink-300 hover:text-ink-100 link-wipe"
          >
            ← {isTR ? "LifeOS gizlilik politikası" : "LifeOS privacy policy"}
          </Link>

          <div className="mt-6"><EyebrowChip>LifeOS · YULA Lab</EyebrowChip></div>
          <h1 className="mt-6 font-display font-extrabold text-ink-50 leading-[0.96] tracking-tightest text-[40px] sm:text-[52px] md:text-[60px]">
            {isTR ? "LifeOS hesabını ve verilerini silme" : "Delete your LifeOS account and data"}
          </h1>
          <p className="mt-4 font-mono text-[11px] tracking-widest uppercase text-ink-300">
            {isTR ? "Son güncelleme" : "Last updated"}: {LAST_UPDATED}
          </p>

          <div className="mt-10 text-[15.5px] leading-[1.75] text-ink-200 space-y-9">
            <Section title={isTR ? "Uygulamaya erişimin yoksa" : "If you cannot access the app"}>
              <p>
                {isTR
                  ? "LifeOS hesabının ve onunla ilişkili verilerin silinmesini uygulamayı yeniden yüklemeden e-postayla talep edebilirsin. Mümkünse hesabında kullandığın e-posta adresinden yaz ve konuya “LifeOS hesap silme” ekle. Parola, kimlik belgesi veya sağlık/finans içeriği gönderme. Talebini işleme almadan önce hesap sahipliğini doğrulamamız gerekebilir."
                  : "You can request deletion of your LifeOS account and associated data by email without reinstalling the app. If possible, write from the email address used for your account and use the subject “LifeOS account deletion.” Do not send a password, identity document, or health or financial content. We may need to verify account ownership before processing the request."}
              </p>
              <a
                href={REQUEST_HREF}
                className="mt-5 inline-flex rounded-lg border border-white/25 px-5 py-3 text-ink-50 hover:bg-white/[0.06] focusable"
              >
                {isTR ? "Silme talebi gönder" : "Email a deletion request"} · {REQUEST_EMAIL}
              </a>
            </Section>

            <Section title={isTR ? "Uygulama içinden" : "In the app"}>
              <p>
                {isTR
                  ? "LifeOS içinde Ayarlar → HESAP İŞLEMLERİ → Hesabımı kalıcı olarak sil yolunu aç. Onay ekranındaki adımları tamamla. Uygulama çevrimiçi hesabı ve ilişkili senkronize kayıtları silmeyi dener; ardından kapsamına giren cihaz verilerini temizler. Çevrimiçi silme doğrulanamazsa uygulama bunu ayrı bir uyarıyla bildirir. Bu durumda hesap ve bulut kayıtları hâlâ mevcut olabilir; yeniden giriş yaparak tekrar deneyebilir veya yukarıdaki e-posta yolunu kullanabilirsin."
                  : "In LifeOS, open Settings → ACCOUNT ACTIONS → Permanently delete my account and complete the confirmation steps. The app attempts to delete your online account and associated synced records, then clears the device data within its deletion scope. If online deletion cannot be confirmed, the app shows a separate warning. Your account and cloud records may still exist in that case; sign in to try again or use the email request above."}
              </p>
            </Section>

            <Section title={isTR ? "Hesabı silmeden belirli verileri silme" : "Delete specific data without deleting your account"}>
              <p>
                {isTR
                  ? "LifeOS içindeki Arşiv Merkezi'nde arşivlenmiş izleyicileri ve bunlara bağlı kayıtları kalıcı olarak silebilirsin. Uygulama önce bu cihazdaki kayıtları temizler ve ilişkili bulut kayıtlarının silinmesini doğrulamaya çalışır. Bulut silme doğrulanmazsa işlem beklemede görünür; çevrimiçi olduğunda yeniden deneyebilirsin. Hesabın açık kalır."
                  : "In LifeOS Archive Center, you can permanently delete archived trackers and their related records. The app clears those records on this device first and attempts to confirm deletion of the related cloud records. If cloud deletion is not confirmed, the request remains pending so you can retry when online. Your account stays open."}
              </p>
              <p className="mt-4">
                {isTR
                  ? "Uygulamaya erişemiyorsan veya başka hesap bağlantılı verilerin silinmesini istiyorsan, hesabında kullandığın e-posta adresinden bize yaz. Hangi veri türlerinin silinmesini istediğini belirt; parola, kimlik belgesi veya sağlık verilerinin içeriğini gönderme. İşlem öncesinde hesap sahipliğini doğrulamamız gerekebilir."
                  : "If you cannot access the app or want other account-linked data deleted, email us from the address used for your account. Tell us which types of data you want deleted; do not send passwords, identity documents, or the contents of health records. We may need to verify account ownership before processing the request."}
              </p>
              <a
                href={DATA_REQUEST_HREF}
                className="mt-5 inline-flex rounded-lg border border-white/25 px-5 py-3 text-ink-50 hover:bg-white/[0.06] focusable"
              >
                {isTR ? "Veri silme talebi gönder" : "Email a data deletion request"} · {REQUEST_EMAIL}
              </a>
            </Section>

            <Section title={isTR ? "Silme kapsamı ve saklanan kayıtlar" : "Deletion scope and retained records"}>
              <p>
                {isTR
                  ? "Çevrimiçi işlem hesabı ve uygulamanın senkronize ettiği hesap bağlantılı kayıtları hedefler. Yerel işlem, uygulamanın yönettiği ana veritabanını, anahtarları ve bazı önbellekleri temizler. Ayrı dışa aktarılan dosyalar, fotoğraflar veya cihaz yedekleri için ayrıca silme gerekebilir. Silme işlem makbuzları, hizmet ve güvenlik günlükleri ile mağaza faturalama kayıtları yasal ya da operasyonel gereklilik sürdüğü ölçüde kalabilir. Kayıtların tümü için kesin bir silme süresi veya bütün bulut kopyalarının anında yok edilmesi sözü vermiyoruz; hesabına özgü kapsam ve süreyi e-postayla sorabilirsin."
                  : "The online process targets your account and account-linked records synced by the app. The local process clears the app-managed primary database, keys, and some caches. Separately exported files, photos, or device backups may require a separate deletion step. Deletion receipts, service and security logs, and store billing records may remain while legal or operational needs apply. We do not promise one deletion deadline for every record or immediate removal of every cloud copy; you can ask by email about the scope and timing for your account."}
              </p>
            </Section>

            <Section title={isTR ? "Abonelik" : "Subscription"}>
              <p>
                {isTR
                  ? "Hesap silme, Apple App Store veya Google Play aboneliğini otomatik olarak iptal etmez. Etkin aboneliğini ayrıca ilgili mağazanın abonelik ayarlarından iptal et. Silme talebini başlatmak için önce aboneliği iptal etmen gerekmez."
                  : "Deleting your account does not automatically cancel an Apple App Store or Google Play subscription. Cancel an active subscription separately in the relevant store’s subscription settings. You do not need to cancel it before requesting account deletion."}
              </p>
            </Section>

            <p>
              {isTR ? "Veri işleme ve haklar hakkında daha fazla bilgi için " : "For more about data handling and your rights, read the "}
              <Link href="/privacy/lifeos" className="link-wipe text-ink-50">
                {isTR ? "LifeOS gizlilik politikasını" : "LifeOS privacy policy"}
              </Link>
              {isTR ? " oku." : "."}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-display font-bold text-ink-50 text-[22px] md:text-[24px] mb-3">{title}</h2>
      <div>{children}</div>
    </section>
  );
}
