// Where things are on the page, in points (the Typst `pt`), computed with the same rules as
// cv.typ: the editor uses it to turn a click on the preview into a part of the CV and to draw
// highlights over it.

import { resolveLayout } from "./project.ts";
import type { Layout, Profile } from "./types.ts";
import type { Mark } from "./typst.ts";

const MM = 72 / 25.4;
export const PAPER_PT = { a4: { width: 210 * MM, height: 297 * MM }, "us-letter": { width: 215.9 * MM, height: 279.4 * MM } };

export interface Column {
  x: number;
  width: number;
}

export interface PageGeometry {
  width: number;
  height: number;
  top: number;
  bottom: number;
  side?: Column;
  main: Column;
}

export function pageGeometry(layout: Layout = {}): PageGeometry {
  const l = resolveLayout(layout);
  const paper = PAPER_PT[l.paper];
  const left = l.margins.left * MM;
  const textWidth = paper.width - left - l.margins.right * MM;
  const base = { width: paper.width, height: paper.height, top: l.margins.top * MM, bottom: paper.height - l.margins.bottom * MM };
  if (l.columns === 1) return { ...base, main: { x: left, width: textWidth } };
  const gutter = 18 * (l.fontSize / 10);
  const side = (textWidth * l.sidebarWidth) / 100;
  const main = textWidth - side - gutter;
  return l.sidebar === "left"
    ? { ...base, side: { x: left, width: side }, main: { x: left + side + gutter, width: main } }
    : { ...base, main: { x: left, width: main }, side: { x: left + main + gutter, width: side } };
}

/** Whether the part at `path` sits in the sidebar. */
export function inSidebar(path: string, profile: Profile): boolean {
  if ((profile.layout?.columns ?? 2) === 1) return false;
  if (/^(photo|highlight|contacts|skills)/.test(path)) return true;
  const section = /^sections\.(\d+)/.exec(path);
  return !!section && profile.sections[Number(section[1])]?.column === "side";
}

export interface MarkedBox {
  path: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** One box per marked part (start to end, the width of its column); parts that cross a page
 * break get a box on each page. */
export function markBoxes(marks: Mark[], profile: Profile): MarkedBox[] {
  const g = pageGeometry(profile.layout);
  const starts = new Map<string, Mark>();
  const boxes: MarkedBox[] = [];
  for (const m of marks) {
    if (m.kind === "start") {
      starts.set(m.path, m);
      continue;
    }
    const start = starts.get(m.path);
    if (!start) continue;
    const column = inSidebar(m.path, profile) && g.side ? g.side : g.main;
    for (let page = start.page; page <= m.page; page++) {
      const y0 = page === start.page ? start.y : g.top;
      const y1 = page === m.page ? m.y : g.bottom;
      boxes.push({ path: m.path, page, x: column.x, width: column.width, y: y0, height: Math.max(0, y1 - y0) });
    }
  }
  return boxes;
}

/** The innermost marked part under a point of a page. */
export function partAt(boxes: MarkedBox[], page: number, x: number, y: number): string | undefined {
  const hits = boxes.filter((b) => b.page === page && x >= b.x - 2 && x <= b.x + b.width + 2 && y >= b.y - 1 && y <= b.y + b.height + 1);
  hits.sort((a, b) => a.height - b.height || b.path.length - a.path.length);
  return hits[0]?.path;
}

/** How far the CV runs past the first page, in lines of body text (0 when it fits). */
export function overflowLines(marks: Mark[], layout: Layout = {}): number {
  const l = resolveLayout(layout);
  const g = pageGeometry(layout);
  const pages = Math.max(1, ...marks.map((m) => m.page));
  if (pages === 1) return 0;
  const lastY = Math.max(...marks.filter((m) => m.page === pages).map((m) => m.y));
  const usable = g.bottom - g.top;
  const extra = (pages - 2) * usable + Math.max(0, lastY - g.top);
  return Math.max(1, Math.ceil(extra / (l.fontSize * 1.2)));
}
