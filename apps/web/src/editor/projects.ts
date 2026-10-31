import { CONTACT_KINDS, validate, type Profile, type Project } from "@foja/core";
import exampleEs from "../../../../examples/example.project.json";
import exampleEn from "../../../../examples/example.en.project.json";
import { useLanguage } from "./i18n";
import { newId } from "./forms/Skills";

/** The fictional example, in the interface's language. */
export const exampleProject = (): Project => structuredClone(useLanguage.getState().lang === "es" ? exampleEs : exampleEn) as Project;

export function emptyProject(): Project {
  return {
    format: "foja/2",
    language: "es",
    person: { givenNames: ["Nombre"], familyNames: ["Apellido"], photo: null },
    contacts: { email: "nombre@example.com" },
    skills: {},
    entries: {},
    profiles: {
      cv: {
        name: "CV",
        subtitle: "Puesto que buscás",
        contacts: ["email"],
        skills: [],
        summary: "",
        sections: [{ id: "experiencia", title: "Experiencia", blocks: [] }],
      },
    },
  };
}

export function newProfile(project: Project): [string, Profile] {
  return [
    newId("perfil", project.profiles),
    {
      name: "Nuevo perfil",
      subtitle: "Puesto que buscás",
      contacts: CONTACT_KINDS.filter((k) => project.contacts[k]),
      skills: [],
      summary: "",
      sections: [],
    },
  ];
}

/** Parses an imported file; throws with the problems when it is not a Foja project. */
export function parseProject(text: string): Project {
  const value = JSON.parse(text);
  const problems = validate(value).filter((p) => p.severity === "error");
  if (problems.length) throw new Error(problems.slice(0, 5).map((p) => `${p.path}: ${p.message}`).join("\n"));
  return value as Project;
}
