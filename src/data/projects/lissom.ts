import type { ProjectConfig } from "@/lib/types";

export const lissom: ProjectConfig = {
  slug: "lissom",
  name: "Lissom",
  monogram: "LS",
  kind: ["mobile"],
  status: "coming-soon",
  category: {
    tr: "Esneklik & Mobilite Koçu",
    en: "Flexibility & Mobility Coach",
  },
  tagline: {
    tr: "Kısa pratiklerle hareket alışkanlığı kur.",
    en: "Build a movement habit with short practice.",
  },
  description: {
    tr: "Lissom'un ilk sürümü, Hatha yoga kursuyla okuma ve pratik adımları sunar. Kurs ilerlemesi cihazda öz bildirimle kaydedilir; kamera ölçümü, beceri puanı veya otomatik yeniden test değildir. Kamera koçluğu ve ücretli satış ilk sürümde kapalıdır.",
    en: "Lissom's first release offers reading and practice steps through a Hatha yoga course. Course progress is saved on the device by self-report; it is not a camera measurement, skill score or automatic re-test. Camera coaching and paid sales are disabled in the first release.",
  },
  short: {
    tr: "Hatha yoga kursu ve cihazda öz bildirimli ilerleme. İlk sürümde kamera koçluğu ve ücretli satış kapalıdır.",
    en: "A Hatha yoga course with on-device, self-reported progress. Camera coaching and paid sales are disabled in the first release.",
  },
  brand: {
    primary: "#6EE7C8",
    secondary: "#B9A6FF",
    accent: "#FFD1E8",
    background: "#070A0C",
    foreground: "#EDF3F1",
    gradient: "linear-gradient(135deg, #6EE7C8 0%, #B9A6FF 55%, #FFD1E8 100%)",
    glow: "0 0 70px -10px rgba(110,231,200,0.4)",
    fontDisplay: "Inter, sans-serif",
    fontBody: "Inter, sans-serif",
    fontMono: '"JetBrains Mono", ui-monospace, monospace',
    mood: "silk-and-breath",
  },
  visuals: {
    logo: "/projects/lissom/logo.png",
    screenshots: [],
  },
  features: [
    {
      title: { tr: "Hatha yoga kursu", en: "A Hatha yoga course" },
      description: {
        tr: "Kursun okuma ve pratik adımlarını kamera veya mikrofon izni olmadan izlersin.",
        en: "Follow the course's reading and practice steps without camera or microphone permission.",
      },
      icon: "Eye",
    },
    {
      title: { tr: "Pratik adımları", en: "Practice steps" },
      description: {
        tr: "Ders metinleri ve pratik adımlarıyla çalışırsın; kamera ölçümünden otomatik kişisel program üretilmez.",
        en: "Work with lesson text and practice steps; no personal routine is generated automatically from a camera measurement.",
      },
      icon: "Sparkles",
    },
    {
      title: { tr: "Öz bildirimli ilerleme", en: "Self-reported progress" },
      description: {
        tr: "Okuma, pratik ve tamamlanmayı kendin kaydedersin. Bu kayıtlar bu cihazda tutulur; hareket kapasitesi ölçümü değildir.",
        en: "Record reading, practice and completion yourself. These records stay on this device; they are not range-of-motion measurements.",
      },
      icon: "TrendingUp",
    },
    {
      title: { tr: "Kamera sonraki aşamada", en: "Camera at a later stage" },
      description: {
        tr: "Kamera tabanlı mobilite geri bildirimi sonraki aşama hedefidir; ilk sürümde kamera koçluğu kapalıdır.",
        en: "Camera-based mobility feedback is a goal for a later stage; camera coaching is disabled in the first release.",
      },
      icon: "Microscope",
    },
  ],
  stats: [
    { value: "···", label: { tr: "Lansman", en: "Launch" } },
    {
      value: "Hatha",
      label: { tr: "İlk kurs", en: "First course" },
    },
  ],
  vision: {
    tr: "Esnekliği bir yetenek değil, ölçülüp geliştirilebilen bir alışkanlık haline getirmek.",
    en: "Turn flexibility from a talent into a habit you can measure and build.",
  },
  mission: {
    tr: "Yoga pratiğini anlaşılır dersler ve sürdürülebilir çalışma alışkanlıklarıyla desteklemek.",
    en: "Support yoga practice with clear lessons and sustainable practice habits.",
  },
  order: 5,
  links: [],
};
