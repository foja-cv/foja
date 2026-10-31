// A Content Security Policy for every page of the build, as a <meta> (GitHub Pages cannot send
// headers). Scripts only from the site itself (plus the inline ones Astro emits, by hash, and
// WebAssembly for the compiler); connections only to the site itself, so nothing that slips in
// (a style's output, an imported project) can load from or send to anywhere else.

import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

function htmlFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? htmlFiles(path) : name.endsWith(".html") ? [path] : [];
  });
}

export function policy(scriptHashes) {
  return [
    "default-src 'self'",
    `script-src 'self' 'wasm-unsafe-eval' ${scriptHashes.map((h) => `'${h}'`).join(" ")}`.trim(),
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    // data: too: Vite inlines small files (the font licences) as data: URLs, fetched for exports.
    "connect-src 'self' data:",
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'none'",
  ].join("; ");
}

export default function csp() {
  return {
    name: "foja-csp",
    hooks: {
      "astro:build:done": ({ dir, logger }) => {
        const files = htmlFiles(fileURLToPath(dir));
        for (const file of files) {
          let html = readFileSync(file, "utf8");
          const hashes = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)]
            .map((m) => m[1])
            .filter((body) => body.trim())
            .map((body) => `sha256-${createHash("sha256").update(body).digest("base64")}`);
          const meta = `<meta http-equiv="Content-Security-Policy" content="${policy([...new Set(hashes)])}">`;
          html = html.replace(/<head>/, `<head>${meta}`);
          writeFileSync(file, html);
        }
        logger.info(`CSP added to ${files.length} pages`);
      },
    },
  };
}
