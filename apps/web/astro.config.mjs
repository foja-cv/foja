import { defineConfig } from "astro/config";

const typstPackages = [
  "@myriaddreamin/typst.ts",
  "@myriaddreamin/typst-ts-web-compiler",
  "@myriaddreamin/typst-ts-renderer",
];

export default defineConfig({
  devToolbar: { enabled: false },
  vite: {
    // typst.ts loads its WASM by URL; pre-bundling would break those URLs.
    optimizeDeps: { exclude: typstPackages },
    worker: { format: "es" },
  },
});
