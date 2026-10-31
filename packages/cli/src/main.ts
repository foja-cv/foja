#!/usr/bin/env node
// foja: build CVs from a Foja project.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { typstBundle, validate, zip, type Project } from "@foja/core";

const USAGE = `usage:
  foja build <project.json> [--profile <id>]... [--format <format>]... [--out <dir>]
      formats: pdf (default), svg, typ; every profile unless --profile is given
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

const FORMATS = ["pdf", "svg", "typ"] as const;
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
  const typst = new Typst(project);
  mkdirSync(values.out, { recursive: true });
  for (const id of profiles) {
    const needsDoc = formats.some((f) => f === "pdf" || f === "svg");
    const doc = needsDoc ? typst.compile(id) : undefined;
    for (const format of formats) {
      let file: string;
      if (format === "pdf") writeFileSync((file = join(values.out, `${id}.pdf`)), typst.pdf(doc!));
      else if (format === "svg") writeFileSync((file = join(values.out, `${id}.svg`)), typst.svg(doc!));
      else writeFileSync((file = join(values.out, `${id}-typst.zip`)), zip(typstBundle(project, id, templateFiles())));
      const pages = doc ? ` (${doc.numOfPages} page${doc.numOfPages === 1 ? "" : "s"})` : "";
      console.log(`${file}${format === "typ" ? "" : pages}`);
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
