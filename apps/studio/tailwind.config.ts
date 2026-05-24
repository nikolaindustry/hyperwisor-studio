import type { Config } from "tailwindcss";

/**
 * Supabase-inspired light palette: white app, hairline borders, subtle
 * shadows, brand green for primary actions.
 */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#FFFFFF",
        panel: "#FFFFFF",
        surface: "#F8F9FA",
        "surface-2": "#F1F3F5",
        border: "#E4E6EB",
        "border-strong": "#D1D5DB",
        text: "#0F1419",
        "text-strong": "#000000",
        muted: "#5E6B7C",
        "muted-strong": "#374151",
        primary: "#3ECF8E",
        "primary-hover": "#36BB7F",
        "primary-foreground": "#062B1B",
        accent: "#249361",
        success: "#16A34A",
        danger: "#EF4444",
        info: "#3B82F6",
      },
      fontFamily: {
        sans: 'Inter, system-ui, -apple-system, sans-serif',
        mono: 'ui-monospace, "SF Mono", "Cascadia Mono", Menlo, Consolas, monospace',
      },
      borderRadius: {
        sm: "0.375rem",
        DEFAULT: "0.5rem",
        md: "0.5rem",
        lg: "0.625rem",
        xl: "0.75rem",
      },
      boxShadow: {
        xs: "0 1px 2px 0 rgba(0, 0, 0, 0.04)",
        sm: "0 1px 2px 0 rgba(0, 0, 0, 0.04), 0 1px 1px 0 rgba(0, 0, 0, 0.03)",
        DEFAULT: "0 1px 3px 0 rgba(0, 0, 0, 0.06), 0 1px 2px 0 rgba(0, 0, 0, 0.04)",
        md: "0 4px 12px -2px rgba(0, 0, 0, 0.06), 0 2px 4px -2px rgba(0, 0, 0, 0.04)",
        lg: "0 12px 28px -8px rgba(0, 0, 0, 0.10)",
        focus: "0 0 0 3px rgba(62, 207, 142, 0.18)",
      },
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
