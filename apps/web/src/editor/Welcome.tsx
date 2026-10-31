import { useState } from "react";
import { t } from "./i18n";
import { emptyProject, exampleProject, parseProject } from "./projects";
import { useEditor } from "./store";

export function Welcome() {
  const load = useEditor((s) => s.load);
  const [error, setError] = useState<string>();
  return (
    <main className="mx-auto flex min-h-full max-w-xl flex-col justify-center gap-6 p-6">
      <h1 className="text-3xl font-semibold">{t.welcomeTitle}</h1>
      <p className="text-muted">{t.welcomeText}</p>
      <div className="flex flex-wrap gap-3">
        <button className="rounded bg-accent px-4 py-2 text-on-accent hover:opacity-90" onClick={() => load(exampleProject())}>
          {t.startExample}
        </button>
        <button className="rounded border border-line px-4 py-2 hover:bg-surface-2" onClick={() => load(emptyProject())}>
          {t.startEmpty}
        </button>
        <ImportButton onError={setError} />
      </div>
      {error && (
        <pre role="alert" className="text-sm whitespace-pre-wrap text-red-700">
          {t.importFailed}
          {"\n"}
          {error}
        </pre>
      )}
    </main>
  );
}

export function ImportButton({ onError, className }: { onError: (message?: string) => void; className?: string }) {
  const load = useEditor((s) => s.load);
  return (
    <label className={className ?? "cursor-pointer rounded border border-line px-4 py-2 hover:bg-surface-2"}>
      {t.importJson}
      <input
        type="file"
        accept="application/json,.json"
        className="sr-only"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          try {
            load(parseProject(await file.text()));
            onError(undefined);
          } catch (err) {
            onError((err as Error).message);
          }
        }}
      />
    </label>
  );
}
