import type { Entry, Project } from "@foja/core";
import { t } from "../i18n";
import { pointer, useEditor, useProblem } from "../store";
import { Button, Field, Panel, Select, TextArea, TextInput } from "../ui";
import { ItemsEditor } from "./Items";
import { newId } from "./Skills";

export function profilesUsing(project: Project, entryId: string): string[] {
  return Object.entries(project.profiles)
    .filter(([, p]) => p.sections.some((s) => s.blocks.some((b) => b.type === "entry" && b.entry === entryId)))
    .map(([id, p]) => p.name ?? id);
}

/** Adds a blank entry to the bank and returns its id. */
export function createEntry(p: Project, title = "Nueva entrada"): string {
  const id = newId(title, p.entries);
  p.entries[id] = { title };
  return id;
}

export function EntriesList() {
  const project = useEditor((s) => s.project!);
  const update = useEditor((s) => s.update);
  const select = useEditor((s) => s.select);
  return (
    <Panel
      title={t.entries}
      actions={
        <Button
          onClick={() => {
            let id = "";
            update((p) => (id = createEntry(p)));
            select({ kind: "entry", id });
          }}
        >
          {t.addEntry}
        </Button>
      }
    >
      <ul className="flex flex-col divide-y divide-neutral-200 dark:divide-neutral-700">
        {Object.entries(project.entries).map(([id, e]) => (
          <li key={id}>
            <button className="flex w-full flex-col items-start px-1 py-2 text-left hover:bg-neutral-100 dark:hover:bg-neutral-800" onClick={() => select({ kind: "entry", id })}>
              <span className="text-sm font-medium">{e.title}</span>
              <span className="text-xs text-neutral-500">
                {[e.place, profilesUsing(project, id).join(", ") || "—"].filter(Boolean).join(" · ")}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

type EndMode = "date" | "ongoing" | "single";
const endMode = (e: Entry): EndMode => (!("end" in e) || e.end === undefined ? "single" : e.end === null ? "ongoing" : "date");

export function EntryForm({ id }: { id: string }) {
  const project = useEditor((s) => s.project!);
  const update = useEditor((s) => s.update);
  const select = useEditor((s) => s.select);
  const entry = project.entries[id];
  const base = pointer("entries", id);
  const problems = {
    title: useProblem(`${base}/title`),
    start: useProblem(`${base}/start`),
    end: useProblem(`${base}/end`),
  };
  if (!entry) return null;
  const users = profilesUsing(project, id);
  const edit = (fn: (e: Entry) => void) => update((p) => fn(p.entries[id]));
  const mode = endMode(entry);

  return (
    <Panel
      title={entry.title || t.addEntry}
      actions={
        <Button
          variant="danger"
          disabled={users.length > 0}
          title={users.length ? t.entryInUse : t.deleteEntry}
          onClick={() => {
            update((p) => delete p.entries[id]);
            select({ kind: "entries" });
          }}
        >
          {t.deleteEntry}
        </Button>
      }
    >
      <p className="rounded bg-amber-50 px-2 py-1 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-200">{t.usedIn(users)}</p>
      <Field label={t.title} problem={problems.title}>
        {(fid) => <TextInput id={fid} value={entry.title} onChange={(v) => edit((e) => (e.title = v))} />}
      </Field>
      <Field label={t.place}>
        {(fid) => (
          <TextInput
            id={fid}
            value={entry.place ?? ""}
            onChange={(v) =>
              edit((e) => {
                if (v) e.place = v;
                else delete e.place;
              })
            }
          />
        )}
      </Field>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label={t.start} problem={problems.start}>
          {(fid) => (
            <TextInput
              id={fid}
              type="month"
              value={entry.start ?? ""}
              onChange={(v) =>
                edit((e) => {
                  if (v) e.start = v;
                  else {
                    delete e.start;
                    delete e.end;
                  }
                })
              }
            />
          )}
        </Field>
        <Field label={t.end}>
          {(fid) => (
            <Select<EndMode>
              id={fid}
              value={mode}
              options={[
                ["date", t.end],
                ["ongoing", t.ongoing],
                ["single", t.singleDate],
              ]}
              onChange={(v) =>
                edit((e) => {
                  if (v === "single") delete e.end;
                  else if (v === "ongoing") e.end = null;
                  else e.end = e.start ?? "";
                })
              }
            />
          )}
        </Field>
        {mode === "date" && (
          <Field label={t.end} problem={problems.end}>
            {(fid) => <TextInput id={fid} type="month" value={entry.end ?? ""} onChange={(v) => edit((e) => (e.end = v))} />}
          </Field>
        )}
      </div>
      <Field label={t.note}>
        {(fid) => (
          <TextInput
            id={fid}
            value={entry.note ?? ""}
            onChange={(v) =>
              edit((e) => {
                if (v) e.note = v;
                else delete e.note;
              })
            }
          />
        )}
      </Field>
      <Field label={t.items}>
        {() => (
          <ItemsEditor
            base={`${base}/items`}
            items={entry.items ?? []}
            onChange={(items) =>
              edit((e) => {
                if (items.length) e.items = items;
                else delete e.items;
              })
            }
          />
        )}
      </Field>
    </Panel>
  );
}
