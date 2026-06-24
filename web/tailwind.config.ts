import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#F4F7FB",
        muted: "#9CA6B8",
        soft: "#0B0B10",
        panel: "#17171F",
        panel2: "#1C1C25",
        line: "rgba(255,255,255,0.10)",
        brand: "#25F4EE",
        brand2: "#20D8D2",
        coral: "#FE2C55",
        warning: "#F59E0B",
        success: "#22C55E"
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(37,244,238,0.14), 0 18px 50px rgba(0,0,0,0.36)",
        card: "0 20px 70px rgba(0,0,0,0.28)"
      }
    }
  },
  plugins: []
};

export default config;
