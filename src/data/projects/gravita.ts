import type { ProjectConfig } from "@/lib/types";

export const gravita: ProjectConfig = {
  slug: "gravita",
  name: "Gravita",
  monogram: "G",
  kind: ["mobile"],
  status: "coming-soon",
  category: {
    tr: "Handstand & Vücut Becerileri Koçu",
    en: "Handstand, Bodyweight Skills & Strength Coach",
  },
  tagline: {
    tr: "Adım adım çalış, ilerlemeni kendin kaydet.",
    en: "Practice step by step and record your progress.",
  },
  description: {
    tr: "Gravita'nın ilk sürümü, handstand ve vücut ağırlığı becerileri için temel bir kursa odaklanır. Okuma, pratik ve öz bildirimli ilerleme cihazda kaydedilir; kamera beceri puanı veya ustalık onayı üretilmez. Kamera koçluğu ve ücretli satış ilk sürümde kapalıdır.",
    en: "Gravita's first release focuses on a foundation course for handstand and bodyweight skills. Reading, practice and self-reported progress are saved on the device; no camera skill score or mastery certification is produced. Camera coaching and paid sales are disabled in the first release.",
  },
  short: {
    tr: "Handstand ve vücut becerileri için kurs ve öz bildirimli ilerleme. İlk sürümde kamera koçluğu ve ücretli satış kapalıdır.",
    en: "A handstand and bodyweight-skills course with self-reported progress. Camera coaching and paid sales are disabled in the first release.",
  },
  brand: {
    primary: "#FF6A45",
    secondary: "#FFB199",
    accent: "#FFD166",
    background: "#0B0805",
    foreground: "#F5EFE8",
    gradient: "linear-gradient(135deg, #FF6A45 0%, #FFB199 55%, #FFD166 100%)",
    glow: "0 0 70px -10px rgba(255,106,69,0.4)",
    fontDisplay: "Inter, sans-serif",
    fontBody: "Inter, sans-serif",
    fontMono: '"JetBrains Mono", ui-monospace, monospace',
    mood: "forge-and-form",
  },
  visuals: {
    logo: "/projects/gravita/logo.png",
    screenshots: [],
  },
  features: [
    {
      title: { tr: "Temel beceri kursu", en: "A foundation skills course" },
      description: {
        tr: "Okuma ve pratik adımlarıyla çalışırsın; kursu kullanmak için kamera izni gerekmez.",
        en: "Work through reading and practice steps; the course does not require camera permission.",
      },
      icon: "Eye",
    },
    {
      title: { tr: "Öz bildirimli ilerleme", en: "Self-reported progress" },
      description: {
        tr: "Okuma, pratik ve tamamlanma kayıtları ayrıdır. Tamamlanma kendi bildiriminle kaydedilir; kamera beceri puanı değildir.",
        en: "Reading, practice and completion are separate records. Completion is saved by your own report; it is not a camera skill score.",
      },
      icon: "TrendingUp",
    },
    {
      title: { tr: "Cihazda analiz hedefi", en: "On-device analysis goal" },
      description: {
        tr: "Cihazda kamera geri bildirimi sonraki aşama hedefidir; ilk sürümde kamera koçluğu kapalıdır.",
        en: "On-device camera feedback is a goal for a later stage; camera coaching is disabled in the first release.",
      },
      icon: "Lock",
    },
    {
      title: { tr: "Cihazdaki çalışma kaydı", en: "On-device practice records" },
      description: {
        tr: "Kurs ilerlemen bu uygulamanın cihazdaki alanında tutulur; Motion hesabına eşitlenmez.",
        en: "Course progress stays in this app's local device storage; it is not synced to your Motion account.",
      },
      icon: "Microscope",
    },
  ],
  stats: [
    { value: "···", label: { tr: "Lansman", en: "Launch" } },
  ],
  vision: {
    tr: "Herkesin, kişisel bir hareket koçuna cebinden ulaşabildiği bir dünya.",
    en: "A world where everyone carries a personal movement coach in their pocket.",
  },
  mission: {
    tr: "Vücut becerisi pratiğini anlaşılır kurs adımları ve dürüst ilerleme kayıtlarıyla desteklemek.",
    en: "Support bodyweight-skills practice with clear course steps and honest progress records.",
  },
  order: 4,
  links: [],
};
