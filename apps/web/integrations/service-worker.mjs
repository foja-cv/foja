// Offline support without a framework: after `astro build`, list every file of the site and
// write sw.js, which precaches them (the compiler WASM included) and serves the site from the
// cache. The cache name carries a hash of the contents, so a new build replaces the old cache.

import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const SKIP = [/^sw\.js$/, /^spike\//, /\.map$/];

function files(dir, root = dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path, root) : [relative(root, path).split("\\").join("/")];
  });
}

export default function serviceWorker() {
  return {
    name: "foja-service-worker",
    hooks: {
      "astro:build:done": ({ dir, logger }) => {
        const root = fileURLToPath(dir);
        const list = files(root).filter((f) => !SKIP.some((re) => re.test(f))).sort();
        const hash = createHash("sha256");
        for (const f of list) hash.update(f).update(readFileSync(join(root, f)));
        const version = hash.digest("hex").slice(0, 12);
        // Pages are cached by their directory URL too (`editor/` for `editor/index.html`).
        const urls = list.flatMap((f) => (f === "index.html" ? ["./", f] : f.endsWith("/index.html") ? [f.slice(0, -"index.html".length), f] : [f]));
        const template = readFileSync(new URL("./sw-template.js", import.meta.url), "utf8");
        writeFileSync(join(root, "sw.js"), template.replace("__VERSION__", version).replace("__PRECACHE__", JSON.stringify(urls)));
        logger.info(`sw.js: ${list.length} files precached, version ${version}`);
      },
    },
  };
}
