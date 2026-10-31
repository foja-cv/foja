import { useState } from "react";
import { download } from "./download";
import { LANGUAGES, setLanguage, t, useLanguage, type Language } from "./i18n";
import { allThemes, useThemes, type Mode } from "./themes";
import { Button } from "./ui";

export function ThemeMenu() {
  const state = useThemes();
  const lang = useLanguage((s) => s.lang);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();
  const themes = allThemes(state);
  const current = themes.find((th) => th.id === state.current) ?? themes[0];

  async function importTheme(file: File | undefined) {
    setError(undefined);
    if (!file) return;
    try {
      const theme = state.register(JSON.parse(await file.text()));
      state.use(theme.id);
    } catch (e) {
      setError(`${t.themes.importFailed} ${(e as Error).message}`);
    }
  }

  return (
    <div className="relative">
      <Button variant="ghost" onClick={() => setOpen(!open)}>
        {t.themes.menu} ▾
      </Button>
      {open && (
        <div role="dialog" aria-label={t.themes.menu} className="absolute right-0 z-20 mt-1 flex w-72 flex-col gap-3 rounded-lg border border-line bg-surface p-3 shadow-lg">
          <fieldset className="flex flex-col gap-1">
            <legend className="mb-1 text-xs font-semibold tracking-wide text-muted uppercase">{t.themes.title}</legend>
            {themes.map((th) => (
              <div key={th.id} className="flex items-center justify-between gap-2">
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" name="theme" checked={th.id === current.id} onChange={() => state.use(th.id)} />
                  <span className="inline-flex gap-0.5" aria-hidden>
                    {[th.light.bg, th.light.accent, th.light.ink].map((c, i) => (
                      <span key={i} className="h-3 w-3 rounded-full border border-line" style={{ background: c }} />
                    ))}
                  </span>
                  {th.name}
                </label>
                {state.added.some((a) => a.id === th.id) && (
                  <Button variant="ghost" label={`${t.remove} ${th.name}`} onClick={() => state.remove(th.id)}>
                    ✕
                  </Button>
                )}
              </div>
            ))}
          </fieldset>
          <label className="flex items-center justify-between gap-2 text-sm">
            {t.themes.uiLanguage}
            <select className="rounded border border-line bg-surface px-2 py-1" value={lang} onChange={(e) => setLanguage(e.target.value as Language)}>
              {Object.entries(LANGUAGES).map(([id, l]) => (
                <option key={id} value={id}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center justify-between gap-2 text-sm">
            {t.themes.mode}
            <select className="rounded border border-line bg-surface px-2 py-1" value={state.mode} onChange={(e) => state.setMode(e.target.value as Mode)}>
              <option value="auto">{t.themes.auto}</option>
              <option value="light">{t.themes.light}</option>
              <option value="dark">{t.themes.dark}</option>
            </select>
          </label>
          <div className="flex flex-col gap-1 border-t border-line pt-2">
            <label className="cursor-pointer rounded px-2 py-1 text-sm hover:bg-surface-2">
              {t.themes.import}
              <input
                type="file"
                accept="application/json,.json"
                className="sr-only"
                onChange={(e) => {
                  void importTheme(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </label>
            <Button
              variant="ghost"
              onClick={() => {
                const { id, name, ...rest } = current;
                const starter = { id: `${id}-mio`, name: `${name} (mío)`, ...rest };
                download(`${starter.id}.foja-theme.json`, JSON.stringify(starter, null, 2) + "\n", "application/json");
              }}
            >
              {t.themes.exportCurrent}
            </Button>
            <a className="px-2 text-xs text-accent underline" href="https://github.com/foja-cv/foja/blob/main/docs/themes.md" target="_blank" rel="noreferrer">
              {t.themes.docs}
            </a>
            {error && (
              <p role="alert" className="px-2 text-xs whitespace-pre-wrap text-danger">
                {error}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
