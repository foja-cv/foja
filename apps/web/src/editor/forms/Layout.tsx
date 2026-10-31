import { DEFAULT_ACCENT, resolveLayout, type Layout } from "@foja/core";
import { t } from "../i18n";
import { useEditor } from "../store";
import { Button, Field, Panel, Select, TextInput } from "../ui";

const L = t.layoutOptions;

export function LayoutForm() {
  const profileId = useEditor((s) => s.profileId);
  // Select the stored object (stable) and default outside the selector: a fresh `{}` from the
  // selector would make every render look like a change.
  const stored = useEditor((s) => s.project!.profiles[s.profileId]?.layout);
  const layout = stored ?? {};
  const update = useEditor((s) => s.update);
  const r = resolveLayout(layout);
  const set = <K extends keyof Layout>(key: K, value: Layout[K] | undefined) =>
    update((p) => {
      const profile = p.profiles[profileId];
      const next = { ...profile.layout, [key]: value };
      if (value === undefined) delete next[key];
      if (Object.keys(next).length) profile.layout = next;
      else delete profile.layout;
    });
  const number = (v: string, fallback: number) => (Number.isFinite(Number(v)) && v !== "" ? Number(v) : fallback);

  return (
    <Panel title={t.layout}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={L.columns}>
          {(id) => (
            <Select<1 | 2>
              id={id}
              value={r.columns}
              options={[
                [2, L.two],
                [1, L.one],
              ]}
              onChange={(v) => set("columns", v === 2 ? undefined : v)}
            />
          )}
        </Field>
        {r.columns === 2 && (
          <Field label={L.sidebar}>
            {(id) => (
              <Select
                id={id}
                value={r.sidebar}
                options={[
                  ["left", L.left],
                  ["right", L.right],
                ]}
                onChange={(v) => set("sidebar", v === "left" ? undefined : v)}
              />
            )}
          </Field>
        )}
        {r.columns === 2 && (
          <Field label={`${L.sidebarWidth}: ${r.sidebarWidth}`}>
            {(id) => <input id={id} type="range" min={15} max={45} step={0.5} value={r.sidebarWidth} onChange={(e) => set("sidebarWidth", Number(e.target.value))} />}
          </Field>
        )}
        <Field label={L.photo}>
          {(id) => (
            <Select
              id={id}
              value={r.photo}
              options={[
                ["square", L.square],
                ["rounded", L.rounded],
                ["circle", L.circle],
                ["none", L.none],
              ]}
              onChange={(v) => set("photo", v === "square" ? undefined : v)}
            />
          )}
        </Field>
        <Field label={L.fontSize}>
          {(id) => <TextInput id={id} type="number" value={String(r.fontSize)} onChange={(v) => set("fontSize", number(v, 10))} />}
        </Field>
        <Field label={L.accent}>
          {(id) => (
            <div className="flex items-center gap-2">
              <input id={id} type="color" value={r.accent ?? DEFAULT_ACCENT} onChange={(e) => set("accent", e.target.value)} />
              {r.accent && <Button onClick={() => set("accent", undefined)}>{L.defaultAccent}</Button>}
            </div>
          )}
        </Field>
        <Field label={L.density}>
          {(id) => (
            <Select
              id={id}
              value={r.density}
              options={[
                ["compact", L.compact],
                ["normal", L.normal],
                ["relaxed", L.relaxed],
              ]}
              onChange={(v) => set("density", v === "normal" ? undefined : v)}
            />
          )}
        </Field>
        <Field label={L.paper}>
          {(id) => (
            <Select
              id={id}
              value={r.paper}
              options={[
                ["a4", "A4"],
                ["us-letter", "Carta (Letter)"],
              ]}
              onChange={(v) => set("paper", v === "a4" ? undefined : v)}
            />
          )}
        </Field>
        <Field label={L.dateFormat}>
          {(id) => (
            <Select
              id={id}
              value={r.dateFormat}
              options={[
                ["MM/YYYY", "05/2026"],
                ["MMM YYYY", "may 2026"],
                ["YYYY", "2026"],
              ]}
              onChange={(v) => set("dateFormat", v === "MM/YYYY" ? undefined : v)}
            />
          )}
        </Field>
        <Field label={L.labels}>
          {(id) => (
            <Select<"" | "es" | "en">
              id={id}
              value={layout.labels ?? ""}
              options={[
                ["", L.sameAsCv],
                ["es", "Español"],
                ["en", "English"],
              ]}
              onChange={(v) => set("labels", v || undefined)}
            />
          )}
        </Field>
      </div>
      <fieldset className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <legend className="mb-1 text-xs font-medium text-neutral-600 dark:text-neutral-300">{L.margins}</legend>
        {(["top", "bottom", "left", "right"] as const).map((side) => (
          <Field key={side} label={{ top: L.top, bottom: L.bottom, left: L.left, right: L.right }[side]}>
            {(id) => (
              <TextInput
                id={id}
                type="number"
                value={String(r.margins[side])}
                onChange={(v) => set("margins", { ...layout.margins, [side]: number(v, r.margins[side]) })}
              />
            )}
          </Field>
        ))}
      </fieldset>
    </Panel>
  );
}
