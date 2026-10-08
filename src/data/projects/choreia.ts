import type { ProjectConfig } from "@/lib/types";

export const choreia: ProjectConfig = {
  slug: "choreia",
  name: "Choreia",
  monogram: "CH",
  kind: ["mobile"],
  status: "coming-soon",
  category: {
    tr: "Global Dans Koçu",
    en: "Global Dance Coach",
  },
  tagline: {
    tr: "Salsa adımlarını kendi hızında çalış.",
    en: "Practise salsa steps at your own pace.",
  },
  description: {
    tr: "Choreia'nın ilk sürümü, solo Salsa On1 kursuna odaklanır. Okuma, pratik ve öz bildirimli tamamlanma cihazda kaydedilir; kamera beceri puanı veya dans ustalığı onayı üretilmez. Kamera koçluğu ve ücretli satış ilk sürümde kapalıdır.",
    en: "Choreia's first release focuses on a solo Salsa On1 course. Reading, practice and self-reported completion are saved on the device; no camera skill score or dance mastery certification is produced. Camera coaching and paid sales are disabled in the first release.",
  },
  short: {
    tr: "Solo Salsa On1 kursu ve öz bildirimli ilerleme. İlk sürümde kamera koçluğu ve ücretli satış kapalıdır.",
    en: "A solo Salsa On1 course with self-reported progress. Camera coaching and paid sales are disabled in the first release.",
  },
  brand: {
    primary: "#FF3DA6",
    secondary: "#7B5CFA",
    accent: "#4DE8FF",
    background: "#0A0710",
    foreground: "#F5EEF8",
    gradient: "linear-gradient(135deg, #FF3DA6 0%, #7B5CFA 55%, #4DE8FF 100%)",
    glow: "0 0 70px -10px rgba(255,61,166,0.4)",
    fontDisplay: "Inter, sans-serif",
    fontBody: "Inter, sans-serif",
    fontMono: '"JetBrains Mono", ui-monospace, monospace',
    mood: "stage-and-pulse",
  },
  visuals: {
    logo: "/projects/choreia/logo.png",
    screenshots: [],
  },
  features: [
    {
      title: { tr: "Solo Salsa On1 kursu", en: "A solo Salsa On1 course" },
      description: {
        tr: "Okuma ve pratik adımlarını kamera veya mikrofon izni olmadan izlersin.",
        en: "Follow reading and practice steps without camera or microphone permission.",
      },
      icon: "Eye",
    },
    {
      title: { tr: "Öz bildirimli ilerleme", en: "Self-reported progress" },
      description: {
        tr: "Okuma, pratik ve tamamlanma ayrı kayıtlardır. Tamamlanmayı kendin bildirirsin; kamera beceri puanı değildir.",
        en: "Reading, practice and completion are separate records. You report completion yourself; it is not a camera skill score.",
      },
      icon: "Microscope",
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
        tr: "Adım, zamanlama ve form için kamera geri bildirimi sonraki aşama hedefidir; ilk sürümde kapalıdır.",
        en: "Camera feedback on steps, timing and form is a goal for a later stage; it is disabled in the first release.",
      },
      icon: "Globe",
    },
  ],
  stats: [
    { value: "···", label: { tr: "Lansman", en: "Launch" } },
    {
      value: "Salsa",
      label: {
        tr: "İlk kurs · solo On1",
        en: "First course · solo On1",
      },
    },
  ],
  vision: {
    tr: "Herkesin, dünyanın her yerinden bir dans hocasına kendi salonunda ulaşabildiği bir dünya.",
    en: "A world where everyone can reach a dance teacher from anywhere, right in their own living room.",
  },
  mission: {
    tr: "Dans pratiğini anlaşılır kurs adımları ve dürüst ilerleme kayıtlarıyla desteklemek.",
    en: "Support dance practice with clear course steps and honest progress records.",
  },
  order: 8,
  links: [],
};
