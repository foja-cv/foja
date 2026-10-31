import { useRef } from "react";
import { t } from "../i18n";
import { useEditor } from "../store";
import { addStyle, profilesUsingStyle } from "../styles";
import { Button, Field, Panel, TextInput } from "../ui";

const DOCS = "https://github.com/foja-cv/foja/blob/main/docs/templates.md";

/** The editor of a style of one's own: its name and its Typst source. */
export function StyleEditor({ id }: { id: string }) {
  const project = useEditor((s) => s.project!);
  const profileId = useEditor((s) => s.profileId);
  const update = useEditor((s) => s.update);
  const select = useEditor((s) => s.select);
  const code = useRef<HTMLTextAreaElement>(null);
  const style = project.templates?.[id];
  if (!style) return null;
  const users = profilesUsingStyle(project, id);
  const inUse = (project.profiles[profileId]?.layout?.template ?? "legajo") === id;
  const edit = (fn: (s: { name: string; source: string }) => void) => update((p) => fn(p.templates![id]));

  // Tab indents (two spaces) instead of leaving the editor; Escape then Tab leaves it.
  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== "Tab" || e.shiftKey) return;
    e.preventDefault();
    const el = e.currentTarget;
    const { selectionStart: a, selectionEnd: b, value } = el;
    const next = value.slice(0, a) + "  " + value.slice(b);
    edit((s) => (s.source = next));
    requestAnimationFrame(() => {
      if (code.current) code.current.selectionStart = code.current.selectionEnd = a + 2;
    });
  }

  return (
    <Panel
      title={`${t.styles.editor}: ${style.name}`}
      actions={
        <div className="flex gap-2">
          <Button
            onClick={() => {
              let copy = "";
              update((p) => (copy = addStyle(p, id)));
              select({ kind: "style", id: copy });
            }}
          >
            {t.styles.duplicate}
          </Button>
          <Button
            variant="danger"
            disabled={users.length > 0}
            title={users.length ? t.styles.deleteBlocked : t.styles.deleteStyle}
            onClick={() => {
              update((p) => {
                delete p.templates![id];
                if (Object.keys(p.templates!).length === 0) delete p.templates;
              });
              select({ kind: "layout" });
            }}
          >
            {t.styles.deleteStyle}
          </Button>
        </div>
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        {inUse ? (
          <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs text-accent-ink">{t.styles.inUse}</span>
        ) : (
          <Button
            variant="primary"
            onClick={() => update((p) => (p.profiles[profileId].layout = { ...p.profiles[profileId].layout, template: id }))}
          >
            {t.styles.useHere}
          </Button>
        )}
        <span className="text-xs text-muted">{t.styles.usedBy(users)}</span>
      </div>
      <Field label={t.styles.name}>{(fid) => <TextInput id={fid} value={style.name} onChange={(v) => edit((s) => (s.name = v))} />}</Field>
      <Field label={t.styles.code} hint={t.styles.codeHint}>
        {(fid) => (
          <textarea
            id={fid}
            ref={code}
            spellCheck={false}
            rows={28}
            value={style.source}
            onKeyDown={onKeyDown}
            onChange={(e) => edit((s) => (s.source = e.target.value))}
            className="w-full resize-y rounded border border-line bg-surface p-2 font-mono text-xs leading-relaxed outline-none focus:border-accent"
          />
        )}
      </Field>
      <a className="text-sm text-accent underline" href={DOCS} target="_blank" rel="noreferrer">
        {t.styles.docs}
      </a>
    </Panel>
  );
}
