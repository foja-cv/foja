// Validation of a project: the JSON Schema (structure) plus the cross references the schema cannot
// express (a section pointing at a missing entry, a profile using an absent contact).
//
// The validator covers the subset of JSON Schema 2020-12 that project.schema.json uses; it keeps
// the editor, the CLI and the tests on one contract without another dependency.

import schema from "../schema/project.schema.json" with { type: "json" };
import type { Project } from "./types.ts";

export interface Problem {
  /** JSON Pointer of the offending value, e.g. `/profiles/dev/sections/0/title`. */
  path: string;
  message: string;
  severity: "error" | "warning";
}

type Schema = Record<string, any>;

const root = schema as Schema;

function resolve(s: Schema): Schema {
  while (s.$ref) {
    const parts = (s.$ref as string).replace(/^#\//, "").split("/");
    s = parts.reduce((node: Schema, key) => node[key], root);
  }
  return s;
}

function typeOf(v: unknown): string {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  if (typeof v === "number") return Number.isInteger(v) ? "integer" : "number";
  return typeof v;
}

function typeMatches(want: string, got: string): boolean {
  return want === got || (want === "number" && got === "integer");
}

const escape = (key: string) => key.replace(/~/g, "~0").replace(/\//g, "~1");

function check(value: unknown, s: Schema, path: string, out: Problem[]): void {
  s = resolve(s);
  const err = (message: string) => out.push({ path: path || "/", message, severity: "error" });

  if (s.oneOf) {
    const results = (s.oneOf as Schema[]).map((alt) => {
      const sub: Problem[] = [];
      check(value, alt, path, sub);
      return sub;
    });
    const passing = results.filter((r) => r.length === 0).length;
    if (passing === 1) return;
    if (passing > 1) return err("matches more than one alternative");
    // Report the alternative that got furthest (fewest problems), which is usually the intended one.
    const best = results.reduce((a, b) => (b.length < a.length ? b : a));
    out.push(...best);
    return;
  }
  if ("const" in s && value !== s.const) return err(`must be ${JSON.stringify(s.const)}`);
  if (s.enum && !s.enum.includes(value)) return err(`must be one of ${s.enum.map((e: unknown) => JSON.stringify(e)).join(", ")}`);
  if (s.type) {
    const types: string[] = Array.isArray(s.type) ? s.type : [s.type];
    const got = typeOf(value);
    if (!types.some((t) => typeMatches(t, got))) return err(`must be ${types.join(" or ")}, not ${got}`);
  }

  if (typeof value === "string") {
    if (s.minLength !== undefined && value.length < s.minLength) err(s.minLength === 1 ? "must not be empty" : `must have at least ${s.minLength} characters`);
    if (s.pattern && !new RegExp(s.pattern, "u").test(value)) err(`does not match ${s.pattern}`);
  }
  if (typeof value === "number") {
    if (s.minimum !== undefined && value < s.minimum) err(`must be at least ${s.minimum}`);
    if (s.maximum !== undefined && value > s.maximum) err(`must be at most ${s.maximum}`);
  }
  if (Array.isArray(value)) {
    if (s.minItems !== undefined && value.length < s.minItems) err(`must have at least ${s.minItems} item(s)`);
    if (s.items) value.forEach((v, i) => check(v, s.items, `${path}/${i}`, out));
  }
  if (typeOf(value) === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj);
    if (s.minProperties !== undefined && keys.length < s.minProperties) err(`must have at least ${s.minProperties} member(s)`);
    for (const key of s.required ?? []) if (!(key in obj)) err(`missing "${key}"`);
    for (const key of keys) {
      const sub = `${path}/${escape(key)}`;
      if (s.propertyNames) check(key, s.propertyNames, sub, out);
      if (s.properties && key in s.properties) check(obj[key], s.properties[key], sub, out);
      else if (s.additionalProperties === false) out.push({ path: sub, message: "unknown member", severity: "error" });
      else if (s.additionalProperties && typeof s.additionalProperties === "object") check(obj[key], s.additionalProperties, sub, out);
    }
  }
}

/** Structural problems against project.schema.json. */
export function validateSchema(value: unknown): Problem[] {
  const out: Problem[] = [];
  check(value, root, "", out);
  return out;
}

/** Broken references between the parts of a structurally valid project. */
export function validateReferences(p: Project): Problem[] {
  const out: Problem[] = [];
  const error = (path: string, message: string) => out.push({ path, message, severity: "error" });
  const assets = p.assets ?? {};
  if (p.person.photo && !(p.person.photo in assets)) error("/person/photo", `no asset named "${p.person.photo}"`);
  for (const [id, profile] of Object.entries(p.profiles)) {
    const base = `/profiles/${escape(id)}`;
    profile.contacts.forEach((kind, i) => {
      if (!p.contacts[kind]) error(`${base}/contacts/${i}`, `the project has no ${kind} contact`);
    });
    profile.skills.forEach((row, i) =>
      row.forEach((group, j) => {
        if (!(group in p.skills)) error(`${base}/skills/${i}/${j}`, `no skill group "${group}"`);
      }),
    );
    const seen = new Set<string>();
    profile.sections.forEach((section, i) => {
      if (seen.has(section.id)) error(`${base}/sections/${i}/id`, `duplicate section id "${section.id}"`);
      seen.add(section.id);
      section.blocks.forEach((block, j) => {
        if (block.type === "entry" && !(block.entry in p.entries)) {
          error(`${base}/sections/${i}/blocks/${j}/entry`, `no entry "${block.entry}"`);
        }
      });
    });
  }
  for (const [id, entry] of Object.entries(p.entries)) {
    if (entry.start && typeof entry.end === "string" && entry.end < entry.start) {
      error(`/entries/${escape(id)}/end`, "ends before it starts");
    }
    if (!entry.start && "end" in entry) error(`/entries/${escape(id)}/end`, "has an end but no start");
  }
  return out;
}

/** All problems: structure first; references only once the structure is sound. */
export function validate(value: unknown): Problem[] {
  const structural = validateSchema(value);
  return structural.length ? structural : validateReferences(value as Project);
}
