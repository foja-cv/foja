import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";

const typstPackages = [
  "@myriaddreamin/typst.ts",
  "@myriaddreamin/typst-ts-web-compiler",
  "@myriaddreamin/typst-ts-renderer",
];

export default defineConfig({
  // GitHub Pages serves the site under /foja/; the dev server and a custom domain use /.
  base: process.env.FOJA_BASE ?? "/",
  integrations: [react()],
  devToolbar: { enabled: false },
  vite: {
    plugins: [tailwindcss()],
    // typst.ts loads its WASM by URL; pre-bundling would break those URLs.
    optimizeDeps: { exclude: typstPackages },
    worker: { format: "es" },
  },
});
