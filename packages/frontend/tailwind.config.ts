import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        stellar: {
          light: "#E1E1E1",
          DEFAULT: "#7C3AED", // Purple for Stellar/Soroban branding
          dark: "#0F172A",
        },
      },
    },
  },
  plugins: [],
};
export default config;
