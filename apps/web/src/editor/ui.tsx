// Small form primitives shared by every panel.

import { useEffect, useId, useState, type ReactNode } from "react";

export function Field({ label, problem, hint, children }: { label: string; problem?: string; hint?: string; children: (id: string) => ReactNode }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium text-neutral-600 dark:text-neutral-300">
        {label}
      </label>
      {children(id)}
      {hint && <p className="text-xs text-neutral-500">{hint}</p>}
      {problem && (
        <p role="alert" className="text-xs text-red-700 dark:text-red-400">
          {problem}
        </p>
      )}
    </div>
  );
}

const control =
  "w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm outline-none focus:border-sky-600 focus:ring-1 focus:ring-sky-600 dark:border-neutral-600 dark:bg-neutral-900";

export function TextInput({ id, value, onChange, placeholder, type = "text", invalid }: { id?: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; invalid?: boolean }) {
  return (
    <input
      id={id}
      type={type}
      className={control + (invalid ? " border-red-600" : "")}
      value={value}
      placeholder={placeholder}
      aria-invalid={invalid || undefined}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function TextArea({ id, value, onChange, rows = 3 }: { id?: string; value: string; onChange: (v: string) => void; rows?: number }) {
  return <textarea id={id} rows={rows} className={control + " resize-y"} value={value} onChange={(e) => onChange(e.target.value)} />;
}

export function Select<T extends string | number>({ id, value, options, onChange }: { id?: string; value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <select
      id={id}
      className={control}
      value={String(value)}
      onChange={(e) => onChange(options.find(([v]) => String(v) === e.target.value)![0])}
    >
      {options.map(([v, label]) => (
        <option key={String(v)} value={String(v)}>
          {label}
        </option>
      ))}
    </select>
  );
}

export function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

/** `label` names a button whose content is a symbol (↑, ✕); `title` is only a tooltip. */
export function Button({ children, onClick, variant = "plain", title, label, disabled, type = "button" }: { children: ReactNode; onClick?: () => void; variant?: "plain" | "primary" | "danger" | "ghost"; title?: string; label?: string; disabled?: boolean; type?: "button" | "submit" }) {
  const styles = {
    plain: "border border-neutral-300 bg-white hover:bg-neutral-100 dark:border-neutral-600 dark:bg-neutral-800 dark:hover:bg-neutral-700",
    primary: "bg-sky-700 text-white hover:bg-sky-800",
    danger: "bg-red-700 text-white hover:bg-red-800",
    ghost: "hover:bg-neutral-200 dark:hover:bg-neutral-700",
  }[variant];
  return (
    <button type={type} title={title ?? label} aria-label={label} disabled={disabled} onClick={onClick} className={`rounded px-2 py-1 text-sm disabled:opacity-40 ${styles}`}>
      {children}
    </button>
  );
}

/** ↑ ↓ ✕ for an element of a list. */
export function ListControls({ index, length, move, remove, labels }: { index: number; length: number; move: (from: number, to: number) => void; remove: () => void; labels: { up: string; down: string; remove: string } }) {
  return (
    <div className="flex shrink-0 gap-0.5">
      <Button variant="ghost" label={labels.up} disabled={index === 0} onClick={() => move(index, index - 1)}>
        ↑
      </Button>
      <Button variant="ghost" label={labels.down} disabled={index === length - 1} onClick={() => move(index, index + 1)}>
        ↓
      </Button>
      <Button variant="ghost" label={labels.remove} onClick={remove}>
        ✕
      </Button>
    </div>
  );
}

export function Panel({ title, children, actions }: { title: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <header className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">{title}</h2>
        {actions}
      </header>
      {children}
    </section>
  );
}

export function move<T>(list: T[], from: number, to: number) {
  const [item] = list.splice(from, 1);
  list.splice(to, 0, item);
}

/** One value per line. Empty lines stay while typing but are not stored. */
export function LinesArea({ id, value, onChange }: { id?: string; value: string[]; onChange: (v: string[]) => void }) {
  const [text, setText] = useState(value.join("\n"));
  const lines = (s: string) => s.split("\n").map((l) => l.trim()).filter(Boolean);
  // Follow outside changes (undo, another panel) unless they are just this text, cleaned.
  useEffect(() => {
    if (lines(text).join("\n") !== value.join("\n")) setText(value.join("\n"));
  }, [value]);
  return (
    <TextArea
      id={id}
      rows={Math.max(2, value.length + 1)}
      value={text}
      onChange={(v) => {
        setText(v);
        onChange(lines(v));
      }}
    />
  );
}
