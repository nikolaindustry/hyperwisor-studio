import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#09090B",
        panel: "#131316",
        surface: "#1F1F23",
        border: "#27272A",
        text: "#FAFAFA",
        muted: "#A1A1AA",
        primary: "#3B82F6",
        success: "#22C55E",
        danger: "#F87171",
      },
      fontFamily: {
        sans: 'Inter, system-ui, -apple-system, sans-serif',
        mono: 'ui-monospace, "Cascadia Mono", "Source Code Pro", Menlo, monospace',
      },
      borderRadius: { DEFAULT: "0.625rem", lg: "0.75rem" },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(2px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: { "fade-in": "fade-in 0.18s ease-out" },
    },
  },
  plugins: [],
} satisfies Config;
