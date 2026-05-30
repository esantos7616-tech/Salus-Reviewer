import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        salus: {
          blue: "#0057B8",
          lightblue: "#E8F0FB",
          green: "#16A34A",
          red: "#DC2626",
          yellow: "#D97706",
          gray: "#F3F4F6",
        },
      },
    },
  },
  plugins: [],
};
export default config;
