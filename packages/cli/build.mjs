// Builds the publishable CLI: dist/foja.mjs (one file, @foja/core and docx inside) and
// dist/template/ (the Typst library, styles, labels and fonts with their licences). Node does not
// run TypeScript from node_modules, so the package ships JavaScript. Runs on `npm pack`.

import { cpSync, chmodSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, "dist");
rmSync(dist, { recursive: true, force: true });

await build({
  configFile: false,
  logLevel: "warn",
  cacheDir: join(here, "node_modules/.vite-cli"),
  build: {
    ssr: join(here, "src/main.ts"),
    outDir: dist,
    emptyOutDir: false,
    target: "node24",
    minify: false,
    rollupOptions: { output: { entryFileNames: "foja.mjs", format: "es", inlineDynamicImports: true } },
  },
  ssr: { noExternal: [/^@foja\//, "docx"], external: ["@myriaddreamin/typst-ts-node-compiler"] },
});
chmodSync(join(dist, "foja.mjs"), 0o755);

const template = dirname(fileURLToPath(import.meta.resolve("@foja/template/lib.typ")));
mkdirSync(join(dist, "template"), { recursive: true });
for (const item of ["lib.typ", "labels.json", "styles.json", "styles", "fonts"]) {
  cpSync(join(template, item), join(dist, "template", item), { recursive: true });
}
// The licence of the package itself, from the repository root.
cpSync(join(here, "../../LICENSE"), join(here, "LICENSE"));
console.log("built dist/foja.mjs and dist/template/");
