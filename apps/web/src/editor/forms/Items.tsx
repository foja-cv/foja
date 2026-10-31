import type { Item } from "@foja/core";
import { t } from "../i18n";
import { useProblem } from "../store";
import { Button, ListControls, TextArea, TextInput, move } from "../ui";

/** A list of `{heading?, text}`; `onChange` receives a new array. `base` is its JSON pointer. */
export function ItemsEditor({ items, onChange, base }: { items: Item[]; onChange: (items: Item[]) => void; base: string }) {
  const edit = (fn: (list: Item[]) => void) => {
    const list = structuredClone(items);
    fn(list);
    onChange(list);
  };
  return (
    <div className="flex flex-col gap-2">
      {items.map((it, i) => (
        <ItemRow key={i} item={it} path={`${base}/${i}`} edit={(fn) => edit((l) => fn(l[i]))}>
          <ListControls index={i} length={items.length} move={(a, b) => edit((l) => move(l, a, b))} remove={() => edit((l) => l.splice(i, 1))} labels={t} />
        </ItemRow>
      ))}
      <div>
        <Button onClick={() => edit((l) => l.push({ text: "" }))}>{t.addItem}</Button>
      </div>
    </div>
  );
}

export function ItemRow({ item, path, edit, children }: { item: { heading?: string; text: string }; path: string; edit: (fn: (it: { heading?: string; text: string }) => void) => void; children?: React.ReactNode }) {
  const problem = useProblem(`${path}/text`);
  return (
    <div className="flex gap-2 rounded border border-neutral-200 p-2 dark:border-neutral-700">
      <div className="flex flex-1 flex-col gap-1">
        <TextInput
          value={item.heading ?? ""}
          placeholder={t.heading}
          onChange={(v) =>
            edit((it) => {
              if (v) it.heading = v;
              else delete it.heading;
            })
          }
        />
        <TextArea rows={2} value={item.text} onChange={(v) => edit((it) => (it.text = v))} />
        {problem && <p className="text-xs text-red-700 dark:text-red-400">{problem}</p>}
      </div>
      {children}
    </div>
  );
}
