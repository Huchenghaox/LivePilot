import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#202123",
        muted: "#6B6F76",
        soft: "#F7F7F4",
        panel: "#FFFFFF",
        panel2: "#FBFBF8",
        line: "rgba(32,33,35,0.10)",
        brand: "#10A37F",
        brand2: "#0E8F70",
        coral: "#D74F4F",
        warning: "#B7791F",
        success: "#168A63",
        danger: "#C2413F"
      },
      boxShadow: {
        glow: "0 1px 2px rgba(15,15,15,0.08)",
        card: "0 1px 2px rgba(15,15,15,0.04), 0 16px 40px rgba(15,15,15,0.04)"
      }
    }
  },
  plugins: []
};

export default config;
