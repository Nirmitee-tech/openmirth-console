import type { Config } from "tailwindcss"

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Brand surface — navy/cool slate, professional healthcare palette
        ink: {
          50:  "#f6f8fb",
          100: "#eef2f8",
          200: "#dde4ee",
          300: "#cbd5e1",
          400: "#94a3b8",
          500: "#64748b",
          600: "#475569",
          700: "#334155",
          800: "#1a2332",
          900: "#0b1727",
        },
        brand: {
          50:  "#eff6ff",
          500: "#2554a4",
          600: "#1d4080",
          700: "#13315c",
          900: "#0b2545",
        },
        accent: {
          amber: "#ffb703",
        },
      },
      fontFamily: {
        sans: ["-apple-system", "BlinkMacSystemFont", "Segoe UI", "system-ui", "Helvetica Neue", "Arial", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
}
export default config
