// The editor island: header (profiles, history, saving, export), navigation, the panel of the
// selection and the live preview.

import { useEffect, useState } from "react";
import { profileName } from "@foja/core";
import { ExportDialog } from "./ExportDialog";
import { ContactsForm } from "./forms/Contacts";
import { EntriesList, EntryForm } from "./forms/Entries";
import { LayoutForm } from "./forms/Layout";
import { PersonForm } from "./forms/Person";
import { addSection, ProfileTextForm } from "./forms/ProfileText";
import { SectionForm } from "./forms/Section";
import { SkillsForm } from "./forms/Skills";
import { t } from "./i18n";
import { connectPreview } from "./preview";
import { emptyProject, exampleProject, newProfile } from "./projects";
import { loadSaved, save } from "./storage";
import { redo, undo, useEditor, type Selection } from "./store";
import { Button } from "./ui";
import { ImportButton, Welcome } from "./Welcome";
import { Preview } from "./Preview";

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

function useShortcuts(openExport: () => void) {
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
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openExport]);
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

  if (!booted) return null;
  if (!project) return <Welcome />;
  return <Editor />;
}

function Editor() {
  const [exporting, setExporting] = useState(false);
  useShortcuts(() => setExporting(true));
  return (
    <div className="grid h-full grid-rows-[auto_1fr] bg-white text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100">
      <TopBar onExport={() => setExporting(true)} />
      <div className="grid min-h-0 grid-cols-1 lg:grid-cols-[13rem_minmax(22rem,1fr)_minmax(24rem,1.1fr)]">
        <Navigation />
        <main className="min-h-0 overflow-auto border-r border-neutral-200 p-4 dark:border-neutral-700">
          <SelectionPanel />
        </main>
        <Preview />
      </div>
      {exporting && <ExportDialog onClose={() => setExporting(false)} />}
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

  return (
    <header className="flex flex-wrap items-center gap-2 border-b border-neutral-200 px-3 py-2 dark:border-neutral-700">
      <a href={import.meta.env.BASE_URL} className="mr-2 font-semibold tracking-wide">
        {t.appName}
      </a>
      <label className="flex items-center gap-1 text-sm">
        {t.profile}
        <select
          aria-label={t.profile}
          className="rounded border border-neutral-300 bg-white px-2 py-1 text-sm dark:border-neutral-600 dark:bg-neutral-800"
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
      <Button onClick={addProfile}>+ {t.newProfile}</Button>
      <Button onClick={duplicate}>{t.duplicate}</Button>
      {ids.length > 1 &&
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
        ))}

      <div className="ml-auto flex items-center gap-2">
        <span data-testid="save-state" className="text-xs text-neutral-500">
          {saveState === "saved" ? t.saved : saveState === "saving" ? t.saving : `● ${t.unsaved}`}
        </span>
        <Button variant="ghost" label={t.undo} title={`${t.undo} (Ctrl+Z)`} onClick={undo}>
          ↶
        </Button>
        <Button variant="ghost" label={t.redo} title={`${t.redo} (Ctrl+Shift+Z)`} onClick={redo}>
          ↷
        </Button>
        <div className="relative">
          <Button onClick={() => setProjectMenu(!projectMenu)}>{t.project} ▾</Button>
          {projectMenu && (
            <div className="absolute right-0 z-10 mt-1 flex w-56 flex-col gap-1 rounded border border-neutral-200 bg-white p-2 shadow-lg dark:border-neutral-700 dark:bg-neutral-800">
              <Button variant="ghost" onClick={() => (load(emptyProject()), setProjectMenu(false))}>
                {t.newProject}
              </Button>
              <Button variant="ghost" onClick={() => (load(exampleProject()), setProjectMenu(false))}>
                {t.startExample}
              </Button>
              <ImportButton
                className="cursor-pointer rounded px-2 py-1 text-sm hover:bg-neutral-200 dark:hover:bg-neutral-700"
                onError={(m) => {
                  setImportError(m);
                  if (!m) setProjectMenu(false);
                }}
              />
              {importError && <p className="text-xs whitespace-pre-wrap text-red-700">{`${t.importFailed}\n${importError}`}</p>}
            </div>
          )}
        </div>
        <Button variant="primary" title="Ctrl+E" onClick={onExport}>
          {t.export}
        </Button>
      </div>
    </header>
  );
}

function NavItem({ selection, children }: { selection: Selection; children: React.ReactNode }) {
  const current = useEditor((s) => s.selection);
  const select = useEditor((s) => s.select);
  const active = JSON.stringify(current) === JSON.stringify(selection) || (selection.kind === "entries" && current.kind === "entry");
  return (
    <li>
      <button
        aria-current={active || undefined}
        onClick={() => select(selection)}
        className={`w-full truncate rounded px-2 py-1 text-left text-sm ${active ? "bg-sky-100 font-medium text-sky-900 dark:bg-sky-900 dark:text-sky-100" : "hover:bg-neutral-100 dark:hover:bg-neutral-800"}`}
      >
        {children}
      </button>
    </li>
  );
}

function Navigation() {
  const profile = useEditor((s) => s.project!.profiles[s.profileId]);
  const profileId = useEditor((s) => s.profileId);
  const { update, select } = useEditor.getState();
  const twoColumns = (profile?.layout?.columns ?? 2) === 2;
  return (
    <nav aria-label={t.sections} className="min-h-0 overflow-auto border-r border-neutral-200 p-2 dark:border-neutral-700">
      <h3 className="px-2 pt-1 pb-1 text-xs font-semibold tracking-wide text-neutral-500 uppercase">{t.data}</h3>
      <ul className="flex flex-col gap-0.5">
        <NavItem selection={{ kind: "person" }}>{t.personal}</NavItem>
        <NavItem selection={{ kind: "contacts" }}>{t.contacts}</NavItem>
        <NavItem selection={{ kind: "skills" }}>{t.skills}</NavItem>
        <NavItem selection={{ kind: "entries" }}>{t.entries}</NavItem>
      </ul>
      <h3 className="px-2 pt-4 pb-1 text-xs font-semibold tracking-wide text-neutral-500 uppercase">{t.profile}</h3>
      <ul className="flex flex-col gap-0.5">
        <NavItem selection={{ kind: "profile" }}>{t.profileText}</NavItem>
        <NavItem selection={{ kind: "layout" }}>{t.layout}</NavItem>
      </ul>
      <h3 className="px-2 pt-4 pb-1 text-xs font-semibold tracking-wide text-neutral-500 uppercase">{t.sections}</h3>
      <ul className="flex flex-col gap-0.5">
        {profile?.sections.map((s, i) => (
          <NavItem key={`${s.id}-${i}`} selection={{ kind: "section", index: i }}>
            {s.title || "—"}
            {twoColumns && s.column === "side" && <span className="ml-1 text-xs text-neutral-500">({t.side.toLowerCase()})</span>}
          </NavItem>
        ))}
      </ul>
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
    case "section":
      return <SectionForm key={selection.index} index={selection.index} />;
    default:
      return <ProfileTextForm />;
  }
}
