import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        pitch: "#0b3d2e",
        ink: "#0a0e14",
      },
    },
  },
  plugins: [],
} satisfies Config;
