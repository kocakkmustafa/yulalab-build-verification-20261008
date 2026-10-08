import type { ProjectConfig } from "@/lib/types";

export const ostinato: ProjectConfig = {
  slug: "ostinato",
  name: "Ostinato",
  monogram: "O",
  kind: ["mobile"],
  status: "coming-soon",
  category: {
    tr: "Enstrüman Pratik Koçu",
    en: "Instrument & Music Practice Coach",
  },
  tagline: {
    tr: "Gitar pratiğini adım adım kur.",
    en: "Build your guitar practice step by step.",
  },
  description: {
    tr: "Ostinato'nun ilk sürümü, gitar kursu ve cihazda öz bildirimli ilerlemeye odaklanır. İstersen tek nota gözlemini başlatıp mikrofon izni verebilirsin; ses yalnız geçici cihaz belleğinde işlenir, kaydedilmez veya yüklenmez. Gözlem doğruluk ya da ustalık puanı üretmez; kurs mikrofonsuz tamamlanabilir. Kamera koçluğu ve ücretli satış ilk sürümde kapalıdır.",
    en: "Ostinato's first release focuses on a guitar course and on-device, self-reported progress. You can choose to start single-note observation and grant microphone permission; audio is processed only in temporary device memory, never recorded or uploaded. Observation does not produce a correctness or mastery score; the course can be completed without the microphone. Camera coaching and paid sales are disabled in the first release.",
  },
  short: {
    tr: "Gitar kursu, öz bildirimli ilerleme ve isteğe bağlı tek nota gözlemi. İlk sürümde kamera koçluğu ve ücretli satış kapalıdır.",
    en: "A guitar course, self-reported progress and optional single-note observation. Camera coaching and paid sales are disabled in the first release.",
  },
  brand: {
    primary: "#D8A657",
    secondary: "#8B5E3C",
    accent: "#E8C87A",
    background: "#0C0906",
    foreground: "#F1E9DC",
    gradient: "linear-gradient(135deg, #D8A657 0%, #E8C87A 55%, #8B5E3C 100%)",
    glow: "0 0 70px -10px rgba(216,166,87,0.4)",
    fontDisplay: "Inter, sans-serif",
    fontBody: "Inter, sans-serif",
    fontMono: '"JetBrains Mono", ui-monospace, monospace',
    mood: "wood-and-resonance",
  },
  visuals: {
    logo: "/projects/ostinato/logo.png",
    screenshots: [],
  },
  features: [
    {
      title: { tr: "Gitar kursu", en: "A guitar course" },
      description: {
        tr: "Okuma ve pratik adımlarıyla çalışırsın. Kurs kamera izni gerektirmez ve mikrofonsuz tamamlanabilir.",
        en: "Work through reading and practice steps. The course does not require camera permission and can be completed without the microphone.",
      },
      icon: "Eye",
    },
    {
      title: { tr: "İsteğe bağlı tek nota gözlemi", en: "Optional single-note observation" },
      description: {
        tr: "Mikrofonu sen başlatır ve işletim sistemi iznini sen verirsin. Yaklaşık nota gösterimi akor, zamanlama, doğruluk veya ustalık değerlendirmesi değildir.",
        en: "You start the microphone and grant operating-system permission. The approximate note display does not assess chords, timing, correctness or mastery.",
      },
      icon: "Microscope",
    },
    {
      title: { tr: "Öz bildirimli ilerleme", en: "Self-reported progress" },
      description: {
        tr: "Okuma, pratik ve tamamlanma cihazda ayrı kaydedilir. Nota gözlemi dersi tamamlamaz veya beceri puanı vermez.",
        en: "Reading, practice and completion are recorded separately on the device. Note observation does not complete a lesson or award a skill score.",
      },
      icon: "TrendingUp",
    },
    {
      title: { tr: "Geçici bellekte ses", en: "Audio in temporary memory" },
      description: {
        tr: "Ham ses dosyası kaydedilmez veya yüklenmez. Ekrandan çıkış, hesap değişimi veya arka plana geçiş mikrofonu durdurur; geri dönüşte kendiliğinden başlamaz. Kamera koçluğu ilk sürümde kapalıdır.",
        en: "Raw audio files are not recorded or uploaded. Leaving the screen, changing account or moving to the background stops the microphone; returning does not restart it. Camera coaching is disabled in the first release.",
      },
      icon: "Cpu",
    },
  ],
  stats: [
    { value: "···", label: { tr: "Lansman", en: "Launch" } },
    { value: "Guitar", label: { tr: "İlk enstrüman", en: "First instrument" } },
  ],
  vision: {
    tr: "Enstrüman pratiğinin, öğretmen olmadan geçen saatlerini de değerli kılmak.",
    en: "Make the hours you practice without a teacher count too.",
  },
  mission: {
    tr: "Gitar pratiğini anlaşılır dersler ve dürüst ilerleme kayıtlarıyla bilinçli bir alışkanlığa çevirmek.",
    en: "Turn guitar practice into a deliberate habit with clear lessons and honest progress records.",
  },
  order: 7,
  links: [],
};
