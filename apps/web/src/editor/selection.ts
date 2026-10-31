// Between the marks of the template (paths such as `sections.0.blocks.2`) and the editor's
// selection: a click on the preview selects what is under it, and the selection is highlighted
// on the preview.

import type { Profile } from "@foja/core";
import type { Selection } from "./store";

export function selectionForPath(path: string, profile: Profile): Selection {
  const block = /^sections\.(\d+)\.blocks\.(\d+)/.exec(path);
  if (block) {
    const b = profile.sections[Number(block[1])]?.blocks[Number(block[2])];
    if (b?.type === "entry") return { kind: "entry", id: b.entry };
    return { kind: "section", index: Number(block[1]) };
  }
  const section = /^sections\.(\d+)/.exec(path);
  if (section) return { kind: "section", index: Number(section[1]) };
  if (path === "name" || path === "photo") return { kind: "person" };
  if (path.startsWith("skills")) return { kind: "skills" };
  return { kind: "profile" };
}

/** The marked parts that show the selection. */
export function pathsForSelection(selection: Selection, profile: Profile): string[] {
  switch (selection.kind) {
    case "person":
      return ["name", "photo"];
    case "contacts":
      return ["contacts"];
    case "skills":
      return profile.skills.map((_, i) => `skills.${i}`);
    case "profile":
      return ["subtitle", "summary", "highlight"];
    case "section":
      return [`sections.${selection.index}`];
    case "entry":
      return profile.sections.flatMap((s, i) =>
        s.blocks.flatMap((b, j) => (b.type === "entry" && b.entry === selection.id ? [`sections.${i}.blocks.${j}`] : [])),
      );
    default:
      return [];
  }
}

/** Sections with something past the first page. */
export function overflowingSections(marks: { path: string; page: number }[]): Set<number> {
  const out = new Set<number>();
  for (const m of marks) {
    const s = /^sections\.(\d+)/.exec(m.path);
    if (s && m.page > 1) out.add(Number(s[1]));
  }
  return out;
}
