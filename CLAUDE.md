# CLAUDE.md — yulalab.com (Next.js 15)

YULA Lab şemsiye/vitrin sitesi — Braavolabs, Burun Farkı ve LifeOS'u sergiler. İki dilli (TR/EN), statik üretim. Kanonik program: `BITIRME-PROGRAMI.md` + `DEFTER.md` (bu dizinde). Vizyon/durum: `../VENTURE.md`.

## Komutlar
```bash
npm install
npm run dev        # next dev (--turbopack varyantı: dev:turbo)
npm run lint && npm run typecheck
npm run build      # üretim build'i — push öncesi yeşil olmalı
```

## Deploy — DİKKAT
- **Vercel prod dalı = `main`** → main'e push canlıya çıkar. Push öncesi kurucuya sor.
- (Karşıt örnek ekosistemde: burunfark-web'in prod dalı `develop` — iki kuralı karıştırma.)

## Bilinmesi gerekenler
- **Çapraz-iddia yüzeyi:** bu site diğer ürünlerin metrik/durumunu gösterir (BF doğruluk oranları, store rozetleri). Kaynak ürün değişince burası bayatlar — `holding/registry/connections.yaml` impact_rules'a bak.
- Tasarım kaynağına erişim yalnız `DesignSync` MCP ile (paylaşım linki 403 verir; `get_file` 256KiB'de keser).
- Y2 (gerçek ekran görüntüleri) kurucu kararıyla bekletiliyor; Y3 (Lighthouse/a11y) açık iş.
