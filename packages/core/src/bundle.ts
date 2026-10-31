// The Typst export: template, project, assets and fonts in a `.zip` that compiles with a plain
// `typst compile` and opens in typst.app.

import type { Project } from "./types.ts";
import type { ZipInput } from "./zip.ts";
import { fromBase64 } from "./typst.ts";

export interface TemplateFiles {
  "cv.typ": string;
  "labels.json": string;
  /** File name → contents, licences included. */
  fonts: Record<string, Uint8Array | string>;
}

export function typstBundle(project: Project, profileId: string, template: TemplateFiles): ZipInput {
  const { assets, ...rest } = project;
  const files: ZipInput = {
    "cv.typ": template["cv.typ"],
    "labels.json": template["labels.json"],
    "project.json": JSON.stringify(rest, null, 2) + "\n",
    "README.txt": [
      "CV made with Foja (https://github.com/foja-cv/foja).",
      "",
      "Compile it with Typst:",
      "",
      `    typst compile --font-path fonts --input profile=${profileId} cv.typ`,
      "",
      "or upload every file to typst.app. Edit project.json to change the content; the other",
      "profiles in it are built by changing the profile input.",
      "",
    ].join("\n"),
  };
  for (const [name, asset] of Object.entries(assets ?? {})) files[`assets/${name}`] = fromBase64(asset.data);
  for (const [name, data] of Object.entries(template.fonts)) files[`fonts/${name}`] = data;
  return files;
}
