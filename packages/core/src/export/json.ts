// JSON exports: the project file itself (import/export of the editor) and one profile resolved
// into plain data (for other tools: no references, dates formatted, labels applied).

import type { ResolvedCv } from "../resolve.ts";
import type { Project } from "../types.ts";

export function projectJson(project: Project): string {
  return JSON.stringify(project, null, 2) + "\n";
}

export function resolvedJson(cv: ResolvedCv): string {
  const { photo, labels: _labels, ...rest } = cv;
  return JSON.stringify({ format: "foja/2-resolved", ...rest, photo: photo ? { name: photo.name, type: photo.type } : null }, null, 2) + "\n";
}
