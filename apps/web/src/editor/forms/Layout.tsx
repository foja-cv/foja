import { BUILTIN_STYLES, DEFAULT_ACCENT, DEFAULT_STYLE, resolveLayout, styleOf, styleOptions, type Layout } from "@foja/core";
import { t } from "../i18n";
import { useEditor } from "../store";
import { addStyle } from "../styles";
import { Button, Field, Panel, Select, TextInput } from "../ui";

const L = t.layoutOptions;

function StyleCard({ id, name, description, active, onPick }: { id: string; name: string; description?: string; active: boolean; onPick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      data-style={id}
      onClick={onPick}
      className={`flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition ${active ? "border-accent bg-accent-soft ring-2 ring-accent" : "border-line hover:border-accent"}`}
    >
      <span className="font-heading text-sm font-semibold">{name}</span>
      {description && <span className="text-xs text-muted">{description}</span>}
    </button>
  );
}

export function LayoutForm() {
  const project = useEditor((s) => s.project!);
  const profileId = useEditor((s) => s.profileId);
  const update = useEditor((s) => s.update);
  const select = useEditor((s) => s.select);
  // Select the stored object (stable) and default outside the selector: a fresh `{}` from the
  // selector would make every render look like a change.
  const stored = useEditor((s) => s.project!.profiles[s.profileId]?.layout);
  const layout = stored ?? {};
  const r = resolveLayout(layout);
  const style = styleOf(project, profileId);
  const shown = new Set(styleOptions(project, profileId));
  const set = <K extends keyof Layout>(key: K, value: Layout[K] | undefined) =>
    update((p) => {
      const profile = p.profiles[profileId];
      const next = { ...profile.layout, [key]: value };
      if (value === undefined) delete next[key];
      if (Object.keys(next).length) profile.layout = next;
      else delete profile.layout;
    });
  const number = (v: string, fallback: number) => (Number.isFinite(Number(v)) && v !== "" ? Number(v) : fallback);

  function editInTypst() {
    if (style.custom) return select({ kind: "style", id: style.id });
    let id = "";
    update((p) => {
      id = addStyle(p, style.id);
      p.profiles[profileId].layout = { ...p.profiles[profileId].layout, template: id };
    });
    select({ kind: "style", id });
  }

  function fromScratch() {
    let id = "";
    update((p) => {
      id = addStyle(p);
      p.profiles[profileId].layout = { ...p.profiles[profileId].layout, template: id };
    });
    select({ kind: "style", id });
  }

  return (
    <Panel title={t.layout}>
      <section className="flex flex-col gap-2" aria-label={t.styles.title}>
        <h3 className="text-xs font-semibold tracking-wide text-muted uppercase">{t.styles.builtin}</h3>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {BUILTIN_STYLES.map((s) => (
            <StyleCard key={s.id} id={s.id} name={s.name} description={s.description} active={style.id === s.id} onPick={() => set("template", s.id === DEFAULT_STYLE ? undefined : s.id)} />
          ))}
        </div>
        {Object.keys(project.templates ?? {}).length > 0 && (
          <>
            <h3 className="mt-2 text-xs font-semibold tracking-wide text-muted uppercase">{t.styles.own}</h3>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {Object.entries(project.templates!).map(([id, s]) => (
                <StyleCard key={id} id={id} name={s.name} active={style.id === id} onPick={() => set("template", id)} />
              ))}
            </div>
          </>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={editInTypst}>{t.styles.editInTypst}</Button>
          <Button variant="ghost" onClick={fromScratch}>
            {t.styles.newFromScratch}
          </Button>
          <span className="text-xs text-muted">{t.styles.editInTypstHint}</span>
        </div>
      </section>

      <h3 className="text-xs font-semibold tracking-wide text-muted uppercase">{t.styles.options}</h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {shown.has("columns") && (
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
        )}
        {shown.has("sidebar") && r.columns === 2 && (
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
        {shown.has("sidebarWidth") && r.columns === 2 && (
          <Field label={`${L.sidebarWidth}: ${r.sidebarWidth}`}>
            {(id) => <input id={id} type="range" min={15} max={45} step={0.5} value={r.sidebarWidth} onChange={(e) => set("sidebarWidth", Number(e.target.value))} />}
          </Field>
        )}
        {shown.has("photo") && (
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
        )}
        {shown.has("font") && (
          <Field label={L.font}>
            {(id) => (
              <Select<"" | "XCharter" | "Noto Sans">
                id={id}
                value={layout.font ?? ""}
                options={[
                  ["", L.styleFont],
                  ["XCharter", "XCharter (serif)"],
                  ["Noto Sans", "Noto Sans (sans)"],
                ]}
                onChange={(v) => set("font", v || undefined)}
              />
            )}
          </Field>
        )}
        {shown.has("fontSize") && (
          <Field label={L.fontSize}>{(id) => <TextInput id={id} type="number" value={String(r.fontSize)} onChange={(v) => set("fontSize", number(v, 10))} />}</Field>
        )}
        {shown.has("accent") && (
          <Field label={L.accent}>
            {(id) => (
              <div className="flex items-center gap-2">
                <input id={id} type="color" value={r.accent ?? DEFAULT_ACCENT} onChange={(e) => set("accent", e.target.value)} />
                {r.accent && <Button onClick={() => set("accent", undefined)}>{L.defaultAccent}</Button>}
              </div>
            )}
          </Field>
        )}
        {shown.has("density") && (
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
        )}
        {shown.has("paper") && (
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
        )}
        {shown.has("dateFormat") && (
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
        )}
        {shown.has("labels") && (
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
        )}
      </div>
      {shown.has("margins") && (
        <fieldset className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <legend className="mb-1 text-xs font-medium text-muted">{L.margins}</legend>
          {(["top", "bottom", "left", "right"] as const).map((side) => (
            <Field key={side} label={{ top: L.top, bottom: L.bottom, left: L.left, right: L.right }[side]}>
              {(id) => (
                <TextInput
                  id={id}
                  type="number"
                  value={layout.margins?.[side] !== undefined ? String(layout.margins[side]) : ""}
                  placeholder={L.styleDefault}
                  onChange={(v) => {
                    const margins = { ...layout.margins };
                    if (v === "") delete margins[side];
                    else margins[side] = number(v, 15);
                    set("margins", Object.keys(margins).length ? margins : undefined);
                  }}
                />
              )}
            </Field>
          ))}
        </fieldset>
      )}
    </Panel>
  );
}
