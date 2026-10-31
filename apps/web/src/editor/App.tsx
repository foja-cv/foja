// The editor island: header (profiles, history, saving, export), navigation, the panel of the
// selection and the live preview.

import { useCallback, useEffect, useMemo, useState } from "react";
import { profileName } from "@foja/core";
import { ExportDialog } from "./ExportDialog";
import { ContactsForm } from "./forms/Contacts";
import { EntriesList, EntryForm } from "./forms/Entries";
import { LayoutForm } from "./forms/Layout";
import { PersonForm } from "./forms/Person";
import { addSection, ProfileTextForm } from "./forms/ProfileText";
import { SectionForm } from "./forms/Section";
import { SkillsForm } from "./forms/Skills";
import { StyleEditor } from "./forms/StyleEditor";
import { t, useLanguage } from "./i18n";
import { connectPreview, usePreview } from "./preview";
import { overflowingSections } from "./selection";
import { emptyProject, exampleProject, newProfile } from "./projects";
import { loadSaved, save } from "./storage";
import { redo, undo, useEditor, type Selection } from "./store";
import { Button, move } from "./ui";
import { SortableItem, SortableList } from "./Sortable";
import { ImportButton, Welcome } from "./Welcome";
import { Preview } from "./Preview";
import { Palette } from "./Palette";
import { ThemeMenu } from "./ThemeMenu";
import { startThemes } from "./themes";

startThemes();

async function saveNow() {
  const { project, profileId, setSaveState } = useEditor.getState();
  if (!project) return;
  setSaveState("saving");
  try {
    await save({ project, profileId });
    // Only mark it saved if nothing changed while writing.
    if (useEditor.getState().project === project) setSaveState("saved");
  } catch {
    setSaveState("unsaved");
  }
}

function useAutosave() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const stop = useEditor.subscribe((state, prev) => {
      if (state.project === prev.project && state.profileId === prev.profileId) return;
      clearTimeout(timer);
      timer = setTimeout(saveNow, 500);
    });
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (useEditor.getState().saveState !== "saved") e.preventDefault();
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      stop();
      window.removeEventListener("beforeunload", beforeUnload);
    };
  }, []);
}

function useShortcuts(openExport: () => void, openPalette: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const key = e.key.toLowerCase();
      if (key === "s") {
        e.preventDefault();
        void saveNow();
      } else if (key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((key === "z" && e.shiftKey) || key === "y") {
        e.preventDefault();
        redo();
      } else if (key === "e") {
        e.preventDefault();
        openExport();
      } else if (key === "k") {
        e.preventDefault();
        openPalette();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openExport, openPalette]);
}

export default function App() {
  const project = useEditor((s) => s.project);
  const [booted, setBooted] = useState(false);

  useEffect(() => {
    loadSaved()
      .then((saved) => {
        if (saved) {
          useEditor.getState().load(saved.project, saved.profileId);
          useEditor.getState().setSaveState("saved");
        }
      })
      .catch(() => undefined)
      .finally(() => setBooted(true));
  }, []);

  useEffect(() => (project ? connectPreview() : undefined), [project === null]);
  useAutosave();

  // A change of interface language renders everything again with the new strings.
  const lang = useLanguage((s) => s.lang);
  if (!booted) return null;
  if (!project) return <Welcome key={lang} />;
  return <Editor key={lang} />;
}

const openEvent = (name: string) => () => window.dispatchEvent(new Event(name));

/** Narrow screens show one pane at a time; these tabs switch between them. */
function PaneTabs() {
  const pane = useEditor((s) => s.pane);
  const setPane = useEditor((s) => s.setPane);
  const tabs: [typeof pane, string][] = [
    ["nav", t.panes.nav],
    ["edit", t.panes.edit],
    ["preview", t.panes.preview],
  ];
  return (
    <nav aria-label={t.panes.label} className="grid grid-cols-3 border-t border-line bg-surface lg:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      {tabs.map(([id, label]) => (
        <button key={id} aria-current={pane === id || undefined} onClick={() => setPane(id)} className={`py-3 text-sm ${pane === id ? "font-semibold text-accent" : "text-muted"}`}>
          {label}
        </button>
      ))}
    </nav>
  );
}

function Editor() {
  const pane = useEditor((s) => s.pane);
  const [exporting, setExporting] = useState(false);
  const [palette, setPalette] = useState(false);
  const openExport = useCallback(() => setExporting(true), []);
  const openPalette = useCallback(() => setPalette(true), []);
  useShortcuts(openExport, openPalette);
  useEffect(() => {
    window.addEventListener("foja:palette", openPalette);
    return () => window.removeEventListener("foja:palette", openPalette);
  }, [openPalette]);
  return (
    <div className="grid h-full grid-rows-[auto_1fr] bg-bg text-ink">
      <TopBar onExport={() => setExporting(true)} />
      <div className="grid min-h-0 grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)_auto] lg:grid-cols-[13rem_minmax(22rem,1fr)_minmax(24rem,1.1fr)] lg:grid-rows-1">
        <div className={`min-h-0 ${pane === "nav" ? "grid" : "hidden"} lg:grid`}>
          <Navigation />
        </div>
        <main className={`min-h-0 overflow-auto border-r border-line bg-surface p-5 ${pane === "edit" ? "" : "hidden"} lg:block`}>
          <SelectionPanel />
        </main>
        <div className={`min-h-0 ${pane === "preview" ? "grid" : "hidden"} lg:grid`}>
          <Preview />
        </div>
        <PaneTabs />
      </div>
      {exporting && <ExportDialog onClose={() => setExporting(false)} />}
      {palette && <Palette onClose={() => setPalette(false)} onExport={openExport} />}
    </div>
  );
}

function TopBar({ onExport }: { onExport: () => void }) {
  const project = useEditor((s) => s.project!);
  const profileId = useEditor((s) => s.profileId);
  const saveState = useEditor((s) => s.saveState);
  const { update, setProfile, load } = useEditor.getState();
  const [confirming, setConfirming] = useState(false);
  const [projectMenu, setProjectMenu] = useState(false);
  const [more, setMore] = useState(false);
  const [importError, setImportError] = useState<string>();
  const ids = Object.keys(project.profiles);

  function addProfile() {
    let id = "";
    update((p) => {
      const [newIdValue, profile] = newProfile(p);
      id = newIdValue;
      p.profiles[id] = profile;
    });
    setProfile(id);
  }

  function duplicate() {
    let id = "";
    update((p) => {
      const copy = structuredClone(p.profiles[profileId]);
      copy.name = `${profileName(profileId, copy)} (copia)`;
      id = newProfile(p)[0];
      p.profiles[id] = copy;
    });
    setProfile(id);
  }

  const deleteControls =
    ids.length > 1 &&
    (confirming ? (
      <span className="flex items-center gap-1 text-sm">
        <Button
          variant="danger"
          onClick={() => {
            update((p) => delete p.profiles[profileId]);
            setConfirming(false);
          }}
        >
          {t.yesDelete}
        </Button>
        <Button onClick={() => setConfirming(false)}>{t.cancel}</Button>
      </span>
    ) : (
      <Button variant="ghost" onClick={() => setConfirming(true)}>
        {t.deleteProfile}
      </Button>
    ));

  return (
    <header className="relative flex items-center gap-2 border-b border-line bg-surface px-3 py-2 lg:flex-wrap">
      <a href={import.meta.env.BASE_URL} className="mr-1 font-heading text-xl font-semibold tracking-wide text-accent lg:mr-2">
        {t.appName}
      </a>
      <label className="flex min-w-0 items-center gap-1 text-sm">
        <span className="hidden sm:inline">{t.profile}</span>
        <select
          aria-label={t.profile}
          className="max-w-[9rem] rounded border border-line bg-surface px-2 py-1 text-sm sm:max-w-none"
          value={profileId}
          onChange={(e) => setProfile(e.target.value)}
        >
          {ids.map((id) => (
            <option key={id} value={id}>
              {profileName(id, project.profiles[id])}
            </option>
          ))}
        </select>
      </label>

      {/* Secondary actions: inline on wide screens, a "more" menu on narrow ones. */}
      <div
        id="more-actions"
        className={`${more ? "flex" : "hidden"} absolute top-full right-2 z-30 mt-1 w-64 flex-col items-stretch gap-1 rounded-lg border border-line bg-surface p-2 shadow-lg lg:contents`}
      >
        <Button onClick={addProfile}>+ {t.newProfile}</Button>
        <Button onClick={duplicate}>{t.duplicate}</Button>
        {deleteControls}
        <span className="hidden lg:ml-auto lg:block" />
        <div className="relative">
          <Button onClick={() => setProjectMenu(!projectMenu)}>{t.project} ▾</Button>
          {projectMenu && (
            <div className="absolute right-0 z-10 mt-1 flex w-56 flex-col gap-1 rounded border border-line bg-surface p-2 shadow-lg">
              <Button variant="ghost" onClick={() => (load(emptyProject()), setProjectMenu(false))}>
                {t.newProject}
              </Button>
              <Button variant="ghost" onClick={() => (load(exampleProject()), setProjectMenu(false))}>
                {t.startExample}
              </Button>
              <ImportButton
                className="cursor-pointer rounded px-2 py-1 text-sm hover:bg-surface-2"
                onError={(m) => {
                  setImportError(m);
                  if (!m) setProjectMenu(false);
                }}
              />
              {importError && <p className="text-xs whitespace-pre-wrap text-danger">{`${t.importFailed}\n${importError}`}</p>}
            </div>
          )}
        </div>
        <ThemeMenu />
        <Button variant="ghost" title="Ctrl+K" onClick={() => (setMore(false), openEvent("foja:palette")())}>
          ⌘ {t.palette.title}
        </Button>
      </div>

      <div className="ml-auto flex items-center gap-1 lg:ml-0 lg:gap-2">
        <span className="text-xs text-muted" title={saveState === "saved" ? t.saved : t.unsaved}>
          <span data-testid="save-state" className="hidden sm:inline">{saveState === "saved" ? t.saved : saveState === "saving" ? t.saving : `● ${t.unsaved}`}</span>
          <span className="sm:hidden" aria-hidden>
            {saveState === "saved" ? "✓" : "●"}
          </span>
        </span>
        <Button variant="ghost" label={t.undo} title={`${t.undo} (Ctrl+Z)`} onClick={undo}>
          ↶
        </Button>
        <Button variant="ghost" label={t.redo} title={`${t.redo} (Ctrl+Shift+Z)`} onClick={redo}>
          ↷
        </Button>
        <span className="lg:hidden">
          <Button variant="ghost" label={t.more} onClick={() => setMore(!more)}>
            ⋯
          </Button>
        </span>
        <Button variant="primary" title="Ctrl+E" onClick={onExport}>
          {t.export}
        </Button>
      </div>
    </header>
  );
}

function NavItem({ selection, children }: { selection: Selection; children: React.ReactNode }) {
  return (
    <li>
      <NavButton selection={selection}>{children}</NavButton>
    </li>
  );
}

function NavButton({ selection, children }: { selection: Selection; children: React.ReactNode }) {
  const current = useEditor((s) => s.selection);
  const select = useEditor((s) => s.select);
  const active = JSON.stringify(current) === JSON.stringify(selection) || (selection.kind === "entries" && current.kind === "entry");
  return (
      <button
        aria-current={active || undefined}
        onClick={() => select(selection)}
        className={`w-full truncate rounded px-2 py-1 text-left text-sm ${active ? "bg-accent-soft font-medium text-accent-ink" : "hover:bg-surface-2"}`}
      >
        {children}
      </button>
  );
}

function Navigation() {
  const profile = useEditor((s) => s.project!.profiles[s.profileId]);
  const profileId = useEditor((s) => s.profileId);
  const { update, select } = useEditor.getState();
  const twoColumns = (profile?.layout?.columns ?? 2) === 2;
  const marks = usePreview((s) => s.marks);
  const templates = useEditor((s) => s.project!.templates);
  const overflow = useMemo(() => overflowingSections(marks), [marks]);
  return (
    <nav aria-label={t.sections} className="min-h-0 overflow-auto border-r border-line p-2">
      <h3 className="px-2 pt-1 pb-1 text-xs font-semibold tracking-wide text-muted uppercase">{t.data}</h3>
      <ul className="flex flex-col gap-0.5">
        <NavItem selection={{ kind: "person" }}>{t.personal}</NavItem>
        <NavItem selection={{ kind: "contacts" }}>{t.contacts}</NavItem>
        <NavItem selection={{ kind: "skills" }}>{t.skills}</NavItem>
        <NavItem selection={{ kind: "entries" }}>{t.entries}</NavItem>
      </ul>
      <h3 className="px-2 pt-4 pb-1 text-xs font-semibold tracking-wide text-muted uppercase">{t.profile}</h3>
      <ul className="flex flex-col gap-0.5">
        <NavItem selection={{ kind: "profile" }}>{t.profileText}</NavItem>
        <NavItem selection={{ kind: "layout" }}>{t.layout}</NavItem>
        {Object.entries(templates ?? {}).map(([id, style]) => (
          <NavItem key={id} selection={{ kind: "style", id }}>
            <span className="text-muted">{"{ }"}</span> {style.name}
          </NavItem>
        ))}
      </ul>
      <h3 className="px-2 pt-4 pb-1 text-xs font-semibold tracking-wide text-muted uppercase">{t.sections}</h3>
      <SortableList
        ids={profile?.sections.map((s) => s.id) ?? []}
        onMove={(from, to) => {
          update((p) => move(p.profiles[profileId].sections, from, to));
          select({ kind: "section", index: to });
        }}
      >
        <ul className="flex flex-col gap-0.5">
          {profile?.sections.map((s, i) => (
            <SortableItem key={s.id} id={s.id} as="li" className="flex items-center">
              {(handle) => (
                <>
                  {handle}
                  <NavButton selection={{ kind: "section", index: i }}>
                    {s.title || "—"}
                    {twoColumns && s.column === "side" && <span className="ml-1 text-xs text-muted">({t.side.toLowerCase()})</span>}
                    {overflow.has(i) && (
                      <span className="ml-1 text-amber-700" title={t.overflows}>
                        ⚠
                      </span>
                    )}
                  </NavButton>
                </>
              )}
            </SortableItem>
          ))}
        </ul>
      </SortableList>
      <div className="px-2 pt-2">
        <Button onClick={() => select({ kind: "section", index: addSection(update, profileId) })}>+ {t.addSection}</Button>
      </div>
    </nav>
  );
}

function SelectionPanel() {
  const selection = useEditor((s) => s.selection);
  switch (selection.kind) {
    case "person":
      return <PersonForm />;
    case "contacts":
      return <ContactsForm />;
    case "skills":
      return <SkillsForm />;
    case "entries":
      return <EntriesList />;
    case "entry":
      return <EntryForm key={selection.id} id={selection.id} />;
    case "layout":
      return <LayoutForm />;
    case "style":
      return <StyleEditor key={selection.id} id={selection.id} />;
    case "section":
      return <SectionForm key={selection.index} index={selection.index} />;
    default:
      return <ProfileTextForm />;
  }
}
