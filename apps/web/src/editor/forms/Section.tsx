import type { Block, Section } from "@foja/core";
import { t } from "../i18n";
import { pointer, useEditor, useProblem } from "../store";
import { SortableItem, SortableList } from "../Sortable";
import { Button, Check, Field, ListControls, Panel, Select, TextArea, TextInput, move } from "../ui";
import { createEntry } from "./Entries";
import { ItemRow } from "./Items";

export function SectionForm({ index }: { index: number }) {
  const project = useEditor((s) => s.project!);
  const profileId = useEditor((s) => s.profileId);
  const update = useEditor((s) => s.update);
  const select = useEditor((s) => s.select);
  const base = pointer("profiles", profileId, "sections", index);
  const titleProblem = useProblem(`${base}/title`);
  const section = project.profiles[profileId]?.sections[index];
  if (!section) return null;
  const edit = (fn: (s: Section) => void) => update((p) => fn(p.profiles[profileId].sections[index]));
  const included = new Set(section.blocks.flatMap((b) => (b.type === "entry" ? [b.entry] : [])));
  const available = Object.entries(project.entries).filter(([id]) => !included.has(id));
  const twoColumns = (project.profiles[profileId].layout?.columns ?? 2) === 2;

  const renderBlock = (block: Block, i: number) => {
    const controls = (
      <ListControls index={i} length={section.blocks.length} move={(a, b) => edit((s) => move(s.blocks, a, b))} remove={() => edit((s) => s.blocks.splice(i, 1))} labels={t} />
    );
    const editBlock = (fn: (b: Block) => void) => edit((s) => fn(s.blocks[i]));
    if (block.type === "entry") {
      const entry = project.entries[block.entry];
      return (
        <div key={i} className="flex items-center gap-2 rounded border border-line p-2">
          <span className="text-xs text-muted">{t.sectionKinds.entry}</span>
          <button className="flex-1 text-left text-sm font-medium text-accent hover:underline" onClick={() => select({ kind: "entry", id: block.entry })}>
            {entry?.title ?? block.entry}
          </button>
          {controls}
        </div>
      );
    }
    if (block.type === "item") {
      return (
        <ItemRow key={i} item={block} path={`${base}/blocks/${i}`} edit={(fn) => editBlock((b) => fn(b as { heading?: string; text: string }))}>
          {controls}
        </ItemRow>
      );
    }
    return (
      <div key={i} className="flex gap-2 rounded border border-line p-2">
        <div className="flex-1">
          <TextArea rows={3} label={t.sectionKinds.paragraph} value={block.text} onChange={(v) => editBlock((b) => ((b as { text: string }).text = v))} />
        </div>
        {controls}
      </div>
    );
  };

  return (
    <Panel
      title={section.title || t.sections}
      actions={
        <Button
          variant="danger"
          onClick={() => {
            update((p) => p.profiles[profileId].sections.splice(index, 1));
            select({ kind: "profile" });
          }}
        >
          {t.deleteSection}
        </Button>
      }
    >
      <Field label={t.sectionTitle} problem={titleProblem}>
        {(fid) => <TextInput id={fid} value={section.title} onChange={(v) => edit((s) => (s.title = v))} />}
      </Field>
      <div className="flex flex-wrap items-end gap-4">
        {twoColumns && (
          <Field label={t.column}>
            {(fid) => (
              <Select
                id={fid}
                value={section.column ?? "main"}
                options={[
                  ["main", t.main],
                  ["side", t.side],
                ]}
                onChange={(v) =>
                  edit((s) => {
                    if (v === "side") s.column = "side";
                    else delete s.column;
                  })
                }
              />
            )}
          </Field>
        )}
        <Check
          label={t.compact}
          checked={section.compact ?? false}
          onChange={(v) =>
            edit((s) => {
              if (v) s.compact = true;
              else delete s.compact;
            })
          }
        />
      </div>
      <h3 className="text-sm font-semibold">{t.blocks}</h3>
      <SortableList ids={section.blocks.map((_, i) => `block-${i}`)} onMove={(from, to) => edit((s) => move(s.blocks, from, to))}>
      <div className="flex flex-col gap-2">
        {section.blocks.map((block, i) => (
          <SortableItem key={`block-${i}`} id={`block-${i}`} className="flex items-start gap-1">
            {(handle) => (
              <>
                <div className="pt-2">{handle}</div>
                <div className="flex-1">{renderBlock(block, i)}</div>
              </>
            )}
          </SortableItem>
        ))}
      </div>
      </SortableList>
      <div className="flex flex-wrap gap-2">
        <select
          className="rounded border border-line bg-surface px-2 py-1 text-sm"
          value=""
          aria-label={t.includeEntry}
          onChange={(e) => e.target.value && edit((s) => s.blocks.push({ type: "entry", entry: e.target.value }))}
        >
          <option value="">{t.includeEntry}</option>
          {available.map(([id, e]) => (
            <option key={id} value={id}>
              {e.title}
            </option>
          ))}
        </select>
        <Button
          onClick={() => {
            let id = "";
            update((p) => {
              id = createEntry(p);
              p.profiles[profileId].sections[index].blocks.push({ type: "entry", entry: id });
            });
            select({ kind: "entry", id });
          }}
        >
          {t.addEntry}
        </Button>
        <Button onClick={() => edit((s) => s.blocks.push({ type: "item", text: "" }))}>{t.addItem}</Button>
        <Button onClick={() => edit((s) => s.blocks.push({ type: "paragraph", text: "" }))}>{t.addParagraph}</Button>
      </div>
    </Panel>
  );
}
