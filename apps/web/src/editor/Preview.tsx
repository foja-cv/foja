import { useEffect, useMemo, useRef, useState } from "react";
import { markBoxes, overflowLines, partAt, type MarkedBox } from "@foja/core";
import { pageBoxes } from "../lib/jpg";
import { cleanSvg } from "../lib/svg";
import { t } from "./i18n";
import { usePreview } from "./preview";
import { pathsForSelection, selectionForPath } from "./selection";
import { useEditor } from "./store";

/** Without script and HTML layer (see cleanSvg), and without the fixed height, so it scales. */
export function safeSvg(svg: string): string {
  return cleanSvg(svg).replace(/ height="[\d.]+"/, "");
}

export function Preview() {
  const { ready, failed, svg, pages, marks, errors, warnings, compileMs, renderMs } = usePreview();
  const problems = useEditor((s) => s.problems);
  const profile = useEditor((s) => s.project!.profiles[s.profileId]);
  const selection = useEditor((s) => s.selection);
  const select = useEditor((s) => s.select);
  const [showProblems, setShowProblems] = useState(false);
  const sheet = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    if (!sheet.current) return;
    const observer = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    observer.observe(sheet.current);
    return () => observer.disconnect();
  }, [svg !== undefined]);

  const html = useMemo(() => (svg ? safeSvg(svg) : ""), [svg]);
  const layout = useMemo(() => {
    if (!svg || !profile) return undefined;
    const docWidth = Number(/data-width="([\d.]+)"/.exec(svg)?.[1] ?? 596);
    return { pages: pageBoxes(svg), boxes: markBoxes(marks, profile), docWidth };
  }, [svg, marks, profile]);
  const overflow = profile && pages > 1 ? overflowLines(marks, profile.layout) : 0;

  const scale = layout && width ? width / layout.docWidth : 0;
  const place = (b: MarkedBox) => {
    const top = layout!.pages[b.page - 1]?.y ?? 0;
    return { left: b.x * scale - 3, top: (top + b.y) * scale - 2, width: b.width * scale + 6, height: b.height * scale + 4 };
  };
  const selected = layout && profile ? new Set(pathsForSelection(selection, profile)) : new Set<string>();
  const highlights = layout ? layout.boxes.filter((b) => selected.has(b.path) && b.height > 0) : [];
  // Blocks that start past the first page: what would have to go to fit on one.
  const overflowing = layout ? layout.boxes.filter((b) => b.page > 1 && /^sections\.\d+\.blocks\.\d+$/.test(b.path)) : [];

  function onClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!layout || !scale || !profile) return;
    const rect = sheet.current!.getBoundingClientRect();
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;
    const page = layout.pages.findIndex((p) => y >= p.y && y < p.y + p.height);
    if (page < 0) return;
    const path = partAt(layout.boxes, page + 1, x, y - layout.pages[page].y);
    if (path) select(selectionForPath(path, profile));
  }

  return (
    <section aria-label={t.preview} className="flex min-h-0 flex-col bg-neutral-200 dark:bg-neutral-950">
      <header className="flex flex-wrap items-center gap-3 border-b border-neutral-300 bg-neutral-100 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900">
        <h2 className="font-semibold">{t.preview}</h2>
        {pages > 0 && (
          <span
            data-testid="page-badge"
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${pages === 1 ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100" : "bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-100"}`}
          >
            {t.pages(pages)} {pages === 1 ? `✓ ${t.fitsOnePage}` : `⚠ ${t.overflowsBy(overflow)}`}
          </span>
        )}
        {problems.length > 0 && (
          <button className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-900 dark:bg-red-900 dark:text-red-100" onClick={() => setShowProblems(!showProblems)}>
            {t.problems(problems.length)}
          </button>
        )}
        {compileMs !== undefined && (
          <span className="ml-auto text-xs text-neutral-500" title="Typst · SVG">
            {compileMs.toFixed(0)} ms · {renderMs?.toFixed(0)} ms
          </span>
        )}
      </header>
      {showProblems && (
        <ul className="max-h-40 overflow-auto border-b border-neutral-300 bg-red-50 px-3 py-2 font-mono text-xs text-red-900 dark:border-neutral-700 dark:bg-red-950 dark:text-red-100">
          {problems.map((p, i) => (
            <li key={i}>
              {p.path}: {p.message}
            </li>
          ))}
        </ul>
      )}
      {(errors || failed) && (
        <div role="alert" className="border-b border-red-300 bg-red-50 px-3 py-2 text-xs text-red-900 dark:bg-red-950 dark:text-red-100">
          <p className="font-medium">{failed ? failed : t.compileError}</p>
          {errors && <pre className="mt-1 whitespace-pre-wrap">{errors.join("\n")}</pre>}
        </div>
      )}
      {warnings && warnings.length > 0 && <pre className="border-b border-amber-300 bg-amber-50 px-3 py-1 text-xs whitespace-pre-wrap text-amber-900">{warnings.join("\n")}</pre>}
      <div className="min-h-0 flex-1 overflow-auto p-4">
        {svg ? (
          <div ref={sheet} className="relative mx-auto max-w-3xl cursor-pointer" onClick={onClick} title={t.clickToEdit}>
            {/* The SVG comes from our compiler worker, cleaned (see safeSvg). */}
            <div className="foja-page" dangerouslySetInnerHTML={{ __html: html }} />
            {scale > 0 &&
              overflowing.map((b, i) => (
                <div key={`o${i}`} data-testid="overflow-box" className="pointer-events-none absolute rounded-sm bg-red-500/10 ring-1 ring-red-500/60" style={place(b)} />
              ))}
            {scale > 0 &&
              highlights.map((b, i) => (
                <div key={`h${i}`} data-testid="highlight-box" className="pointer-events-none absolute rounded-sm bg-sky-400/15 ring-2 ring-sky-500" style={place(b)} />
              ))}
          </div>
        ) : (
          <p className="text-sm text-neutral-600">{ready ? "" : t.loadingCompiler}</p>
        )}
      </div>
    </section>
  );
}
