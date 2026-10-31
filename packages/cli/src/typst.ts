// Typst on Node through typst.ts's native addon: the same styles the browser compiles.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { NodeCompiler } from "@myriaddreamin/typst-ts-node-compiler";
import {
  BUILTIN_STYLES,
  LABELS_PATH,
  LIB_PATH,
  PROJECT_PATH,
  assetFiles,
  builtinStylePath,
  customStyleSources,
  projectForTypst,
  styleOf,
  typstInputs,
  type Mark,
  type Project,
  type StyleGeometry,
  type TemplateFiles,
} from "@foja/core";

// The published CLI carries the template next to itself (dist/template); in the repository it
// comes from the @foja/template workspace package.
const bundled = ["./template/", "../template/"].map((p) => fileURLToPath(new URL(p, import.meta.url))).find((dir) => existsSync(join(dir, "lib.typ")));
export const TEMPLATE_DIR = bundled ?? dirname(fileURLToPath(import.meta.resolve("@foja/template/lib.typ")));
const FONTS_DIR = join(TEMPLATE_DIR, "fonts");

export function templateFiles(): TemplateFiles {
  const fonts: TemplateFiles["fonts"] = {};
  for (const name of readdirSync(FONTS_DIR).sort()) fonts[name] = readFileSync(join(FONTS_DIR, name));
  return {
    "lib.typ": readFileSync(join(TEMPLATE_DIR, "lib.typ"), "utf8"),
    "labels.json": readFileSync(join(TEMPLATE_DIR, "labels.json"), "utf8"),
    styles: Object.fromEntries(BUILTIN_STYLES.map((s) => [s.id, readFileSync(join(TEMPLATE_DIR, "styles", `${s.id}.typ`), "utf8")])),
    fonts,
  };
}

export class TypstError extends Error {}

type Doc = NonNullable<ReturnType<NodeCompiler["compile"]>["result"]>;

export class Typst {
  private compiler: NodeCompiler;
  private project: Project;

  constructor(project: Project) {
    this.project = project;
    const fontBlobs = readdirSync(FONTS_DIR)
      .filter((f) => /\.(otf|ttf)$/.test(f))
      .map((f) => readFileSync(join(FONTS_DIR, f)));
    this.compiler = NodeCompiler.create({ workspace: "/", fontArgs: [{ fontBlobs }] });
    const files = templateFiles();
    this.compiler.addSource(LIB_PATH, files["lib.typ"]);
    for (const [id, source] of Object.entries(files.styles)) this.compiler.addSource(builtinStylePath(id), source);
    for (const [path, source] of customStyleSources(project)) this.compiler.addSource(path, source);
    this.compiler.mapShadow(LABELS_PATH, Buffer.from(files["labels.json"]));
    this.compiler.mapShadow(PROJECT_PATH, Buffer.from(projectForTypst(project)));
    for (const [path, bytes] of assetFiles(project)) this.compiler.mapShadow(path, Buffer.from(bytes));
  }

  compile(profileId: string): Doc {
    const result = this.compiler.compile({ mainFilePath: styleOf(this.project, profileId).path, inputs: typstInputs(profileId) });
    const error = result.takeError();
    if (error || !result.result) {
      const diagnostics = error ? this.compiler.fetchDiagnostics(error) : [];
      const where = (d: any) => (typeof d.range === "string" ? d.range : d.range ? JSON.stringify(d.range) : "");
      const text = diagnostics.map((d: any) => `${d.path ?? ""} ${where(d)}: ${d.message ?? JSON.stringify(d)}`).join("\n");
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

  geometry(doc: Doc): StyleGeometry | undefined {
    return this.compiler.query(doc, { selector: "<foja-geometry>", field: "value" })[0];
  }
}
