// The Typst export: the profile's style as cv.typ, the library, every built-in style, the user's
// styles, the project, its assets and the fonts, in a `.zip` that compiles with a plain
// `typst compile` and opens in typst.app.

import { customStylePath, styleOf } from "./templates.ts";
import type { Project } from "./types.ts";
import type { ZipInput } from "./zip.ts";
import { fromBase64 } from "./typst.ts";

export interface TemplateFiles {
  "lib.typ": string;
  "labels.json": string;
  /** Built-in style id → source. */
  styles: Record<string, string>;
  /** File name → contents, licences included. */
  fonts: Record<string, Uint8Array | string>;
}

export function typstBundle(project: Project, profileId: string, template: TemplateFiles): ZipInput {
  const { assets, ...rest } = project;
  const style = styleOf(project, profileId);
  const files: ZipInput = {
    "cv.typ": style.custom ? project.templates![style.id].source : template.styles[style.id],
    "lib.typ": template["lib.typ"],
    "labels.json": template["labels.json"],
    "project.json": JSON.stringify(rest, null, 2) + "\n",
    "README.txt": [
      "CV made with Foja (https://github.com/bafif/foja).",
      "",
      "Compile it with Typst:",
      "",
      `    typst compile --font-path fonts --input profile=${profileId} cv.typ`,
      "",
      "or upload every file to typst.app. cv.typ is the style of this profile; the other styles are",
      "in styles/ and compile the same way. Edit project.json to change the content; the other",
      "profiles in it are built by changing the profile input.",
      "",
    ].join("\n"),
  };
  for (const [id, source] of Object.entries(template.styles)) files[`styles/${id}.typ`] = source;
  for (const [id, t] of Object.entries(project.templates ?? {})) files[customStylePath(id).slice(1)] = t.source;
  for (const [name, asset] of Object.entries(assets ?? {})) files[`assets/${name}`] = fromBase64(asset.data);
  for (const [name, data] of Object.entries(template.fonts)) files[`fonts/${name}`] = data;
  return files;
}
