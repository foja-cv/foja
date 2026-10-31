// The built-in styles' Typst sources, for "edit in Typst" (a copy becomes a style of one's own).

import { BUILTIN_STYLES, STYLE_SKELETON, type Project } from "@foja/core";
import { newId } from "./forms/Skills";

const sources = import.meta.glob<string>("../../../../packages/template/styles/*.typ", { query: "?raw", import: "default", eager: true });

export function builtinSource(id: string): string {
  const entry = Object.entries(sources).find(([path]) => path.endsWith(`/${id}.typ`));
  return entry?.[1] ?? STYLE_SKELETON;
}

/** Adds a style of one's own to the project (a copy of `from`, or the skeleton) and returns its id. */
export function addStyle(p: Project, from?: string): string {
  const base = from ? BUILTIN_STYLES.find((s) => s.id === from) : undefined;
  const custom = from ? p.templates?.[from] : undefined;
  const name = base ? `${base.name} (mío)` : custom ? `${custom.name} (copia)` : "Estilo nuevo";
  const id = newId(name, { ...BUILTIN_STYLES.reduce((o, s) => ({ ...o, [s.id]: 1 }), {}), ...p.templates });
  p.templates = { ...p.templates, [id]: { name, source: custom?.source ?? (base ? builtinSource(base.id) : STYLE_SKELETON) } };
  return id;
}

/** Profiles that use a style. */
export function profilesUsingStyle(p: Project, id: string): string[] {
  return Object.entries(p.profiles)
    .filter(([, profile]) => (profile.layout?.template ?? "legajo") === id)
    .map(([pid, profile]) => profile.name ?? pid);
}
