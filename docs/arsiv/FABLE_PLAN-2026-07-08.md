# FABLE_PLAN — yulalab.com & links.yulalab.com Yol Haritası

> Hazırlayan: Fable (claude-fable-5) · Tarih: 2026-07-08
> Kapsam: Salt-okunur keşif + strateji. Bu belge yalnızca PLANDIR — bu oturumda hiçbir kod değiştirilmedi, hiçbir şey uygulanmadı. Uygulama ayrı bir oturumda, kullanıcı onayıyla başlar.
> Not: Yulalab, tek kişilik stüdyonun (Mustafa Kaan Koçak) şemsiye markası ve vitrinidir. Ürünler: LifeOS, Burun Farkı, Braavolabs. Bu, portföyün EN AZ ilgilenilmiş yüzeyidir; bu yüzden bu belge önce "bu site ne olmalı" sorusuna bir öneri sunar ve nihai marka-vitrin kararını kullanıcıya bırakır.

---

## 1) Keşif Özeti & Önerilen Hedef

### Ne var (mevcut durum)
- **yulalab.com** — Next.js 15 (App Router) · React 19 · TypeScript 5.7 · Tailwind 3 · next-intl 4 · Framer Motion · Vercel. Statik üretilen, TR (kök) / EN (`/en`) çift dilli, koyu temalı, premium bir **şemsiye showcase** sitesi. Rotalar: ana sayfa, `/manifesto`, `/transparency`, `/projects`, `/projects/[slug]` (braavolabs/burunfarki/lifeos), `/contact`, `/support`, `/privacy` (+ 3 ürün alt-sayfası). Dinamik `sitemap.ts`/`robots.ts`, per-proje dinamik OpenGraph görselleri, sıkı güvenlik başlıkları (CSP/HSTS), `prefers-reduced-motion` uyumu. Repo: `github.com/kocakkmustafa/YULA-Lab` (default `main`, Vercel auto-deploy). Son commit 2026-07-01 — **aktif ve özenle bakımlı** (SEO/legal/cleanup commit'leri mevcut).
- **links.yulalab.com** — Tek dosyalık, açık/krem temalı ("stamp" estetiği, Anton fontu), client-side JS ile veri-güdümlü bir Linktree tarzı sayfa. `/bf`, `/lo`, `/braavolabs` gibi kısa-link redirect'leri var. Sorumlu-oyun kaynağı (`yesilay.org.tr`) bağlı.
- **Kod kalitesi genelde yüksek:** null outbound linkler render edilmeden temizleniyor (`liveLinks`), gizlilik sayfaları KVKK (6698) + GDPR uyumlu ve gerçek içerikli, veri sorumlusu kimliği belirtilmiş, güvenlik başlıkları store denetçisi seviyesinde.

### Marka bağlamı (Obsidian vault'tan)
- **"Yula" = yol gösteren ışık**, "Lab" = deney/keşif. Site bu isim hikâyesini HİÇ anlatmıyor.
- **Çekirdek ayrışma: DÜRÜSTLÜK.** *"Söylediğini yapar. Buton varsa çalışır. Metrik gerçekse paylaşılır. 'Yakında gelecek' etiketiyle büyüyen rakiplere karşı konumlanma. Kullanıcıya gösterilecek her şey çalışıyor olmalı."*
- **Misyon:** teknolojiyi insanileştirmek. **Vizyon (kişisel):** 5 yılda pasif gelir + özgürlük → ölçeklenebilir olmayan, manuel-iş yaratan şeylerden kaçınmak.
- **Şemsiye marka stratejisi:** bir ürüne güvenen kullanıcı diğerine geçsin (çapraz-güven).
- **Umbrella hesabın sesi:** "dürüst builder / şeffaf inşaat" — build-in-public; yasak: performatif startup kültürü (grind/hustle).
- **Başarı eşiği:** ürün başına 400-500 ödeyen abone.
- **Konum çelişkisi:** vault "Kayseri merkezli şahıs şirketi" diyor; SİTE her yerde "İstanbul" diyor (footer, contact, privacy veri-sorumlusu konumu, koordinatlar 41.0082°N/28.9784°E = İstanbul).

### Önerilen Hedef (KULLANICIYA DOĞRULATILACAK — marka vitrini kararı sana ait)
Mevcut premium "şemsiye showcase" çekirdeğini KORU; ama onu stüdyonun **"kanıt & güven merkezi"**ne evrilt:
1. **Her zaman doğru, dürüst ürün dizini** — canlı ürünler gerçekten canlı görünsün ve mağazaya link versin (markanın dürüstlük sözünün ta kendisi).
2. **Üç uygulamanın ortak yasal/güven omurgası** — Privacy (✓) + eksik olan **Terms/EULA** + Support (✓) + doğru veri-sorumlusu kimliği; böylece site store uyumunu da besler.
3. **Hafif bir build-in-public içerik katmanı** (changelog/notlar) — SEO motoru + çapraz-ürün keşfi + "şeffaf inşaat" sesiyle birebir örtüşür. (Ağır blog/CMS DEĞİL — ölçeklenebilirlik vizyonuna aykırı.)
Bu bir lead-gen ajans sitesi VEYA ağır blog önerisi değildir. Alternatifler ve karar Bölüm 4'te.

---

## 2) Bulgular

### A. İşlevsel / doğruluk (marka-kritik)
- **[B-1] LifeOS "yakında" yalanı (P0, marka-kritik).** `src/data/projects/lifeos.ts` status `"coming-soon"`, App Store/Play linkleri `null`. `links.yulalab.com` (ve onun ikizi `public/links/index.html`) LifeOS'u `'Coming soon · Waitlist'` gösteriyor. Oysa memory'ye göre **LifeOS iOS App Store'da READY_FOR_SALE (canlı).** Dürüstlük markası, kendi canlı ürününü kendi ana sayfasında "yakında" diye etiketliyor ve indirme linki vermiyor. Listenin 1 numarası.
- **[B-2] Konum tutarsızlığı (P0, yasal).** Site "İstanbul" (footer/contact/privacy veri-sorumlusu/koordinat); vault "Kayseri". KVKK veri-sorumlusu adresi gerçeği yansıtmalı. Karar gerekli (Bölüm 4).
- **[B-3] Mağaza linki tazeliği (P0/P1).** Braavolabs App Store linki mevcut (`id6771440905`) — doğrula. Burun Farkı'nın hiç mağaza linki yok; memory'ye göre **Play üretim erişimi ONAYLANDI (2026-06-29)** → Play linki eklenebilir (canlı URL doğrulanınca). iOS BF henüz canlı değil → App Store linki eklenMEZ (şimdilik doğru).
- **[B-4] Dürüst-metrik tazeliği (P0/P1).** BF showcase'i `%40,8 Top-1`, `Brier 0.098`, `611 yarış backtest`, `13.587 yarış` diyor. Vault gerçek v4 motorunu "~%69 honest" olarak anlatıyor ve 14 günlük "dark" dönem yaşandı. Şeffaflık markası GÜNCEL ve savunulabilir sayı göstermeli. Kanonik metrik kaynağı + tazeleme ritmi kararı gerekli.
- **[B-5] Footer'da sosyal link YOK.** `company.socials` (x/linkedin/instagram) veri katmanında tanımlı ama Footer/Header hiçbir yerde render etmiyor. Şemsiye hesabın sosyal varlığı siteden görünmüyor. (Önce hesapların GERÇEKTEN var olduğunu doğrula — ölü handle bağlama.)
- **[B-6] Ölü i18n anahtarı.** `landing.bannerDrop` ("drop image here →") artık render edilmiyor (YulaBanner kullanmıyor). Ölü anahtar. Ayrıca `bannerSpec` ("YULA / banner.png · 2400×1400") ve `placeholder-stripes` "mockup/prototip" estetiği kasıtlı olabilir ama sıradan ziyaretçiye "yarım kalmış" hissi verir — marka kararı (Bölüm 4).

### B. Mimari / bakım
- **[B-7] Links sayfası ikizlenmesi (P2).** `yulalab.com/public/links/index.html` ile `links.yulalab.com/index.html` BAYT BAYT AYNI (commit geçmişi manuel senkron yaptığını doğruluyor). Sonuç: (a) `yulalab.com/links` ve `links.yulalab.com` aynı içeriği sunuyor → yinelenen içerik (duplicate content) SEO riski; (b) iki kopyayı elde tutma / sürüklenme (drift) yükü. Kanonik tek yüzey + redirect/canonical kararı gerekli. Kısa-link redirect'leri (`/bf`, `/lo`...) KORUNMALI.

### C. Uyum / yasal
- **[B-8] Terms of Service / EULA sayfası YOK.** Footer legal yalnızca Privacy + Support. Şemsiye site paylaşımlı bir Terms/EULA barındırmalı — hem standart bir kurumsal ihtiyaç hem de **Apple 3.1.2(c) EULA linki** (Burun Farkı bu eksikten reddedilmişti). Tek sayfa üç uygulamaya hizmet eder.
- **[B-9] Burun Farkı sorumlu-oyun ifşası (P1).** Markanın kendi kuralı: her BF paylaşımında zorunlu footer `18+ · Yeşilay 182 · yesilay.org.tr`. Umbrella sitedeki BF showcase/privacy'de açık 18+/sorumlu-oyun satırı yok. BF'nin store red geçmişi + markanın kendi kuralı göz önüne alınınca eklenmesi ihtiyatlı.

### D. Ölçüm / SEO
- **[B-10] Analitik YOK (P1).** Hiçbir analytics paketi kurulu değil (ne Vercel Analytics ne Plausible). Şemsiye sitenin işlevi (mağazaya giden tıklamalar, çapraz-ürün keşfi, basın) HİÇ ölçülemiyor. CSP zaten Vercel Analytics'i önceden yetkilendirmiş. Gizlilik metinleriyle ("analitik minimum, onay-gated") tutarlı, gizlilik-dostu bir araç seçilmeli.
- **[B-11] Yapısal veri (JSON-LD) YOK (P2).** Organization / WebSite / per-proje SoftwareApplication schema.org işaretlemesi yok. Klasik SEO + AI-arama (cevap motoru) görünürlüğü için kolay kazanç.
- **[B-12] İçerik motoru yok (P2).** 8 rota, statik. Organik büyüme için içerik yüzeyi yok. "Şeffaf inşaat" sesiyle birebir örtüşen hafif bir changelog/notes katmanı hem SEO hem çapraz-ürün keşfi sağlar (Bölüm 4 kararına bağlı).

### E. Olumlu bulgular (bozma)
- Null-link temizliği, KVKK/GDPR gizlilik içeriği, güvenlik başlıkları, dinamik OG, hreflang/canonical, reduced-motion, ikon-buton aria-label'ları — hepsi sağlam. Burun Farkı Türkiye-only KASITLI (değiştirme).

---

## 3) Öncelik Sıralı Görev Listesi

> Etiket anlamı: **[OPUS]** = nüanslı yargı / marka-ses / yasal-uyum ifadesi / konumlandırma / dürüst-metrik uzlaştırması. **[SONNET]** = net karardan sonra mekanik uygulama.
> Kural (vault): "Tahmin yapma." Tüm mağaza URL/durumları ASC (app-publish MCP) / Play / canlı store'dan DOĞRULANIR; kullanıcı teyit eder. Production'a dokunmak (deploy) her zaman USER onayı ister.

### P0 — Marka bütünlüğü & doğruluk (dürüstlük sözünü çiğneyen / olgusal yanlış)
- **[P0-1] [OPUS] LifeOS "yakında→canlı" uzlaştırması.** Karar: LifeOS'un yeni durumu (iOS canlı) + App Store URL'si (DOĞRULA, tahmin etme). Sonra tüm yüzeylerde tek elden düzelt: `projects/lifeos.ts` status + links; `links.yulalab.com` ve `public/links` `lo` bloğu ("Coming soon · Waitlist"). Metin/konumlandırma OPUS; URL teyit sonrası uygulama SONNET.
- **[P0-2] [OPUS] Konum gerçeği.** Karar: İstanbul mu, Kayseri mi, yoksa nötr "Türkiye" mi? Privacy veri-sorumlusu konumu + footer + contact + koordinatlar + OG. KVKK doğruluğu vs solo-founder mahremiyeti dengesi (Bölüm 4).
- **[P0-3] [OPUS] Dürüst-metrik uzlaştırması.** BF (ve gerekiyorsa diğer) sayılarının kanonik, güncel, savunulabilir kaynağı belirlensin; tazeleme ritmi tanımlansın. Şeffaflık markası eski sayı gösteremez.
- **[P0-4] [SONNET] Mağaza linki tazeliği (teyit sonrası).** Braavolabs App Store id doğrula; Burun Farkı Play linki ekle (canlı URL teyidiyle); BF App Store linki EKLEME (henüz canlı değil).

### P1 — Güven/uyum omurgası + ölçüm
- **[P1-1] [OPUS] Paylaşımlı Terms of Service / EULA sayfası** (footer legal). Apple 3.1.2(c) için de EULA linki görevi görür. Üç ürün için ortak. "Hukuki tavsiye değil; founder gözden geçirir" notu.
- **[P1-2] [OPUS] Burun Farkı sorumlu-oyun ifşası** (`18+ · Yeşilay 182 · yesilay.org.tr`) — BF showcase + privacy'ye; markanın kendi zorunlu-footer kuralıyla ve store riskiyle uyumlu.
- **[P1-3] [SONNET] Gizlilik-dostu analitik** (Vercel Analytics veya Plausible). Ölçülecek olay: outbound-click (mağaza/ürün), page_view, çapraz-ürün geçişi. CSP zaten hazır. Privacy metinleriyle ("minimal, onay-gated") tutarlı kalmalı.
- **[P1-4] [SONNET] JSON-LD yapısal veri** — Organization + WebSite (+ arama kutusu) + per-proje SoftwareApplication. SEO/AI-arama görünürlüğü.
- **[P1-5] [SONNET] Footer sosyal linkleri** — `company.socials`'ı render et; ÖNCE hesapların var olduğunu doğrula.

### P2 — Tutarlılık, SEO derinliği, içerik motoru
- **[P2-1] [SONNET] Links ikizlenmesini çöz.** Kanonik yüzeyi seç; `yulalab.com/links` için redirect→links.yulalab.com veya canonical; ideali: birini diğerinden üret (manuel drift'i bitir). Kısa-link redirect'lerini koru.
- **[P2-2] [SONNET] Ölü i18n / prototip-metin temizliği** (`landing.bannerDrop` vb.). "Mockup estetiği" kalacak mı → marka kararı (Bölüm 4); karar sonrası uygula.
- **[P2-3] [OPUS] İçerik/changelog katmanı** (Bölüm 4 kararına bağlı) — hafif MDX/flat `/notes` veya `/changelog`; build-in-public + SEO + çapraz-ürün keşfi. Ağır CMS değil.
- **[P2-4] [SONNET] Sayfa-bazlı metadata derinliği** — manifesto/transparency/projects-index için özgün title/description/canonical gözden geçir; links sayfası OG (banner) yeterli.
- **[P2-5] [SONNET] "Yula" isim-hikâyesi** manifesto/about'a — "yol gösteren ışık" + "Lab = keşif". Marka anlatısını güçlendirir (içerik).

---

## 4) Kullanıcıya Sorulacak Kararlar

1. **Site kimliği (ANA KARAR — marka vitrini senin).** Yulalab.com ne olsun?
   (a) Mevcut minimal showcase olarak kalsın; (b) "Kanıt & güven merkezi" — canlı ürün dizini + ortak yasal/güven omurgası + hafif build-in-public changelog (ÖNERİLEN); (c) lead-gen/press/talent hub; (d) SEO-odaklı içerik motoru. Öneri: **(b)**.
2. **Konum:** Privacy/footer/contact "İstanbul" mu kalsın, "Kayseri" olarak mı düzeltilsin, yoksa nötr "Türkiye" mi? (KVKK doğruluk ↔ solo-founder ev-şehri mahremiyeti.)
3. **LifeOS mağaza durumu & URL:** iOS App Store URL'si (ve varsa güncel durum) — canlı listeleme linkini paylaş/teyit et ki tahmin etmeyelim.
4. **Burun Farkı Play linki:** Üretim linki eklensin mi, hangi URL? (BF Türkiye-only kasıtlı — korunacak.)
5. **Dürüst-metrik:** BF için sitede gösterilecek kanonik sayı seti hangisi olsun (ör. güncel v4 ~%69 çerçevesi mi, mevcut Top-1/Brier mi)? Kaynak ve tazeleme ritmi?
6. **"Mockup/prototip" estetiği** (banner-spec etiketleri, placeholder-stripes) kasıtlı marka dili mi, yoksa emekliye mi ayrılsın?
7. **Analitik aracı:** Vercel Analytics mı, Plausible mı (gizlilik-dostu tercih)?
8. **Terms/EULA:** Standart app-store EULA temeli yeterli mi, yoksa avukat gözden geçirmesi mi istiyorsun?
9. **Sosyal hesaplar:** x/linkedin/instagram/@yulalab hesapları canlı mı (footer'a bağlamadan önce teyit)?

---

## 5) Bu Site İçin "Production-Ready" Tanımı

Site şu koşulların HEPSİ sağlandığında "production-ready" sayılır:
1. **Sıfır eski/yanlış iddia** — hiçbir canlı ürün "yakında" göstermiyor; her durum gerçekle örtüşüyor; her metrik güncel ve kaynaklı.
2. **Sıfır ölü link/buton** — her outbound link 200 dönüyor; null'lar render edilmiyor (zaten iyi); footer/sosyal/links.html tümü doğrulanmış.
3. **Yasal omurga tam** — Privacy (ürün başına ✓), Terms/EULA (yeni), Support (✓), doğru veri-sorumlusu kimliği + konumu, KVKK/GDPR.
4. **i18n** — TR+EN tam parite, sızan çeviri yok, ölü anahtar yok.
5. **SEO** — sitemap/robots/canonical/hreflang (✓) + Organization/WebSite/SoftwareApplication JSON-LD + dürüst meta.
6. **Ölçüm** — gizlilik-dostu analitik canlı ve gizlilik metniyle tutarlı.
7. **A11y/perf** — Lighthouse ≥95 (a11y/best-practices/SEO); reduced-motion (✓), klavye/odak (✓), kontrast AA (hem koyu ana site hem açık links sayfası).
8. **Tek kanonik links yüzeyi** — yinelenen içerik ve manuel drift yok.
9. **Yeşil kapılar** — `pnpm build` + `pnpm typecheck` + `pnpm lint` temiz; link-check temiz; iki dil de render oluyor.

Tek cümlelik: *Dürüstlük markasına yakışır biçimde — her iddiası güncel ve doğru, her linki canlı, yasal omurgası tam, ölçülebilir ve iki dilde kusursuz render olan bir vitrin.*

---

## 6) Gerekli Testler / Doğrulama Planı

> Bu oturumda hiçbir test ÇALIŞTIRILMADI (salt-okunur keşif). Aşağısı, uygulama oturumu için doğrulama reçetesidir. Kod-çalıştırma/build yalnızca o oturumda, kullanıcı onayıyla.

**Statik kapılar (her PR'da):**
- `pnpm build` · `pnpm typecheck` · `pnpm lint` → hepsi yeşil (uygulama oturumunda).

**Link bütünlüğü:**
- Otomatik outbound-link kontrolü: her `ProjectLink.href` + footer/sosyal + `links.html` butonları → 200. Null render edilmediğini assert et.

**i18n paritesi:**
- Script: `tr.json` ↔ `en.json` anahtar kümesi eşit. Hardcoded string taraması (grep). Kullanılmayan anahtar taraması (ör. `bannerDrop`).

**Mağaza-gerçeği (tahmin yok):**
- Her proje status ↔ gerçek store durumu (ASC / app-publish MCP / Play / canlı listeleme). Her mağaza URL'si doğru listelemeye çözülüyor.

**SEO doğrulaması:**
- `sitemap.xml` tüm rotaları içeriyor; `robots.txt` çözülüyor. JSON-LD için Rich Results testi. Her sayfada canonical + hreflang. OG görselleri render oluyor (varsayılan + `/projects/[slug]/opengraph-image`).

**Uyum doğrulaması:**
- Terms/EULA footer'dan erişilebilir + her uygulamanın store metadata'sına (özellikle Apple 3.1.2) linklenebilir. Privacy veri-sorumlusu kimliği + konumu doğru. BF sorumlu-oyun satırı mevcut.

**Analitik doğrulaması:**
- Olaylar tetikleniyor (outbound-click, page_view). Privacy metni gerçek analitik davranışıyla örtüşüyor.

**Çapraz-yüzey tutarlılığı:**
- `links.yulalab.com` ile `yulalab.com/projects` iddiaları örtüşüyor (durum, handle, URL).

**Manuel QA matrisi:**
- TR+EN × mobil/masaüstü × açık(links)/koyu(ana). Lighthouse ≥95 × 4 kombinasyon.

**Regresyon koruması:**
- `data/projects/*.ts` değişince: build + link-check + sitemap diff tekrar.

---

## 7) Riskler

- **Mağaza URL/durumu tahmini → yanlış iddia** (dürüstlük markasını çiğner). Azaltım: ASC/Play/canlı store'dan doğrula; kullanıcı teyit eder.
- **Konum düzeltmesi (İstanbul→Kayseri)** yasal/privacy doğruluk ↔ solo-founder ev-şehri mahremiyeti ödünleşimi. Kullanıcı kararı.
- **Analitik ↔ "izleme yok/minimal, onay-gated" gizlilik sözü.** Gizlilik-öncelikli araç seç, metni dürüst tut.
- **Terms/EULA hukuk-bitişik.** Standart app-store EULA temeli kullan; "hukuki tavsiye değil", founder gözden geçirir.
- **Links dedup redirect'i mevcut kısa-linkleri kırabilir** (`/bf`, `/lo`...). Redirect'leri koru.
- **Blog/CMS'e scope kayması** → "otomatize/ölçeklenebilir" vizyonuna aykırı bakım yükü. İçerik katmanını hafif tut (MDX/flat).
- **"Mockup estetiği" bir zevk kararı; sahibi founder.** Tek taraflı soyma.
- **Burun Farkı Türkiye-only KASITLI** — değiştirme; ajanlar commit/push YAPMAZ.

---

## 8) Tasarım & Galeri Yol Haritası (Tasarım Paneli — 2026-07-09)

> Kaynak: çok-mercekli tasarım paneli (visual-polish-critic + design-systems-architect + brand-identity-designer + adversarial doğrulama: design-review-auditor). `visual-polish-critic` siteyi yerel dev'de 1440px render edip ekran görüntüsüyle teşhis etti; diğer mercekler kodu sayarak doğruladı. (Not: uiux-galeri-IA merceği structured-output limitine takılıp düştü; alanı diğer üç merceğin "galeri düzeni" çıktıları + auditor sıralaması tarafından kapsandı.)

### 8.1 Ana sonuç: bu bir REDESIGN değil
Dört mercek bağımsız olarak aynı iki kök nedene yakınsadı ve ikisi de kodda birebir doğrulandı. Sistem (Manrope/Inter tipografi, boşluk ölçeği, ink grayscale rampası, motion, reduced-motion) ZATEN sağlam ve tutarlı. Site "ucuz" değil — **"yarım/prototip"** görünüyor. Squint testinde showcase'de ekranın en parlak öğesi, en az bilgi taşıyan (boş) placeholder kutu.

**Kök neden 1 — Ölü feature ikonları.** `src/data/projects/*.ts` içinde her feature'ın Lucide `icon` adı yazılı (`Lock`, `Cpu`, `Eye`, `Database`, `Network`…) ama `ProjectShowcase.tsx` içindeki `FeatureCard` (satır ~437-444) `f.icon`'u HİÇ okumuyor; yalnızca `background: p.brand.gradient` olan boş bir kare basıyor. Sonuç: her showcase'de 6 birebir aynı boş renkli kare. İkon altyapısı zaten var (`BrandPill` → `LINK_ICON`), sadece feature'a bağlanmamış. Saf kablolama boşluğu; "bitmemiş" hissinin 1 numaralı görsel tetikleyicisi.

**Kök neden 2 — Sıfır ürün kanıtı.** `ProjectHeroCard` (satır ~461-511) hiçbir zaman `p.visuals.screenshots`/`banner` kullanmıyor; her üç ürün için aynı gradient + dev monogram harfi + `placeholder-stripes` (görsel yuvası tarama deseni) render ediyor. `lifeos.screenshots=[]`, `braavolabs.screenshots=[]`; sadece BF'de tekrar tekrar kullanılan bir stok at fotoğrafı var. Bir "proje galerisi"ni galeri yapan şey işi göstermesidir; şu an iş yerine placeholder sergileniyor — bu, markanın "gösterdiğim her şey çalışır" dürüstlük sözünü de zayıflatıyor. Ayrıca `ProjectShowcase` içinde `screenshots` dizisini render eden HİÇBİR bölüm yok → varlık gelse bile gösterecek slot yok (çift katman boşluk).

**Auditor'ın dürüst düzeltmesi (mutlaka dikkate al):** "zaten üretilmiş varlığı sıfır maliyetle taşı" iddiası fazla iyimser. Repoda tek bir gerçek ÜRÜN ekran görüntüsü yok (`public/projects/` altında yalnız icon/logo/og + BF stok at fotoğrafı). Store'a yüklenmiş görseller çoğu zaman pazarlama-çerçeveli (cihaz + kopya overlay) gelir, temiz cihaz-çerçevesi estetiğine düşmez; LifeOS mobil-only (Playwright ile alınacak web'i yok). Yani bu "üret/hasat" işi: iki canlı-web ürün (braavolabs.com + burunfark.com → Playwright/Chrome MCP) ucuz; LifeOS store/simülatörden çekilmeli, gecikebilir (status-gate bunu dürüstçe örter).

### 8.2 İkincil bulgular (doğrulandı)
- **Accent enflasyonu (P1):** Showcase'de marka rengi eşzamanlı 12+ yerde (eyebrow noktası + tüm hero kartı + primary buton + 4 stat sayısı + 6 feature karesi) → tek odak yok, sayfa yeknesak parlıyor. BF kendi "gold = tek vurgu" kuralını çiğniyor.
- **İki ayrı kart sistemi (P2):** Aynı 3 ürün landing'de kompakt `ProjectCard`, `/projects`'te dev `BigProjectCard` ile gösteriliyor; ikincisi bilgi taşımayan monogram bloğu. Tek bileşene indirilmeli.
- **İsimlendirilmiş yüzey/hairline token'ı yok (P3, bakım):** ~15 ham beyaz-alfa değeri elde doğaçlanıyor (`white/10`, `white/[0.04]`, `white/15`…) + showcase'te ~25 inline `foreground + "XX"` birleştirmesi (15 farklı alfa). Kartlar her kullanımda "hangi saydamlık" kararını yeniden veriyor.
- **Tipografik ölçek token'ı yok (P3, bakım):** 172 keyfî `text-[Npx]`, 37 farklı değer. Rule-of-three delinmiş; ölçek token olmadan her yeni yüzey boyut tahmin ediyor.
- **Eyebrow 59 kez inline tekrarlanıyor (P3):** `EyebrowChip` var ama showcase kullanmıyor.
- **Stat ritmi (P2):** `AES-256` tek-glif `5`/`0` ile aynı 64px'te tırtıklı; stat sayıları display fontta, tabular değil.
- **Tekrar eden link satırı (P2):** Showcase hero link-pill'leri ile alttaki "Bağlantılar" section birebir aynı 4 pill'i tekrarlıyor.

### 8.3 Doğrulanmış uygulama sırası (dalgalar)

| Dalga | İş | Etiket | Efor |
|---|---|---|---|
| **0 — hemen (sıfır varlık bağımlılığı, yüksek algı)** | Feature ikon kayıt defteri: `icons.tsx`'e string→Lucide `FEATURE_ICON` haritası; `FeatureCard`'daki boş gradient kareyi kaldır, `f.icon`'u nötr yüzey (foreground+08) + tek-renk çizgi ikonla render et (marka rengi değil). Bilinmeyen ikon adı build'i kırsın. | [SONNET] | S |
| **1 — galeriyi galeri yapan** | (a) `PhoneFrame` + `BrowserFrame` bileşenleri (ince bezel, parlaklık yok, ink kenarlık). (b) `ProductShot` medya bileşeni (sabit oranlar telefon 9/19.5 · web 16/10, tutarlı hairline-strong kenar, TEK elevation dili — koyu temada ambient ring + hafif glow, drop-shadow yok). (c) `ProjectShowcase`'e HERO'dan sonra görsel render slotu + pitch↔features arası "kanıt şeridi" (3-5 gerçek ekran görüntüsü, yatay scroll-snap, lightbox yok, CMS yok). (d) Hero kartını **status-gate** et: gerçek görsel varsa `ProductShot`'a düş, yoksa (yalnız herkese açık build'i olmayan üründe) mevcut monogram-placeholder = bilinçli "henüz değil" sinyali. (e) Varlık hasadı: önce ucuz web (Playwright/Chrome MCP → braavolabs.com + burunfark.com); BF stok atını gerçek "karar gerekçesi/SHAP" dashboard ekranıyla değiştir; LifeOS store/simülatörden. | [OPUS yön + SONNET uygulama; varlık = founder] | L |
| **2 — odak/tutarlılık (kısmen zevk)** | Accent diyeti: `StatBlock` sayılarını marka renginden yüksek-kontrast nötr foreground + tabular rakama çevir; feature kareleri nötr; marka rengini yalnız 1-2 momente sakla (primary CTA + tek hero vurgusu). Artboard estetiği kararını uygula. Tekrar eden link satırını tekilleştir. | [OPUS] | M |
| **3 — bakım (FIRSATÇI, bloklayıcı DEĞİL)** | surface/hairline token katmanı (`tailwind.config.ts`'e surface / surface-raised / surface-inset / hairline / hairline-strong; ~15 ham alfa + ~25 inline birleştirmeyi migrate et). Eyebrow + SectionHeader bileşeni (59 inline'ı konsolide et). Landing + /projects'i tek kart bileşenine indir. **Tipografi ölçeği migrasyonu EN SONA ve artımlı — asla büyük-patlama** (görsel-regresyon testi yok; landing ölçeğini önce token'a DONDUR, dosyaya dokundukça göç ettir). | [SONNET] | M |
| **Atlanan** | Dinamik `@vercel/og` kartı — statik og.png (braavolabs+burunfarki'de zaten diskte) yeterli; 3 ürün nadiren değişiyor. Bir büyüme/paylaşım hamlesi gelene kadar ertele; LifeOS için tek seferlik statik og.png yeter. | — | — |

### 8.4 Founder'ın karar vermesi gerekenler (zevk/marka)
1. **Artboard/prototip estetiğinin kaderi:** (A) kasıtlı marka aracı olarak KAL → tek bir `.artboard` treatment + tutarlı köşe-etiket bileşenine sistemleştir, yalnız gerçek build'i olmayan üründe "henüz değil" sinyali; VEYA (B) bir ürün canlı olur olmaz o ürün için OTOMATİK emekli. Ortası olmasın (belirsizlik "özensizlik" okunuyor). **AI ile sahte/var olmayan UI ekranı üretmek KESİN YASAK** — markanın "gösterdiğin her şey çalışır" çekirdeğiyle doğrudan çelişir. AI yalnız kompozisyon (OG arka planı, soyut ikon illüstrasyonu) için; gerçek ekranı çerçeveye yerleştirmek serbest, var olmayanı "varmış gibi" üretmek değil.
2. **Dark-only kalmak vs açık/aydınlık vitrin:** Öneri **dark-only KAL** (3 üründe de koyu kimlik + tek test yüzeyi + dürüstlük/craft mood'u; talep sinyali yok, açık tema test yüzeyini ×2 yapar). Tema kimliği founder onay kapısı.
3. **Accent diyetinin nihai dengesi:** Odağı netleştirir ama per-ürün renk marka sisteminin parçası — tamamen sterilize riski. Ne kadarın (monogram + tek hero momenti + hover kenarı) kalacağı zevk kararı.
4. **Cihaz-çerçevesi mi bezel-siz mi** ve her ürünü hangi somut ekranın temsil edeceği (özellikle BF için hero = SHAP/karar-gerekçesi ekranı, coşku-çağrıştıran at değil).
5. **Index roster'ında monogram kart kalsın mı** (öneri: EVET; 3'lü grid'de küçük screenshot gürültü olur).

### 8.5 Riskler
- **Varlık gerçeği:** Repoda 0 ürün screenshot'ı. "Hemen taşı" değil "önce üret/hasat"; LifeOS mobil-only → store/simülatör, gecikebilir (status-gate dürüstçe örter).
- **Lokalizasyon:** Ekran görüntüleri tek dil UI taşır; EN sayfasında TR-arayüzlü screenshot tutarsız. Per-locale set veya dil-nötr kadraj gerekir (solo için tekrarlayan bakım).
- **Bayatlama/rot:** Ürün UI değişince eski screenshot YENİ bir dürüstlük açığına döner. Hafif tazeleme disiplini şart.
- **Token migrasyon regresyonu:** Görsel-regresyon testi yok; büyük refactor iyi görünen ritmi sessizce bozabilir. Artımlı git.
- **Accent diyeti aşırıya kaçarsa** showcase düzleşir, per-ürün kimlik kaybolur.
- **Koyu görsel/koyu zemin:** Braavolabs dark screenshot #0A0A0B üstünde ayrışmaz → `ProductShot`'ta hairline + ambient ring/glow (drop-shadow koyu temada ölür).

### 8.6 "Production-Ready" tanımına eklenecek görsel maddeler
- Her showcase'de gerçek feature ikonları (boş kare yok).
- En az bir canlı ürün için gerçek ekran görüntüsü kanıt şeridi + status-gate'li hero.
- Accent kontrollü doz (squint testinde tek net odak).
- Tek kart sistemi; tek elevation dili; artboard estetiği için net (belgeli) karar.

---
*Bu belge bir plandır. Uygulama, kullanıcı onayıyla ayrı bir oturumda başlar. Geri-alınamaz her adım (deploy/mağaza) USER onayı ister.*
