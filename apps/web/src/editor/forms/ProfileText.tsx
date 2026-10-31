import { CONTACT_KINDS } from "@foja/core";
import { t } from "../i18n";
import { pointer, useEditor, useProblem } from "../store";
import { Check, Field, ListControls, Panel, TextArea, TextInput, move } from "../ui";

export function ProfileTextForm() {
  const project = useEditor((s) => s.project!);
  const profileId = useEditor((s) => s.profileId);
  const update = useEditor((s) => s.update);
  const base = pointer("profiles", profileId);
  const problems = { subtitle: useProblem(`${base}/subtitle`), highlightTitle: useProblem(`${base}/highlight/title`), highlightText: useProblem(`${base}/highlight/text`) };
  const profile = project.profiles[profileId];
  if (!profile) return null;
  const edit = (fn: (p: typeof profile) => void) => update((p) => fn(p.profiles[profileId]));
  const groups = Object.entries(project.skills);
  const used = new Set(profile.skills.flat());

  return (
    <Panel title={t.profileText}>
      <Field label={t.profileName}>
        {(fid) => (
          <TextInput
            id={fid}
            value={profile.name ?? ""}
            placeholder={profileId}
            onChange={(v) =>
              edit((p) => {
                if (v) p.name = v;
                else delete p.name;
              })
            }
          />
        )}
      </Field>
      <Field label={t.subtitle} problem={problems.subtitle}>
        {(fid) => <TextInput id={fid} value={profile.subtitle} onChange={(v) => edit((p) => (p.subtitle = v))} />}
      </Field>
      <Field label={t.summary}>{(fid) => <TextArea id={fid} rows={5} value={profile.summary} onChange={(v) => edit((p) => (p.summary = v))} />}</Field>

      <Check
        label={t.highlight}
        checked={!!profile.highlight}
        onChange={(v) =>
          edit((p) => {
            if (v) p.highlight = { title: "Postulación", text: "" };
            else delete p.highlight;
          })
        }
      />
      {profile.highlight && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={t.highlightTitle} problem={problems.highlightTitle}>
            {(fid) => <TextInput id={fid} value={profile.highlight!.title} onChange={(v) => edit((p) => (p.highlight!.title = v))} />}
          </Field>
          <Field label={t.highlightText} problem={problems.highlightText}>
            {(fid) => <TextInput id={fid} value={profile.highlight!.text} onChange={(v) => edit((p) => (p.highlight!.text = v))} />}
          </Field>
        </div>
      )}

      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 text-xs font-medium text-neutral-600 dark:text-neutral-300">{t.profileContacts}</legend>
        {CONTACT_KINDS.filter((k) => project.contacts[k]).map((kind) => (
          <Check
            key={kind}
            label={`${t.contactKinds[kind]}: ${project.contacts[kind]}`}
            checked={profile.contacts.includes(kind)}
            onChange={(v) =>
              edit((p) => {
                // Keep the order of CONTACT_KINDS, which is the order on the page.
                const set = new Set(p.contacts);
                if (v) set.add(kind);
                else set.delete(kind);
                p.contacts = CONTACT_KINDS.filter((k) => set.has(k));
              })
            }
          />
        ))}
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-xs font-medium text-neutral-600 dark:text-neutral-300">{t.profileSkills}</legend>
        {profile.skills.map((row, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2 rounded border border-neutral-200 p-2 dark:border-neutral-700">
            {row.map((g, j) => (
              <span key={g} className="flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-sm dark:bg-neutral-800">
                {project.skills[g]?.title ?? g}
                <button
                  aria-label={`${t.remove} ${project.skills[g]?.title ?? g}`}
                  className="text-neutral-500 hover:text-red-700"
                  onClick={() =>
                    edit((p) => {
                      p.skills[i].splice(j, 1);
                      if (p.skills[i].length === 0) p.skills.splice(i, 1);
                    })
                  }
                >
                  ✕
                </button>
              </span>
            ))}
            <select
              className="rounded border border-neutral-300 bg-white px-1 py-0.5 text-sm dark:border-neutral-600 dark:bg-neutral-900"
              value=""
              aria-label={t.addToRow}
              onChange={(e) => e.target.value && edit((p) => p.skills[i].push(e.target.value))}
            >
              <option value="">{t.addToRow}</option>
              {groups.filter(([id]) => !used.has(id)).map(([id, g]) => (
                <option key={id} value={id}>
                  {g.title}
                </option>
              ))}
            </select>
            <div className="ml-auto">
              <ListControls index={i} length={profile.skills.length} move={(a, b) => edit((p) => move(p.skills, a, b))} remove={() => edit((p) => p.skills.splice(i, 1))} labels={t} />
            </div>
          </div>
        ))}
        <div>
          <select
            className="rounded border border-neutral-300 bg-white px-2 py-1 text-sm dark:border-neutral-600 dark:bg-neutral-900"
            value=""
            aria-label={t.addRow}
            onChange={(e) => e.target.value && edit((p) => p.skills.push([e.target.value]))}
          >
            <option value="">{t.addRow}…</option>
            {groups.filter(([id]) => !used.has(id)).map(([id, g]) => (
              <option key={id} value={id}>
                {g.title}
              </option>
            ))}
          </select>
        </div>
      </fieldset>
    </Panel>
  );
}

/** "+ section" lives in the navigation; this creates it. */
export function addSection(update: ReturnType<typeof useEditor.getState>["update"], profileId: string): number {
  let index = 0;
  update((p) => {
    const sections = p.profiles[profileId].sections;
    let id = "seccion";
    for (let n = 2; sections.some((s) => s.id === id); n++) id = `seccion-${n}`;
    sections.push({ id, title: "Nueva sección", blocks: [] });
    index = sections.length - 1;
  });
  return index;
}

