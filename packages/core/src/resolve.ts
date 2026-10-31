// A profile resolved against its project: entries looked up, dates formatted, labels and layout
// defaults applied. Every exporter but Typst (which resolves by itself in cv.typ) starts here.

import { formatPeriod, fullName, labelsFor, resolveLayout, type Labels } from "./project.ts";
import { fromBase64 } from "./typst.ts";
import type { Asset, ContactKind, Item, Project } from "./types.ts";

export interface ResolvedEntry {
  id: string;
  title: string;
  place: string;
  period: string;
  note?: string;
  items: Item[];
}

export type ResolvedBlock =
  | { type: "entry"; entry: ResolvedEntry }
  | { type: "item"; heading?: string; text: string }
  | { type: "paragraph"; text: string };

export interface ResolvedSection {
  id: string;
  title: string;
  /** In the sidebar (only when the layout has two columns). */
  side: boolean;
  compact: boolean;
  blocks: ResolvedBlock[];
}

export interface ResolvedContact {
  kind: ContactKind;
  label: string;
  value: string;
  /** A link for the value, when it has one. */
  href?: string;
}

export interface ResolvedPhoto {
  name: string;
  type: Asset["type"];
  bytes: Uint8Array;
  /** Pixel size, when the format is known (JPEG, PNG). */
  size?: { width: number; height: number };
}

export interface ResolvedCv {
  profileId: string;
  language: string;
  name: string;
  subtitle: string;
  labels: Labels;
  layout: ReturnType<typeof resolveLayout>;
  photo?: ResolvedPhoto;
  highlight?: { title: string; text: string };
  contacts: ResolvedContact[];
  /** Rows of skill groups. */
  skills: { title: string; items: string[] }[][];
  summary: string;
  sections: ResolvedSection[];
}

export function contactHref(kind: ContactKind, value: string): string | undefined {
  if (kind === "email") return `mailto:${value}`;
  if (kind === "phone") return `tel:${value.replace(/[^+\d]/g, "")}`;
  if (kind === "location") return undefined;
  return /^https?:\/\//.test(value) ? value : `https://${value}`;
}

/** Width and height of a JPEG or PNG, read from its header. */
export function imageSize(bytes: Uint8Array): { width: number; height: number } | undefined {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length > 24 && view.getUint32(0) === 0x89504e47) {
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }
  if (bytes.length > 4 && view.getUint16(0) === 0xffd8) {
    let at = 2;
    while (at + 9 < bytes.length) {
      if (bytes[at] !== 0xff) return undefined;
      const marker = bytes[at + 1];
      const length = view.getUint16(at + 2);
      // SOF0..SOF15 except DHT (C4), JPG (C8) and DAC (CC) carry the frame size.
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { width: view.getUint16(at + 7), height: view.getUint16(at + 5) };
      }
      at += 2 + length;
    }
  }
  return undefined;
}

export function resolveProfile(project: Project, profileId: string): ResolvedCv {
  const profile = project.profiles[profileId];
  if (!profile) throw new Error(`no profile "${profileId}"`);
  const layout = resolveLayout(profile.layout);
  const labels = labelsFor(project, profile);
  const twoColumns = layout.columns === 2;

  const entry = (id: string): ResolvedEntry => {
    const e = project.entries[id];
    return {
      id,
      title: e.title,
      place: e.place ?? "",
      period: formatPeriod(e, layout, labels),
      note: e.note,
      items: e.items ?? [],
    };
  };

  let photo: ResolvedPhoto | undefined;
  const photoName = project.person.photo;
  if (photoName && layout.photo !== "none" && project.assets?.[photoName]) {
    const asset = project.assets[photoName];
    const bytes = fromBase64(asset.data);
    photo = { name: photoName, type: asset.type, bytes, size: imageSize(bytes) };
  }

  return {
    profileId,
    language: project.language,
    name: fullName(project),
    subtitle: profile.subtitle,
    labels,
    layout,
    photo,
    highlight: profile.highlight,
    contacts: profile.contacts
      .filter((kind) => project.contacts[kind])
      .map((kind) => {
        const value = project.contacts[kind]!;
        return { kind, label: labels.contacts[kind], value, href: contactHref(kind, value) };
      }),
    skills: profile.skills.map((row) => row.filter((id) => project.skills[id]).map((id) => project.skills[id])),
    summary: profile.summary,
    sections: profile.sections.map((s) => ({
      id: s.id,
      title: s.title,
      side: twoColumns && s.column === "side",
      compact: s.compact ?? false,
      blocks: s.blocks.map((b): ResolvedBlock => (b.type === "entry" ? { type: "entry", entry: entry(b.entry) } : b)),
    })),
  };
}
