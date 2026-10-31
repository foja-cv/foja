import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import csp from "./integrations/csp.mjs";
import serviceWorker from "./integrations/service-worker.mjs";

const typstPackages = [
  "@myriaddreamin/typst.ts",
  "@myriaddreamin/typst-ts-web-compiler",
  "@myriaddreamin/typst-ts-renderer",
];

export default defineConfig({
  // GitHub Pages serves the site under /foja/; the dev server and a custom domain use /.
  base: process.env.FOJA_BASE ?? "/",
  // csp first: the service worker caches the pages as they end up.
  integrations: [react(), csp(), serviceWorker()],
  devToolbar: { enabled: false },
  vite: {
    // A production build next to a running dev server uses its own cache, or it would leave the
    // dev server's optimized dependencies outdated (scripts/e2e-pwa.sh sets it).
    cacheDir: process.env.FOJA_VITE_CACHE,
    plugins: [tailwindcss()],
    // typst.ts loads its WASM by URL; pre-bundling would break those URLs.
    optimizeDeps: { exclude: typstPackages },
    worker: { format: "es" },
  },
});
