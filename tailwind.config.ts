import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        bapsim: {
          red: "#c8191f",
          ink: "#19130f",
          rice: "#fff7e6",
          gold: "#f5a400",
          leaf: "#2f8b57"
        }
      },
      boxShadow: {
        soft: "0 10px 30px rgba(25, 19, 15, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
