// Convert the multi-file `data/` layout of the cvgen generator (`cvgen/data`) into a Foja
// project. Texts referenced by path are inlined and Markdown task lists become items.
// `privado.json` (the address) is never read. `publicFixture` replaces the phone number and the
// photo, for fixtures committed to a public repository.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { FORMAT, slug, toBase64, type Asset, type Block, type ContactKind, type Item, type Profile, type Project } from "@foja/core";

const FAKE_PHONE = "+54 9 341 000-0000";
// A grey 403×371 box, the proportions of the real photo, so the fixture keeps the layout.
const PLACEHOLDER_PHOTO =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 403 371"><rect width="403" height="371" fill="#e1e1e1"/></svg>';

const CONTACT_KINDS: Record<string, ContactKind> = {
  telefono: "phone",
  correo: "email",
  web: "website",
  github: "github",
  linkedin: "linkedin",
};

const readJson = (path: string) => JSON.parse(readFileSync(path, "utf8"));
const readText = (dir: string, path: string) => readFileSync(join(dir, path), "utf8").trim();

// Same subset as cvgen's parse_markdown: `# Heading` lines; every other non-empty line is joined
// into the paragraph of the heading above it.
export function parseMarkdown(text: string): Item[] {
  const items: { heading?: string; lines: string[] }[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (line.startsWith("#")) items.push({ heading: line.replace(/^#+/, "").trim(), lines: [] });
    else if (line) {
      if (items.length === 0) items.push({ lines: [] });
      items.at(-1)!.lines.push(line);
    }
  }
  return items.map(({ heading, lines }) => (heading === undefined ? { text: lines.join(" ") } : { heading, text: lines.join(" ") }));
}

function convertItems(dir: string, value: string | string[] | undefined): Item[] | undefined {
  if (value === undefined) return undefined;
  if (Array.isArray(value)) return value.map((text) => ({ text }));
  return parseMarkdown(readText(dir, value));
}

function contactKind(key: string, warn: (m: string) => void): ContactKind | undefined {
  const kind = CONTACT_KINDS[key];
  if (!kind) warn(`contact "${key}" has no Foja equivalent and is dropped`);
  return kind;
}

export function convertCurriculum(dir: string, { publicFixture = false, warn = console.warn } = {}): Project {
  const base = readJson(join(dir, "cv.json"));
  const skillId = (name: string) => slug(name);

  const contacts: Project["contacts"] = {};
  for (const [key, value] of Object.entries(base.contactos as Record<string, string>)) {
    const kind = contactKind(key, warn);
    if (kind) contacts[kind] = value;
  }
  if (publicFixture && contacts.phone) contacts.phone = FAKE_PHONE;

  const skills: Project["skills"] = {};
  for (const [name, items] of Object.entries(base.habilidades as Record<string, string[]>)) {
    skills[skillId(name)] = { title: name, items };
  }

  const entries: Project["entries"] = {};
  for (const [id, raw] of Object.entries(base.entradas as Record<string, any>)) {
    const entry: Project["entries"][string] = { title: raw.titulo };
    if (raw.lugar) entry.place = raw.lugar;
    if (raw.desde) entry.start = raw.desde;
    if ("hasta" in raw) entry.end = raw.hasta;
    if (raw.nota) entry.note = raw.nota;
    const items = convertItems(dir, raw.tareas);
    if (items) entry.items = items;
    entries[id] = entry;
  }

  const profiles: Project["profiles"] = {};
  for (const file of readdirSync(join(dir, "perfiles")).sort()) {
    if (!file.endsWith(".json")) continue;
    const raw = readJson(join(dir, "perfiles", file));
    if (raw.domicilio) warn("the address is private and is not converted");
    const ids = new Set<string>();
    const profile: Profile = {
      subtitle: raw.subtitulo,
      contacts: (raw.contactos as string[]).map((k) => contactKind(k, warn)).filter((k): k is ContactKind => !!k),
      skills: (raw.habilidades as (string | string[])[]).map((row) => (typeof row === "string" ? [row] : row).map(skillId)),
      summary: readText(dir, raw.perfil),
      sections: (raw.secciones as any[]).map((s) => {
        let id = slug(s.titulo);
        for (let n = 2; ids.has(id); n++) id = `${slug(s.titulo)}-${n}`;
        ids.add(id);
        const blocks: Block[] = [
          ...(s.entradas ?? []).map((entry: string): Block => ({ type: "entry", entry })),
          ...(convertItems(dir, s.items) ?? []).map((it): Block => ({ type: "item", ...it })),
        ];
        return {
          id,
          title: s.titulo,
          ...(s.lateral ? { column: "side" as const } : {}),
          ...(s.compacto ? { compact: true } : {}),
          blocks,
        };
      }),
    };
    if (raw.postulacion) profile.highlight = { title: "Curso", text: raw.postulacion };
    profiles[basename(file, ".json")] = profile;
  }

  const assets: Record<string, Asset> = {};
  let photo: string | null = null;
  if (publicFixture) {
    photo = "photo.svg";
    assets[photo] = { type: "image/svg+xml", data: toBase64(new TextEncoder().encode(PLACEHOLDER_PHOTO)) };
  } else if (base.foto && existsSync(join(dir, base.foto))) {
    const ext = extname(base.foto).toLowerCase();
    photo = `photo${ext}`;
    assets[photo] = { type: ext === ".png" ? "image/png" : "image/jpeg", data: toBase64(readFileSync(join(dir, base.foto))) };
  }

  return {
    format: FORMAT,
    language: "es",
    person: { givenNames: base.nombres, familyNames: base.apellidos, photo },
    contacts,
    skills,
    entries,
    profiles,
    ...(Object.keys(assets).length ? { assets } : {}),
  };
}
