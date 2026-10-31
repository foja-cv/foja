import { useState } from "react";
import { toBase64 } from "@foja/core";
import { readFile } from "../download";
import { t } from "../i18n";
import { pointer, useEditor, useProblem } from "../store";
import { Button, Field, Panel, Select, TextInput } from "../ui";

const words = (s: string) => s.split(/\s+/).filter(Boolean);

export function PersonForm() {
  const project = useEditor((s) => s.project!);
  const update = useEditor((s) => s.update);
  const [error, setError] = useState<string>();
  const person = project.person;
  const photo = person.photo ? project.assets?.[person.photo] : undefined;
  const photoProblem = useProblem(pointer("person", "photo"));
  const namesProblem = useProblem(pointer("person", "givenNames"));
  const languageProblem = useProblem(pointer("language"));

  async function upload(file: File | undefined) {
    setError(undefined);
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return setError(t.photoTooBig);
    const type = file.type === "image/png" ? "image/png" : file.type === "image/jpeg" ? "image/jpeg" : undefined;
    if (!type) return setError(t.uploadPhoto);
    const data = toBase64(await readFile(file));
    const name = type === "image/png" ? "photo.png" : "photo.jpg";
    update((p) => {
      if (p.person.photo && p.assets) delete p.assets[p.person.photo];
      p.assets = { ...p.assets, [name]: { type, data } };
      p.person.photo = name;
    });
  }

  return (
    <Panel title={t.personal}>
      <Field label={t.givenNames} problem={namesProblem}>
        {(id) => <TextInput id={id} value={person.givenNames.join(" ")} onChange={(v) => update((p) => (p.person.givenNames = words(v)))} />}
      </Field>
      <Field label={t.familyNames}>
        {(id) => <TextInput id={id} value={person.familyNames.join(" ")} onChange={(v) => update((p) => (p.person.familyNames = words(v)))} />}
      </Field>
      <Field label={t.language} problem={languageProblem}>
        {(id) => (
          <Select
            id={id}
            value={project.language}
            options={[
              ["es", "Español"],
              ["en", "English"],
              ["pt", "Português"],
            ]}
            onChange={(v) => update((p) => (p.language = v))}
          />
        )}
      </Field>
      <Field label={t.photo} problem={error ?? photoProblem}>
        {(id) => (
          <div className="flex items-center gap-3">
            {photo && <img alt="" className="h-20 w-20 rounded object-cover" src={`data:${photo.type};base64,${photo.data}`} />}
            <input id={id} type="file" accept="image/jpeg,image/png" className="text-sm" onChange={(e) => upload(e.target.files?.[0])} />
            {person.photo && (
              <Button
                onClick={() =>
                  update((p) => {
                    if (p.person.photo) delete p.assets?.[p.person.photo];
                    p.person.photo = null;
                  })
                }
              >
                {t.removePhoto}
              </Button>
            )}
          </div>
        )}
      </Field>
    </Panel>
  );
}
