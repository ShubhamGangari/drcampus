import type { Config } from "tailwindcss";
import { DESIGN_TOKENS } from "./src/lib/design-tokens";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: DESIGN_TOKENS.colors,
      fontFamily: DESIGN_TOKENS.fontFamily,
      fontSize: DESIGN_TOKENS.fontSize,
      borderRadius: DESIGN_TOKENS.borderRadius,
      boxShadow: DESIGN_TOKENS.boxShadow,
      transitionDuration: DESIGN_TOKENS.transition,
    },
  },
  plugins: [],
};
export default config;
