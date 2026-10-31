// The template files for the Typst export, fetched once.

import type { TemplateFiles } from "@foja/core";
import template from "@foja/template/cv.typ?raw";
import labels from "@foja/template/labels.json?raw";

const fontUrls = import.meta.glob<string>("../../../../packages/template/fonts/*", { query: "?url", import: "default", eager: true });

let cached: Promise<TemplateFiles> | undefined;

export function templateFiles(): Promise<TemplateFiles> {
  cached ??= (async () => {
    const fonts: TemplateFiles["fonts"] = {};
    for (const [path, url] of Object.entries(fontUrls)) {
      fonts[path.split("/").pop()!] = new Uint8Array(await (await fetch(url)).arrayBuffer());
    }
    return { "cv.typ": template, "labels.json": labels, fonts };
  })();
  return cached;
}
