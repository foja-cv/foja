import { slug, type SkillGroup } from "@foja/core";
import { t } from "../i18n";
import { pointer, useEditor, useProblem } from "../store";
import { Button, Field, LinesArea, Panel, TextInput } from "../ui";

export function SkillsForm() {
  const skills = useEditor((s) => s.project!.skills);
  const update = useEditor((s) => s.update);

  function add() {
    update((p) => {
      const id = newId("grupo", p.skills);
      p.skills[id] = { title: "Nuevo grupo", items: [] };
    });
  }

  return (
    <Panel title={t.skills} actions={<Button onClick={add}>{t.addGroup}</Button>}>
      {Object.entries(skills).map(([id, group]) => (
        <SkillGroupEditor key={id} id={id} group={group} />
      ))}
    </Panel>
  );
}

function SkillGroupEditor({ id, group }: { id: string; group: SkillGroup }) {
  const update = useEditor((s) => s.update);
  const problem = useProblem(pointer("skills", id, "title"));
  function remove() {
    update((p) => {
      delete p.skills[id];
      // Out of every profile too; rows left empty go away.
      for (const profile of Object.values(p.profiles)) {
        profile.skills = profile.skills.map((row) => row.filter((g) => g !== id)).filter((row) => row.length > 0);
      }
    });
  }
  return (
    <div className="flex flex-col gap-2 rounded border border-neutral-200 p-3 dark:border-neutral-700">
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Field label={t.groupTitle} problem={problem}>
            {(fid) => <TextInput id={fid} value={group.title} onChange={(v) => update((p) => (p.skills[id].title = v))} />}
          </Field>
        </div>
        <Button variant="ghost" label={`${t.remove} ${group.title}`} onClick={remove}>
          ✕
        </Button>
      </div>
      <Field label={t.groupItems}>{(fid) => <LinesArea id={fid} value={group.items} onChange={(v) => update((p) => (p.skills[id].items = v))} />}</Field>
    </div>
  );
}

/** A free id derived from `base` (a title or a word). */
export function newId(base: string, taken: Record<string, unknown>) {
  const root = slug(base) || "item";
  let id = root;
  for (let n = 2; id in taken; n++) id = `${root}-${n}`;
  return id;
}
