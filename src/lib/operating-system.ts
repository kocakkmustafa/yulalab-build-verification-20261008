import { publicRegistry } from "@/data/public-registry";
import { isExpired } from "@/lib/public-registry";
import { caseStudies } from "@/data/case-studies";
import type { EvidenceKind } from "@/lib/types";

/**
 * The Operating System page's numbers, DERIVED rather than written.
 *
 * Roadmap §4.5 asks for "real artifacts, not process theatre". A page that
 * describes how we stay honest is the last place a hand-typed count belongs:
 * the moment a claim is added, a prose number goes stale and the page starts
 * lying about the very discipline it documents. Everything below is computed
 * from the same registry the rest of the site renders from, so the page
 * cannot drift from reality without the reality changing.
 */

/**
 * Evidence levels. These are the registry's own `evidenceKind` values,
 * ordered by how much independent checking stands behind them — K0 is our
 * own word, K3 is somebody else's. Naming them is not decoration: it is
 * what lets a reader tell "we read the runtime code and counted" apart from
 * "our marketing copy says so", which are otherwise both just "a claim".
 */
export const EVIDENCE_LEVELS: {
  level: "K0" | "K1" | "K2" | "K3";
  kind: EvidenceKind;
  labelTr: string;
  labelEn: string;
  meaningTr: string;
  meaningEn: string;
}[] = [
  {
    level: "K0",
    kind: "self-reported",
    labelTr: "Kendi beyanımız",
    labelEn: "Self-reported",
    meaningTr:
      "Ürünün kendi verisi böyle diyor; bu oturumda bağımsız olarak yeniden kontrol edilmedi. En zayıf seviye — güçlüymüş gibi gösterilmez.",
    meaningEn:
      "The product's own data says so; nobody independently re-checked it. The weakest level — and it is never dressed up as more.",
  },
  {
    level: "K1",
    kind: "source-code-verified",
    labelTr: "Kaynak kodda doğrulandı",
    labelEn: "Source-code verified",
    meaningTr: "Çalışan kod okundu ve sayıldı; iddia kodun kendisine dayanıyor.",
    meaningEn: "The runtime code was read and counted; the claim rests on the code itself.",
  },
  {
    level: "K2",
    kind: "measured",
    labelTr: "Ölçüldü",
    labelEn: "Measured",
    meaningTr: "Gerçek bir ortamda çalıştırılıp ölçüldü; sonuç tarihiyle kaydedildi.",
    meaningEn: "Run against a real environment and measured; the result is recorded with its date.",
  },
  {
    level: "K3",
    kind: "third-party-verified",
    labelTr: "Üçüncü tarafça doğrulandı",
    labelEn: "Third-party verified",
    meaningTr: "Bizim dışımızda biri doğruladı.",
    meaningEn: "Confirmed by someone outside YULA.",
  },
];

export function evidenceCounts(): Record<EvidenceKind, number> {
  const counts: Record<EvidenceKind, number> = {
    "self-reported": 0,
    "source-code-verified": 0,
    measured: 0,
    "third-party-verified": 0,
  };
  for (const record of publicRegistry) {
    for (const claim of record.claims) counts[claim.evidenceKind] += 1;
  }
  return counts;
}

export type LifecycleRow = {
  key: "live" | "beta" | "research" | "archived";
  labelTr: string;
  labelEn: string;
  effectTr: string;
  effectEn: string;
  count: number;
};

/**
 * The product state machine, with what each state MECHANICALLY changes —
 * not what it connotes. A state that changes nothing is a label, and this
 * page would be theatre for listing it as a stage.
 */
export function lifecycleRows(): LifecycleRow[] {
  const count = (k: LifecycleRow["key"]) =>
    publicRegistry.filter((r) => r.lifecycle === k).length;
  return [
    {
      key: "live",
      labelTr: "Yayında",
      labelEn: "Live",
      effectTr:
        "Ürün dizininde önce gelir; her ekran görüntüsü sourceBuild ve capturedAt taşımak zorundadır, yoksa build düşer.",
      effectEn:
        "Sorts first on the product index; every screenshot must carry sourceBuild and capturedAt or the build fails.",
      count: count("live"),
    },
    {
      key: "beta",
      labelTr: "Beta",
      labelEn: "Beta",
      effectTr: "Yayındakilerle aynı kanıt kuralları; dizinde onlardan sonra sıralanır.",
      effectEn: "Same evidence rules as live; sorts after it on the index.",
      count: count("beta"),
    },
    {
      key: "research",
      labelTr: "Araştırma",
      labelEn: "Research",
      effectTr:
        "Ayrı bir bölümde, kapalı açılır blok içinde gösterilir ve birincil bağlantısı bir mağaza adresine çıkamaz — indirilemeyen bir ürüne indirilebilirmiş görüntüsü verilemez.",
      effectEn:
        "Rendered in its own collapsed section, and its primary link may not point at a store URL — a product you cannot download must not look downloadable.",
      count: count("research"),
    },
    {
      key: "archived",
      labelTr: "Arşiv",
      labelEn: "Archived",
      effectTr:
        "Varsayılan ürün dizininden düşer; kaydı durur ama vitrinde yer almaz.",
      effectEn:
        "Drops out of the default product index; the record survives, the shelf space does not.",
      count: count("archived"),
    },
  ];
}

/**
 * How many surface (store/availability) assertions have passed their
 * verification window right now.
 *
 * Derived, never typed: the limitations section states this number, and a
 * hand-written "four" would rot the day someone re-verifies one — turning
 * the page that documents our honesty into the thing it warns about.
 */
export function lapsedSurfaceCount(now: Date): number {
  return publicRegistry.reduce(
    (n, record) =>
      n + record.surfaces.filter((s) => s.expiresAt && isExpired(s.expiresAt, now)).length,
    0,
  );
}

/**
 * The page states how many named false-statement patterns the prose scanner
 * watches for. Takes the ARRAY, not a re-parse of the file: the first
 * version re-implemented the scanner's own text parsing and then asserted
 * the two agreed, which cannot detect a wrong parser — proven by adding a
 * real 13th pattern at a different indentation, after which the scanner had
 * 13, the page printed 12, and every test stayed green.
 */
export function forbiddenPatternCount(patterns: readonly unknown[]): number {
  return patterns.length;
}

export function portfolioCounts() {
  return {
    products: publicRegistry.length,
    claims: publicRegistry.reduce((n, r) => n + r.claims.length, 0),
    surfaces: publicRegistry.reduce((n, r) => n + r.surfaces.length, 0),
    screenshots: publicRegistry.reduce((n, r) => n + r.screenshots.length, 0),
    caseStudies: caseStudies.length,
  };
}
