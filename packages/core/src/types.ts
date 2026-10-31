// The Foja project format, version 2. `schema/project.schema.json` is the contract; these types
// mirror it for TypeScript code. Keep both in sync (test/schema.test.ts checks the example).

export const FORMAT = "foja/2";

export type ContactKind = "phone" | "email" | "website" | "github" | "linkedin" | "location";
export const CONTACT_KINDS: ContactKind[] = ["phone", "email", "website", "github", "linkedin", "location"];

/** A line of text; `**bold**` spans are allowed. */
export interface Item {
  heading?: string;
  text: string;
}

/** Something done over time: a job, a degree, a project. Shared by every profile. */
export interface Entry {
  title: string;
  place?: string;
  /** `YYYY-MM`. */
  start?: string;
  /** `YYYY-MM`; `null` means ongoing; absent means `start` is a single date. */
  end?: string | null;
  note?: string;
  items?: Item[];
}

export interface SkillGroup {
  title: string;
  items: string[];
}

export type Block =
  | { type: "entry"; entry: string }
  | { type: "item"; heading?: string; text: string }
  | { type: "paragraph"; text: string };

export interface Section {
  id: string;
  title: string;
  /** Which column the section goes in when the layout has two. */
  column?: "main" | "side";
  /** Entries without their items, small type. */
  compact?: boolean;
  blocks: Block[];
}

export interface Layout {
  /** A built-in style (`legajo`, `banda`, `minimal`) or the id of one in `Project.templates`. */
  template?: string;
  columns?: 1 | 2;
  sidebar?: "left" | "right";
  /** Percent of the text width. */
  sidebarWidth?: number;
  photo?: "square" | "rounded" | "circle" | "none";
  font?: "XCharter" | "Noto Sans";
  /** Points. */
  fontSize?: number;
  /** `#rrggbb`; absent means the style's own colour. */
  accent?: string;
  /** Millimetres. */
  margins?: { top?: number; bottom?: number; left?: number; right?: number };
  density?: "compact" | "normal" | "relaxed";
  paper?: "a4" | "us-letter";
  dateFormat?: "MM/YYYY" | "MMM YYYY" | "YYYY";
  /** Language of the fixed labels; defaults to the project language. */
  labels?: "es" | "en" | "pt";
}

export interface Profile {
  /** Shown in the editor; defaults to the id. */
  name?: string;
  subtitle: string;
  /** A first block in the sidebar, e.g. the course applied for. */
  highlight?: { title: string; text: string };
  contacts: ContactKind[];
  /** Rows of skill group ids; a row with several groups is laid out side by side. */
  skills: string[][];
  summary: string;
  sections: Section[];
  layout?: Layout;
}

export interface Asset {
  type: "image/jpeg" | "image/png" | "image/svg+xml";
  /** Base64. */
  data: string;
}

/** A CV style written in Typst by the user (see docs/templates.md). */
export interface CustomTemplate {
  name: string;
  /** Typst source; it starts with `#import "/lib.typ": *`. */
  source: string;
}

export interface Project {
  format: typeof FORMAT;
  /** BCP 47 tag of the CV text, e.g. `es`. */
  language: string;
  person: {
    givenNames: string[];
    familyNames: string[];
    /** Name of an asset. */
    photo?: string | null;
  };
  contacts: Partial<Record<ContactKind, string>>;
  skills: Record<string, SkillGroup>;
  entries: Record<string, Entry>;
  profiles: Record<string, Profile>;
  assets?: Record<string, Asset>;
  templates?: Record<string, CustomTemplate>;
}
