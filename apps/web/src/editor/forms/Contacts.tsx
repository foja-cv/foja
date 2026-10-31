import { CONTACT_KINDS } from "@foja/core";
import { t } from "../i18n";
import { pointer, useEditor, useProblem } from "../store";
import { Field, Panel, TextInput } from "../ui";

export function ContactsForm() {
  const contacts = useEditor((s) => s.project!.contacts);
  const update = useEditor((s) => s.update);
  return (
    <Panel title={t.contacts}>
      {CONTACT_KINDS.map((kind) => (
        <ContactField key={kind} kind={kind} value={contacts[kind] ?? ""} onChange={(v) => update((p) => {
          if (v) p.contacts[kind] = v;
          else delete p.contacts[kind];
        })} />
      ))}
    </Panel>
  );
}

function ContactField({ kind, value, onChange }: { kind: (typeof CONTACT_KINDS)[number]; value: string; onChange: (v: string) => void }) {
  return (
    <Field label={t.contactKinds[kind]} problem={useProblem(pointer("contacts", kind))}>
      {(id) => <TextInput id={id} type={kind === "email" ? "email" : "text"} value={value} onChange={onChange} />}
    </Field>
  );
}
