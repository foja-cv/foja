// The template files for the Typst export, fetched once.

import type { TemplateFiles } from "@foja/core";
import lib from "@foja/template/lib.typ?raw";
import labels from "@foja/template/labels.json?raw";

const styleSources = import.meta.glob<string>("../../../../packages/template/styles/*.typ", { query: "?raw", import: "default", eager: true });

const fontUrls = import.meta.glob<string>("../../../../packages/template/fonts/*", { query: "?url", import: "default", eager: true });

let cached: Promise<TemplateFiles> | undefined;

export function templateFiles(): Promise<TemplateFiles> {
  cached ??= (async () => {
    const fonts: TemplateFiles["fonts"] = {};
    for (const [path, url] of Object.entries(fontUrls)) {
      fonts[path.split("/").pop()!] = new Uint8Array(await (await fetch(url)).arrayBuffer());
    }
    const styles = Object.fromEntries(Object.entries(styleSources).map(([path, source]) => [path.split("/").pop()!.replace(/\.typ$/, ""), source]));
    return { "lib.typ": lib, "labels.json": labels, styles, fonts };
  })();
  return cached;
}
