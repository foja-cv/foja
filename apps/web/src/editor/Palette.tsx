// Command palette (Ctrl+K): every panel, section, entry and profile, plus the main actions,
// filtered as you type (accents and case ignored).

import { useEffect, useMemo, useRef, useState } from "react";
import { profileName } from "@foja/core";
import { t } from "./i18n";
import { redo, undo, useEditor, type Selection } from "./store";

interface Command {
  label: string;
  group: string;
  run: () => void;
}

const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

function useCommands(onExport: () => void): Command[] {
  const project = useEditor((s) => s.project!);
  const profileId = useEditor((s) => s.profileId);
  const { select, setProfile, update } = useEditor.getState();
  return useMemo(() => {
    const go = (label: string, selection: Selection): Command => ({ label, group: t.palette.goTo, run: () => select(selection) });
    const profile = project.profiles[profileId];
    const columns = profile?.layout?.columns ?? 2;
    return [
      { label: t.export, group: t.palette.actions, run: onExport },
      { label: t.undo, group: t.palette.actions, run: undo },
      { label: t.redo, group: t.palette.actions, run: redo },
      {
        label: columns === 2 ? t.palette.oneColumn : t.palette.twoColumns,
        group: t.palette.actions,
        run: () =>
          update((p) => {
            const l = { ...p.profiles[profileId].layout };
            if (columns === 2) l.columns = 1;
            else delete l.columns;
            p.profiles[profileId].layout = l;
          }),
      },
      go(t.personal, { kind: "person" }),
      go(t.contacts, { kind: "contacts" }),
      go(t.skills, { kind: "skills" }),
      go(t.entries, { kind: "entries" }),
      go(t.profileText, { kind: "profile" }),
      go(t.layout, { kind: "layout" }),
      ...Object.entries(project.templates ?? {}).map(([id, s]) => go(`${t.styles.editor}: ${s.name}`, { kind: "style", id })),
      ...(profile?.sections.map((s, i) => go(`${t.sections}: ${s.title}`, { kind: "section", index: i })) ?? []),
      ...Object.entries(project.entries).map(([id, e]) => go(`${t.palette.entry}: ${e.title}`, { kind: "entry", id })),
      ...Object.entries(project.profiles)
        .filter(([id]) => id !== profileId)
        .map(([id, p]) => ({ label: `${t.profile}: ${profileName(id, p)}`, group: t.palette.switchProfile, run: () => setProfile(id) })),
    ];
  }, [project, profileId, onExport]);
}

export function Palette({ onClose, onExport }: { onClose: () => void; onExport: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const commands = useCommands(onExport);
  const words = fold(query).split(/\s+/).filter(Boolean);
  const matches = commands.filter((c) => words.every((w) => fold(c.label).includes(w))).slice(0, 12);

  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  useEffect(() => setIndex(0), [query]);

  function run(c: Command | undefined) {
    if (!c) return;
    onClose();
    c.run();
  }

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      aria-label={t.palette.title}
      className="mx-auto mt-24 w-[min(36rem,calc(100vw-2rem))] rounded-lg bg-surface p-0 text-ink shadow-xl backdrop:bg-black/30"
    >
      <input
        autoFocus
        role="combobox"
        aria-expanded="true"
        aria-controls="palette-list"
        aria-activedescendant={matches[index] ? `palette-${index}` : undefined}
        placeholder={t.palette.placeholder}
        className="w-full border-b border-line px-4 py-3 outline-none"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") (e.preventDefault(), setIndex(Math.min(index + 1, matches.length - 1)));
          else if (e.key === "ArrowUp") (e.preventDefault(), setIndex(Math.max(index - 1, 0)));
          else if (e.key === "Enter") (e.preventDefault(), run(matches[index]));
        }}
      />
      <ul id="palette-list" role="listbox" className="max-h-80 overflow-auto py-1">
        {matches.map((c, i) => (
          <li
            key={`${c.group}-${c.label}`}
            id={`palette-${i}`}
            role="option"
            aria-selected={i === index}
            // Only a real movement selects: a list appearing under a resting pointer must not
            // change what Enter runs.
            onMouseMove={() => i !== index && setIndex(i)}
            onClick={() => run(c)}
            className={`flex cursor-pointer justify-between px-4 py-1.5 text-sm ${i === index ? "bg-accent-soft" : ""}`}
          >
            <span>{c.label}</span>
            <span className="text-xs text-muted">{c.group}</span>
          </li>
        ))}
        {matches.length === 0 && <li className="px-4 py-2 text-sm text-muted">{t.palette.nothing}</li>}
      </ul>
    </dialog>
  );
}
