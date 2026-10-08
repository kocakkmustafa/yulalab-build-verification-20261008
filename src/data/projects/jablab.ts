import type { ProjectConfig } from "@/lib/types";

export const jablab: ProjectConfig = {
  slug: "jablab",
  name: "JabLab",
  monogram: "JL",
  kind: ["mobile"],
  status: "coming-soon",
  category: {
    tr: "Solo Boks Koçu",
    en: "Solo Boxing & Shadow Training Coach",
  },
  tagline: {
    tr: "Gölge boksunu adım adım çalış.",
    en: "Practise shadow boxing step by step.",
  },
  description: {
    tr: "JabLab'ın ilk sürümü, temas içermeyen solo boks kursuna odaklanır. Okuma, pratik ve öz bildirimli tamamlanma cihazda ayrı kaydedilir; kamera beceri puanı veya teknik onay üretilmez. Kamera koçluğu ve ücretli satış ilk sürümde kapalıdır.",
    en: "JabLab's first release focuses on a non-contact solo boxing course. Reading, practice and self-reported completion are recorded separately on the device; no camera skill score or technique certification is produced. Camera coaching and paid sales are disabled in the first release.",
  },
  short: {
    tr: "Temas içermeyen solo boks kursu ve öz bildirimli ilerleme. İlk sürümde kamera koçluğu ve ücretli satış kapalıdır.",
    en: "A non-contact solo boxing course with self-reported progress. Camera coaching and paid sales are disabled in the first release.",
  },
  brand: {
    primary: "#FF3B3B",
    secondary: "#FF8A3B",
    accent: "#E8E8EC",
    background: "#0A0A0B",
    foreground: "#F2F0EE",
    gradient: "linear-gradient(135deg, #FF3B3B 0%, #FF8A3B 55%, #E8E8EC 100%)",
    glow: "0 0 70px -10px rgba(255,59,59,0.4)",
    fontDisplay: "Inter, sans-serif",
    fontBody: "Inter, sans-serif",
    fontMono: '"JetBrains Mono", ui-monospace, monospace',
    mood: "canvas-and-grit",
  },
  visuals: {
    logo: "/projects/jablab/logo.png",
    screenshots: [],
  },
  features: [
    {
      title: { tr: "Solo boks kursu", en: "A solo boxing course" },
      description: {
        tr: "Okuma ve temas içermeyen pratik adımlarını kamera veya mikrofon izni olmadan izlersin.",
        en: "Follow reading and non-contact practice steps without camera or microphone permission.",
      },
      icon: "Eye",
    },
    {
      title: { tr: "Öz bildirimli ilerleme", en: "Self-reported progress" },
      description: {
        tr: "Okuma, pratik ve tamamlanma ayrı kayıtlardır. Tamamlanmayı kendin bildirirsin; bu bir kamera beceri puanı değildir.",
        en: "Reading, practice and completion are separate records. You report completion yourself; it is not a camera skill score.",
      },
      icon: "BadgeCheck",
    },
    {
      title: { tr: "Cihazdaki çalışma kaydı", en: "On-device practice records" },
      description: {
        tr: "Kurs ilerlemen bu uygulamanın cihazdaki alanında tutulur; Motion hesabına eşitlenmez.",
        en: "Course progress stays in this app's local device storage; it is not synced to your Motion account.",
      },
      icon: "Sparkles",
    },
    {
      title: { tr: "Kamera sonraki aşamada", en: "Camera at a later stage" },
      description: {
        tr: "Gard, duruş, kombinasyon ve denge için kamera geri bildirimi sonraki aşama hedefidir; ilk sürümde kapalıdır.",
        en: "Camera feedback on guard, stance, combinations and balance is a goal for a later stage; it is disabled in the first release.",
      },
      icon: "Microscope",
    },
  ],
  stats: [
    { value: "···", label: { tr: "Lansman", en: "Launch" } },
    {
      value: "Solo",
      label: {
        tr: "İlk kurs · temas içermeyen boks",
        en: "First course · non-contact boxing",
      },
    },
  ],
  vision: {
    tr: "Antrenman arkadaşı olmadan da doğru geri bildirim alabildiğin bir solo boks pratiği.",
    en: "Solo boxing practice that gives you real feedback, even without a training partner.",
  },
  mission: {
    tr: "Solo boks pratiğini anlaşılır dersler ve dürüst ilerleme kayıtlarıyla desteklemek.",
    en: "Support solo boxing practice with clear lessons and honest progress records.",
  },
  order: 6,
  links: [],
};
