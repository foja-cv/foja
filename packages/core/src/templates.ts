// CV styles: the built-in ones (packages/template/styles) and those written by the user, kept in
// the project. Each is a Typst file compiled as the main file, next to /lib.typ.

import styles from "../../template/styles.json" with { type: "json" };
import type { Layout, Project } from "./types.ts";

export interface StyleInfo {
  id: string;
  name: string;
  description: string;
  /** The layout options the style honours. */
  options: (keyof Layout)[];
}

export const BUILTIN_STYLES = styles as StyleInfo[];
export const DEFAULT_STYLE = "legajo";
export const LIB_PATH = "/lib.typ";

export const isBuiltinStyle = (id: string) => BUILTIN_STYLES.some((s) => s.id === id);
export const builtinStylePath = (id: string) => `/styles/${id}.typ`;
export const customStylePath = (id: string) => `/custom/${id}.typ`;

/** The style a profile uses, falling back to the default when it names one that is missing. */
export function styleOf(project: Project, profileId: string): { id: string; custom: boolean; path: string } {
  const id = project.profiles[profileId]?.layout?.template ?? DEFAULT_STYLE;
  if (project.templates?.[id]) return { id, custom: true, path: customStylePath(id) };
  if (isBuiltinStyle(id)) return { id, custom: false, path: builtinStylePath(id) };
  return { id: DEFAULT_STYLE, custom: false, path: builtinStylePath(DEFAULT_STYLE) };
}

/** `[path, source]` of the user's styles, for the compiler. */
export function customStyleSources(project: Project): [string, string][] {
  return Object.entries(project.templates ?? {}).map(([id, t]) => [customStylePath(id), t.source]);
}

/** The options a style honours; a style of the user's honours whatever it reads, so all. */
export function styleOptions(project: Project, profileId: string): (keyof Layout)[] {
  const style = styleOf(project, profileId);
  if (style.custom) return ["columns", "sidebar", "sidebarWidth", "photo", "font", "fontSize", "accent", "margins", "density", "paper", "dateFormat", "labels"];
  return BUILTIN_STYLES.find((s) => s.id === style.id)!.options;
}

/** A starting point for a style of one's own: the smallest useful CV. */
export const STYLE_SKELETON = `// A CV style of your own. \`cv\` holds the profile, resolved; see docs/templates.md.
#import "/lib.typ": *

#set document(..document-info)
#set page(width: paper.width, height: paper.height, margin: margins((top: 18, bottom: 18, left: 18, right: 18)))
#set text(font: opt("font", "Noto Sans"), size: base-size, lang: lang)
#geometry(main: (x: 18mm, width: paper.width - 36mm))

#anchored("name", text(size: 2em, weight: "bold", fill: accent(rgb("#1f5f5b")), cv.name))
#anchored("subtitle", text(size: 1.2em, cv.subtitle))

#anchored("contacts", cv.contacts.map(contact-text).join(" · "))

#if cv.summary != "" { anchored("summary", par(inline(cv.summary))) }

#for s in cv.sections {
  anchored(s.path, {
    heading(level: 2, s.title)
    for b in s.blocks {
      anchored(b.path, if b.type == "entry" {
        [*#b.title* #h(1fr) #b.period \\ _#(b.place)_]
        if not s.compact { list(..b.items.map(item-body)) }
      } else {
        list(item-body(b))
      })
    }
  })
}
`;
