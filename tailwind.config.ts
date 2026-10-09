import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx,mdx}"],
  theme: {
    // Preserve the existing pixel breakpoints independently of root font size.
    screens: { sm: "640px", md: "768px", lg: "1024px", xl: "1280px", "2xl": "1536px" },
    container: {
      center: true,
      padding: { DEFAULT: "1.5rem", lg: "2.5rem" },
      screens: { "2xl": "80rem" },
    },
    extend: {
      colors: {
        // Existing status colors keep their v3 sRGB values during migration.
        amber: { 300: "#fcd34d", 400: "#fbbf24" },
        emerald: { 300: "#6ee7b7", 400: "#34d399" },
        ink: {
          900: "#0A0A0B",
          850: "#0E0E10",
          800: "#131316",
          700: "#1A1A1E",
          600: "#26262C",
          500: "#3A3A42",
          400: "#6B6B75",
          300: "#9A9AA3",
          200: "#C5C5CC",
          100: "#E5E5EA",
          50: "#F4F4F5",
        },
        // Named surface/hairline scale — the alternative to hand-rolled
        // white/[0.04]-style opacity values scattered across ~80 call sites.
        // Each name is a decision made once instead of re-guessed per card.
        surface: {
          DEFAULT: "rgba(255,255,255,0.02)", // resting card/tile fill
          raised: "rgba(255,255,255,0.04)", // hover fill
          inset: "rgba(255,255,255,0.015)", // recessed panel (info boxes)
        },
        hairline: {
          DEFAULT: "rgba(255,255,255,0.10)", // default 1px border
          strong: "rgba(255,255,255,0.20)", // hover / active border
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Inter", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Manrope", "Inter", "sans-serif"],
        grotesk: ["var(--font-grotesk)", "Space Grotesk", "Inter", "sans-serif"],
        mono: ["var(--font-mono)", "JetBrains Mono", "ui-monospace", "monospace"],
      },
      letterSpacing: {
        tightest: "-0.04em",
      },
      transitionTimingFunction: {
        soft: "cubic-bezier(0.16, 1, 0.3, 1)",
      },
      keyframes: {
        pageIn: {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        driftA: {
          "0%, 100%": { transform: "translate3d(-10%, -8%, 0) scale(1)" },
          "50%": { transform: "translate3d(8%, 6%, 0) scale(1.1)" },
        },
        driftB: {
          "0%, 100%": { transform: "translate3d(8%, 4%, 0) scale(1.05)" },
          "50%": { transform: "translate3d(-6%, -10%, 0) scale(1)" },
        },
        driftC: {
          "0%, 100%": { transform: "translate3d(-4%, 6%, 0) scale(1)" },
          "50%": { transform: "translate3d(10%, -4%, 0) scale(1.15)" },
        },
      },
      animation: {
        "page-enter": "pageIn 500ms cubic-bezier(0.16, 1, 0.3, 1) both",
        "drift-a": "driftA 38s cubic-bezier(0.16, 1, 0.3, 1) infinite",
        "drift-b": "driftB 44s cubic-bezier(0.16, 1, 0.3, 1) infinite",
        "drift-c": "driftC 32s cubic-bezier(0.16, 1, 0.3, 1) infinite",
      },
    },
  },
  plugins: [typography],
};

export default config;
