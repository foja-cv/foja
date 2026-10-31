import { useEffect, useRef, useState } from "react";
import type { ExportFormat, ExportedFile } from "@foja/core/export";
import { svgToJpegs } from "../lib/jpg";
import { download } from "./download";
import { t } from "./i18n";
import { styleOf } from "@foja/core";
import { compilePdf, renderThumb } from "./preview";
import { useEditor } from "./store";
import { templateFiles } from "./template";

type Choice = ExportFormat | "all";
const CHOICES: Choice[] = ["pdf", "jpg", "docx", "typ", "tex", "md", "json", "all"];
const MEMORY = "foja.export";

function remembered(): { format: Choice; dpi: number } {
  try {
    return { format: "pdf", dpi: 150, ...JSON.parse(localStorage.getItem(MEMORY) ?? "{}") };
  } catch {
    return { format: "pdf", dpi: 150 };
  }
}

async function build(format: Choice, dpi: number): Promise<ExportedFile> {
  const { project, profileId } = useEditor.getState();
  const { exportFiles, exportStem, bundleExports } = await import("@foja/core/export");
  const stem = exportStem(project!, profileId);
  const pdf = async (): Promise<ExportedFile> => ({ name: `${stem}.pdf`, mime: "application/pdf", data: await compilePdf(project!, profileId) });
  const jpgs = async (): Promise<ExportedFile[]> => {
    // A fresh render of this very project and profile, not the preview (which can lag behind or
    // be the last good one before an error).
    const svg = await renderThumb(project!, profileId, styleOf(project!, profileId).id);
    if (!svg) throw new Error(t.compileError);
    const pages = await svgToJpegs(svg, dpi);
    return pages.map((data, i) => ({ name: pages.length === 1 ? `${stem}.jpg` : `${stem}-${i + 1}.jpg`, mime: "image/jpeg", data }));
  };
  if (format === "pdf") return pdf();
  if (format === "jpg") {
    const files = await jpgs();
    return files.length === 1 ? files[0] : bundleExports(project!, profileId, files);
  }
  if (format === "all") {
    const template = await templateFiles();
    const files = [await pdf(), ...(await jpgs())];
    for (const f of ["docx", "typ", "tex", "md", "json"] as const) files.push(...(await exportFiles(project!, profileId, f, template)));
    return bundleExports(project!, profileId, files);
  }
  const files = await exportFiles(project!, profileId, format, format === "typ" ? await templateFiles() : undefined);
  // JSON: the project file, which is what Foja imports; the resolved profile is in "all".
  return files[0];
}

export function ExportDialog({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [choice, setChoice] = useState(remembered);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  async function run() {
    setBusy(true);
    setError(undefined);
    try {
      localStorage.setItem(MEMORY, JSON.stringify(choice));
    } catch {
      // Storage can be unavailable (private windows); the choice is just not remembered.
    }
    try {
      const file = await build(choice.format, choice.dpi);
      download(file.name, file.data, file.mime);
      onClose();
    } catch (e) {
      setError(`${t.exportFailed} ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog ref={dialog} onClose={onClose} className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-lg bg-surface p-0 text-ink shadow-xl backdrop:bg-black/40">
      <form
        method="dialog"
        className="flex flex-col gap-4 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          void run();
        }}
      >
        <h2 className="text-lg font-semibold">{t.exportTitle}</h2>
        <fieldset className="flex flex-col gap-1">
          <legend className="sr-only">{t.format}</legend>
          {CHOICES.map((f) => (
            <label key={f} className="flex items-center gap-2 text-sm">
              <input type="radio" name="format" value={f} checked={choice.format === f} onChange={() => setChoice({ ...choice, format: f })} />
              {t.formats[f]}
            </label>
          ))}
        </fieldset>
        {(choice.format === "jpg" || choice.format === "all") && (
          <label className="flex items-center gap-2 text-sm">
            {t.dpi}
            <select className="rounded border border-line px-2 py-1" value={choice.dpi} onChange={(e) => setChoice({ ...choice, dpi: Number(e.target.value) })}>
              {[72, 150, 300].map((d) => (
                <option key={d} value={d}>
                  {d} dpi
                </option>
              ))}
            </select>
          </label>
        )}
        {error && (
          <p role="alert" className="text-sm whitespace-pre-wrap text-red-700">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" className="rounded border border-line px-3 py-1 text-sm" onClick={onClose}>
            {t.close}
          </button>
          <button type="submit" disabled={busy} className="rounded bg-accent px-3 py-1 text-sm text-on-accent disabled:opacity-50">
            {busy ? t.exporting : t.downloadButton}
          </button>
        </div>
      </form>
    </dialog>
  );
}
