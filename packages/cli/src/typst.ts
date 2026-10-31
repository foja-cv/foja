// Typst on Node through typst.ts's native addon: the same template the browser compiles.

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { NodeCompiler } from "@myriaddreamin/typst-ts-node-compiler";
import {
  LABELS_PATH,
  MAIN_PATH,
  PROJECT_PATH,
  assetFiles,
  projectForTypst,
  typstInputs,
  type Mark,
  type Project,
  type TemplateFiles,
} from "@foja/core";

export const TEMPLATE_DIR = dirname(fileURLToPath(import.meta.resolve("@foja/template/cv.typ")));
const FONTS_DIR = join(TEMPLATE_DIR, "fonts");

export function templateFiles(): TemplateFiles {
  const fonts: TemplateFiles["fonts"] = {};
  for (const name of readdirSync(FONTS_DIR).sort()) fonts[name] = readFileSync(join(FONTS_DIR, name));
  return {
    "cv.typ": readFileSync(join(TEMPLATE_DIR, "cv.typ"), "utf8"),
    "labels.json": readFileSync(join(TEMPLATE_DIR, "labels.json"), "utf8"),
    fonts,
  };
}

export class TypstError extends Error {}

type Doc = NonNullable<ReturnType<ReturnType<NodeCompiler["compile"]>["result"]>>;

export class Typst {
  private compiler: NodeCompiler;

  constructor(project: Project) {
    const fontBlobs = readdirSync(FONTS_DIR)
      .filter((f) => f.endsWith(".otf"))
      .map((f) => readFileSync(join(FONTS_DIR, f)));
    this.compiler = NodeCompiler.create({ workspace: "/", fontArgs: [{ fontBlobs }] });
    this.compiler.addSource(MAIN_PATH, readFileSync(join(TEMPLATE_DIR, "cv.typ"), "utf8"));
    this.compiler.mapShadow(LABELS_PATH, readFileSync(join(TEMPLATE_DIR, "labels.json")));
    this.compiler.mapShadow(PROJECT_PATH, Buffer.from(projectForTypst(project)));
    for (const [path, bytes] of assetFiles(project)) this.compiler.mapShadow(path, Buffer.from(bytes));
  }

  compile(profileId: string): Doc {
    const result = this.compiler.compile({ mainFilePath: MAIN_PATH, inputs: typstInputs(profileId) });
    const error = result.takeError();
    if (error || !result.result) {
      const diagnostics = error ? this.compiler.fetchDiagnostics(error) : [];
      const text = diagnostics.map((d: any) => `${d.path ?? ""}:${d.range ?? ""} ${d.message ?? JSON.stringify(d)}`).join("\n");
      throw new TypstError(`Typst failed for profile "${profileId}":\n${text}`);
    }
    return result.result;
  }

  pdf(doc: Doc): Buffer {
    return this.compiler.pdf(doc);
  }

  svg(doc: Doc): string {
    return this.compiler.svg(doc);
  }

  marks(doc: Doc): Mark[] {
    return this.compiler.query(doc, { selector: "<foja>", field: "value" });
  }
}
