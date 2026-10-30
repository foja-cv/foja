// Convert the multi-file `data/` layout of bafif/curriculum into one Foja project document.
//
//   node scripts/convert-curriculum.mjs <curriculum/data> <out.project.json> [--public]
//
// Texts referenced by path are inlined and Markdown task lists become `{encabezado, texto}`
// items. `privado.json` (the address) is never read. `--public` also replaces the phone number
// and drops the photo, for fixtures committed to this public repository.

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

const FAKE_PHONE = "+54 9 341 000-0000";

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function readText(dataDir, path) {
  return readFileSync(join(dataDir, path), "utf8").trim();
}

// Same subset as cvgen's parse_markdown: `# Heading` lines, every other non-empty line is joined
// into the paragraph of the heading above it.
function parseMarkdown(text) {
  const items = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (line.startsWith("#")) {
      items.push({ encabezado: line.replace(/^#+/, "").trim(), lineas: [] });
    } else if (line) {
      if (items.length === 0) items.push({ lineas: [] });
      items.at(-1).lineas.push(line);
    }
  }
  return items.map(({ encabezado, lineas }) =>
    encabezado === undefined ? { texto: lineas.join(" ") } : { encabezado, texto: lineas.join(" ") },
  );
}

function convertItems(dataDir, value) {
  if (value === undefined) return undefined;
  if (Array.isArray(value)) return value.map((texto) => ({ texto }));
  return parseMarkdown(readText(dataDir, value));
}

function convertEntry(dataDir, raw) {
  const { tareas, ...rest } = raw;
  const entry = { ...rest };
  if (tareas !== undefined) entry.tareas = convertItems(dataDir, tareas);
  return entry;
}

function convertProfile(dataDir, raw) {
  const { perfil, secciones, domicilio, ...rest } = raw;
  if (domicilio) console.warn("note: the address is private and is not converted");
  return {
    ...rest,
    perfil: readText(dataDir, perfil),
    habilidades: rest.habilidades.map((row) => (typeof row === "string" ? [row] : row)),
    secciones: secciones.map(({ items, ...section }) => {
      const out = { ...section };
      if (items !== undefined) out.items = convertItems(dataDir, items);
      return out;
    }),
  };
}

export function convert(dataDir, { publicFixture = false } = {}) {
  const base = readJson(join(dataDir, "cv.json"));
  const perfiles = {};
  for (const file of readdirSync(join(dataDir, "perfiles")).sort()) {
    if (file.endsWith(".json")) {
      perfiles[basename(file, ".json")] = convertProfile(dataDir, readJson(join(dataDir, "perfiles", file)));
    }
  }
  const contactos = { ...base.contactos };
  if (publicFixture && contactos.telefono) contactos.telefono = FAKE_PHONE;
  return {
    formato: "foja/2-draft",
    nombres: base.nombres,
    apellidos: base.apellidos,
    foto: publicFixture ? null : base.foto,
    contactos,
    habilidades: base.habilidades,
    entradas: Object.fromEntries(
      Object.entries(base.entradas).map(([key, raw]) => [key, convertEntry(dataDir, raw)]),
    ),
    perfiles,
  };
}

const [dataDir, out, ...flags] = process.argv.slice(2);
if (!dataDir || !out) {
  console.error("usage: convert-curriculum.mjs <curriculum/data> <out.project.json> [--public]");
  process.exit(2);
}
const project = convert(dataDir, { publicFixture: flags.includes("--public") });
writeFileSync(out, JSON.stringify(project, null, 2) + "\n");
console.log(`wrote ${out}: ${Object.keys(project.perfiles).length} profiles`);
