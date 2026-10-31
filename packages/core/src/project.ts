// Helpers over a project that every consumer needs: defaults of the layout, names, dates.

import labelsJson from "../../template/labels.json" with { type: "json" };
import type { Entry, Layout, Profile, Project } from "./types.ts";

export type Labels = (typeof labelsJson)["es"];
export const LABELS: Record<string, Labels> = labelsJson;

/** The layout with every option filled in; the values match the Typst template's defaults. */
export function resolveLayout(layout: Layout = {}): Required<Omit<Layout, "accent" | "labels">> & Pick<Layout, "accent" | "labels"> {
  return {
    columns: layout.columns ?? 2,
    sidebar: layout.sidebar ?? "left",
    sidebarWidth: layout.sidebarWidth ?? 26.93,
    photo: layout.photo ?? "square",
    font: layout.font ?? "XCharter",
    fontSize: layout.fontSize ?? 10,
    accent: layout.accent,
    margins: { top: 12, bottom: 12, left: 12, right: 8.7, ...layout.margins },
    density: layout.density ?? "normal",
    paper: layout.paper ?? "a4",
    dateFormat: layout.dateFormat ?? "MM/YYYY",
    labels: layout.labels,
  };
}

/** The accent colour as `#rrggbb` (the template's default blue is CMYK 100/50/0/0). */
export const DEFAULT_ACCENT = "#0080ff";

export function labelsFor(project: Project, profile: Profile): Labels {
  const lang = profile.layout?.labels ?? project.language.split("-")[0];
  return LABELS[lang] ?? LABELS.en;
}

export function fullName(project: Project): string {
  return [...project.person.givenNames, ...project.person.familyNames].join(" ");
}

export function formatMonth(value: string, layout: Layout, labels: Labels): string {
  const [year, month] = value.split("-");
  const format = layout.dateFormat ?? "MM/YYYY";
  if (format === "YYYY") return year;
  if (format === "MMM YYYY") return `${labels.months[Number(month) - 1]} ${year}`;
  return `${month}/${year}`;
}

/** Same rules as `period` in cv.typ. */
export function formatPeriod(entry: Entry, layout: Layout, labels: Labels): string {
  if (!entry.start) return "";
  if (!("end" in entry)) return formatMonth(entry.start, layout, labels);
  const start = formatMonth(entry.start, layout, labels);
  const end = entry.end === null || entry.end === undefined ? labels.present : formatMonth(entry.end, layout, labels);
  return start === end ? start : `${start} – ${end}`;
}

/** Splits `**bold**` markup into runs. */
export function inlineRuns(text: string): { text: string; bold: boolean }[] {
  return text
    .split("**")
    .map((part, i) => ({ text: part, bold: i % 2 === 1 }))
    .filter((run) => run.text !== "");
}

/** `Programación básica` → `programacion-basica`: ids and file names. */
export function slug(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function profileName(id: string, profile: Profile): string {
  return profile.name ?? id;
}
