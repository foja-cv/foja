// From the marks a style emits to boxes on the page: the editor turns a click on the preview into
// a part of the CV and draws highlights with them. Columns come from the style's `geometry`
// declaration; a style without one still works, with boxes from the mark to the right margin.

import type { Mark, StyleGeometry } from "./typst.ts";

export interface MarkedBox {
  path: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** One box per marked part (start to end, the width of its column); parts that cross a page
 * break get a box on each page. `page` is the page size in pt. */
export function markBoxes(marks: Mark[], geometry: StyleGeometry | undefined, page: { width: number; height: number }): MarkedBox[] {
  const starts = new Map<string, Mark>();
  const boxes: MarkedBox[] = [];
  // Where content starts and ends vertically, measured from the marks themselves.
  const top = Math.min(...marks.map((m) => m.y));
  const bottom = Math.max(...marks.map((m) => m.y));
  for (const m of marks) {
    if (m.kind === "start") {
      starts.set(m.path, m);
      continue;
    }
    const start = starts.get(m.path);
    if (!start) continue;
    const declared = (start.column === "side" ? geometry?.side : geometry?.main) ?? geometry?.main;
    const x = declared?.x ?? start.x ?? 0;
    const width = declared?.width ?? page.width - 2 * x;
    for (let p = start.page; p <= m.page; p++) {
      const y0 = p === start.page ? start.y : top;
      const y1 = p === m.page ? m.y : bottom;
      boxes.push({ path: m.path, page: p, x, width, y: y0, height: Math.max(0, y1 - y0) });
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
export function overflowLines(marks: Mark[], fontSize = 10): number {
  const pages = Math.max(1, ...marks.map((m) => m.page));
  if (pages === 1) return 0;
  let extra = 0;
  for (let p = 2; p <= pages; p++) {
    const ys = marks.filter((m) => m.page === p).map((m) => m.y);
    if (ys.length) extra += Math.max(...ys) - Math.min(...ys);
  }
  return Math.max(1, Math.ceil(extra / (fontSize * 1.25)));
}
