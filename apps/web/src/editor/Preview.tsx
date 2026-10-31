import { useState } from "react";
import { cleanSvg } from "../lib/svg";
import { t } from "./i18n";
import { usePreview } from "./preview";
import { useEditor } from "./store";

/** Without script and HTML layer (see cleanSvg), and without the fixed height, so it scales. */
export function safeSvg(svg: string): string {
  return cleanSvg(svg).replace(/ height="[\d.]+"/, "");
}

export function Preview() {
  const { ready, failed, svg, pages, errors, warnings, compileMs, renderMs } = usePreview();
  const problems = useEditor((s) => s.problems);
  const [showProblems, setShowProblems] = useState(false);

  return (
    <section aria-label={t.preview} className="flex min-h-0 flex-col bg-neutral-200 dark:bg-neutral-950">
      <header className="flex flex-wrap items-center gap-3 border-b border-neutral-300 bg-neutral-100 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900">
        <h2 className="font-semibold">{t.preview}</h2>
        {pages > 0 && (
          <span
            data-testid="page-badge"
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${pages === 1 ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100" : "bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-100"}`}
          >
            {t.pages(pages)} {pages === 1 ? `✓ ${t.fitsOnePage}` : `⚠ ${t.overflows}`}
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
          <div
            className="foja-page mx-auto max-w-3xl"
            // The SVG comes from our compiler worker, cleaned (see safeSvg).
            dangerouslySetInnerHTML={{ __html: safeSvg(svg) }}
          />
        ) : (
          <p className="text-sm text-neutral-600">{ready ? "" : t.loadingCompiler}</p>
        )}
      </div>
    </section>
  );
}
