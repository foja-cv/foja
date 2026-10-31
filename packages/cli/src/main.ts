#!/usr/bin/env node
// foja: build CVs from a Foja project.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { validate, type Project } from "@foja/core";

const USAGE = `usage:
  foja build <project.json> [--profile <id>]... [--format <format>]... [--out <dir>]
      formats: pdf (default), svg, typ, tex, md, json, docx, all (every one in a .zip);
      every profile unless --profile is given
  foja validate <project.json>
  foja convert-curriculum <curriculum/data> <out.json> [--public]`;

function fail(message: string, code = 1): never {
  console.error(message);
  process.exit(code);
}

function loadProject(path: string): Project {
  let value: unknown;
  try {
    value = JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    fail(`${path}: ${(e as Error).message}`);
  }
  const problems = validate(value);
  for (const p of problems) console.error(`${path}${p.path}: ${p.message}`);
  if (problems.some((p) => p.severity === "error")) fail(`${path}: not a valid Foja project`);
  return value as Project;
}

const FORMATS = ["pdf", "svg", "typ", "tex", "md", "json", "docx", "all"] as const;
type Format = (typeof FORMATS)[number];

async function build(args: string[]) {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      profile: { type: "string", multiple: true },
      format: { type: "string", multiple: true },
      out: { type: "string", default: "." },
    },
  });
  if (positionals.length !== 1) fail(USAGE, 2);
  const project = loadProject(positionals[0]);
  const formats = (values.format ?? ["pdf"]) as Format[];
  for (const f of formats) if (!FORMATS.includes(f)) fail(`unknown format "${f}"\n${USAGE}`, 2);
  const profiles = values.profile ?? Object.keys(project.profiles);
  for (const id of profiles) if (!(id in project.profiles)) fail(`no profile "${id}"`);

  const { Typst, templateFiles } = await import("./typst.ts");
  const { bundleExports, exportFiles, exportStem } = await import("@foja/core/export");
  const typst = new Typst(project);
  const template = templateFiles();
  mkdirSync(values.out, { recursive: true });
  const write = (name: string, data: Uint8Array | string, note = "") => {
    const file = join(values.out, name);
    writeFileSync(file, data);
    console.log(file + note);
  };
  for (const id of profiles) {
    const doc = formats.some((f) => f === "pdf" || f === "svg" || f === "all") ? typst.compile(id) : undefined;
    const pages = doc ? ` (${doc.numOfPages} page${doc.numOfPages === 1 ? "" : "s"})` : "";
    const stem = exportStem(project, id);
    for (const format of formats) {
      if (format === "pdf") write(`${stem}.pdf`, typst.pdf(doc!), pages);
      else if (format === "svg") write(`${stem}.svg`, typst.svg(doc!), pages);
      else if (format === "all") {
        const files = [{ name: `${stem}.pdf`, mime: "application/pdf", data: new Uint8Array(typst.pdf(doc!)) }];
        for (const f of ["typ", "tex", "md", "json", "docx"] as const) files.push(...(await exportFiles(project, id, f, template)));
        const bundle = bundleExports(project, id, files);
        write(bundle.name, bundle.data, ` (${files.map((f) => f.name.slice(stem.length) || f.name).join(", ")})`);
      } else for (const f of await exportFiles(project, id, format, template)) write(f.name, f.data);
    }
  }
}

async function main(argv: string[]) {
  const [command, ...rest] = argv;
  if (command === "build") return build(rest);
  if (command === "validate") {
    if (rest.length !== 1) fail(USAGE, 2);
    const project = loadProject(rest[0]);
    console.log(`${rest[0]}: valid, ${Object.keys(project.profiles).length} profile(s)`);
    return;
  }
  if (command === "convert-curriculum") {
    const { values, positionals } = parseArgs({ args: rest, allowPositionals: true, options: { public: { type: "boolean" } } });
    if (positionals.length !== 2) fail(USAGE, 2);
    const { convertCurriculum } = await import("./convert.ts");
    const project = convertCurriculum(positionals[0], { publicFixture: values.public });
    const problems = validate(project);
    for (const p of problems) console.error(`converted${p.path}: ${p.message}`);
    writeFileSync(positionals[1], JSON.stringify(project, null, 2) + "\n");
    console.log(`${positionals[1]}: ${Object.keys(project.profiles).length} profile(s)`);
    return;
  }
  fail(USAGE, command ? 2 : 0);
}

main(process.argv.slice(2)).catch((e) => fail(e instanceof Error ? e.message : String(e)));
