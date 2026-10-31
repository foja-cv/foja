// Every export of a profile, by format. PDF and JPG come from the Typst compiler, which lives in
// the caller (a web worker, the Node addon); everything else is built here.

import { fullName, slug } from "../project.ts";
import { resolveProfile } from "../resolve.ts";
import type { Project } from "../types.ts";
import { typstBundle, type TemplateFiles } from "../bundle.ts";
import { zip } from "../zip.ts";
import { renderDocx } from "./docx.ts";
import { projectJson, resolvedJson } from "./json.ts";
import { latexBundle } from "./latex.ts";
import { renderMarkdown } from "./markdown.ts";

export { escapeLatex, inlineLatex, latexBundle, renderLatex } from "./latex.ts";
export { inlineMarkdown, renderMarkdown } from "./markdown.ts";
export { projectJson, resolvedJson } from "./json.ts";
export { renderDocx } from "./docx.ts";

export const EXPORT_FORMATS = ["pdf", "jpg", "typ", "tex", "md", "json", "docx"] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export interface ExportedFile {
  name: string;
  mime: string;
  data: Uint8Array;
}

const encoder = new TextEncoder();

/** `bautista-fiori-programador`: the stem of every exported file. */
export function exportStem(project: Project, profileId: string): string {
  return `${slug(fullName(project))}-${profileId}`;
}

/** The exports that need no compiler. `typ` needs the template files. */
export async function exportFiles(
  project: Project,
  profileId: string,
  format: Exclude<ExportFormat, "pdf" | "jpg">,
  template?: TemplateFiles,
): Promise<ExportedFile[]> {
  const stem = exportStem(project, profileId);
  switch (format) {
    case "typ":
      if (!template) throw new Error("the Typst export needs the template files");
      return [{ name: `${stem}-typst.zip`, mime: "application/zip", data: zip(typstBundle(project, profileId, template)) }];
    case "tex":
      return [{ name: `${stem}-latex.zip`, mime: "application/zip", data: zip(latexBundle(project, profileId)) }];
    case "md":
      return [{ name: `${stem}.md`, mime: "text/markdown", data: encoder.encode(renderMarkdown(resolveProfile(project, profileId))) }];
    case "json":
      return [
        { name: `${slug(fullName(project))}.foja.json`, mime: "application/json", data: encoder.encode(projectJson(project)) },
        { name: `${stem}.resolved.json`, mime: "application/json", data: encoder.encode(resolvedJson(resolveProfile(project, profileId))) },
      ];
    case "docx":
      return [
        {
          name: `${stem}.docx`,
          mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          data: await renderDocx(resolveProfile(project, profileId)),
        },
      ];
  }
}

/** Several exports in one `.zip`, each file at the top level. */
export function bundleExports(project: Project, profileId: string, files: ExportedFile[]): ExportedFile {
  return {
    name: `${exportStem(project, profileId)}.zip`,
    mime: "application/zip",
    data: zip(Object.fromEntries(files.map((f) => [f.name, f.data]))),
  };
}
