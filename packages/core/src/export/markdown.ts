// Markdown export: a plain CV for READMEs, GitHub profiles and forms that take text. One column,
// the same order as the PDF (sidebar parts first, then the main sections).

import type { ResolvedCv, ResolvedSection } from "../resolve.ts";
import type { Item } from "../types.ts";

/** Escapes Markdown punctuation but keeps `**bold**` spans. */
export function inlineMarkdown(text: string): string {
  return text
    .split("**")
    .map((part, i) => {
      const escaped = part.replace(/([\\`*_{}[\]<>#|])/g, "\\$1");
      return i % 2 === 1 ? `**${escaped}**` : escaped;
    })
    .join("");
}

const esc = (text: string) => inlineMarkdown(text.replaceAll("**", ""));

const item = (it: Item) => `- ${it.heading ? `**${esc(it.heading)}.** ` : ""}${inlineMarkdown(it.text)}`;

function section(s: ResolvedSection): string[] {
  const out = [`## ${esc(s.title)}`, ""];
  let list = false;
  for (const b of s.blocks) {
    if (b.type === "item") {
      out.push(item(b));
      list = true;
      continue;
    }
    if (list) out.push("");
    list = false;
    if (b.type === "paragraph") out.push(inlineMarkdown(b.text), "");
    else {
      const e = b.entry;
      const details = [e.place && `*${esc(e.place)}*`, e.period].filter(Boolean).join(" · ");
      out.push(s.compact ? `**${esc(e.title)}**${details ? ` — ${details}` : ""}` : `### ${esc(e.title)}`, "");
      if (!s.compact && details) out.push(details, "");
      if (e.note) out.push(esc(e.note), "");
      if (!s.compact && e.items.length) out.push(...e.items.map(item), "");
    }
  }
  if (list) out.push("");
  return out;
}

export function renderMarkdown(cv: ResolvedCv): string {
  const out = [`# ${esc(cv.name)}`, "", `**${esc(cv.subtitle)}**`, ""];
  if (cv.contacts.length) {
    const target = (href: string) => href.replace(/[\s()<>]/g, (ch) => encodeURIComponent(ch));
    out.push(cv.contacts.map((c) => (c.href && c.kind !== "phone" ? `[${esc(c.value)}](${target(c.href)})` : esc(c.value))).join(" · "), "");
  }
  if (cv.highlight) out.push(`**${esc(cv.highlight.title)}:** ${esc(cv.highlight.text)}`, "");
  if (cv.summary) out.push(`## ${esc(cv.labels.profile)}`, "", inlineMarkdown(cv.summary), "");
  if (cv.skills.length) {
    out.push(`## ${esc(cv.labels.skills)}`, "", ...cv.skills.flat().map((g) => `- **${esc(g.title)}:** ${g.items.map(esc).join(", ")}`), "");
  }
  // The sidebar sections come after the main ones, as a reader of the PDF meets them.
  for (const s of [...cv.sections.filter((s) => !s.side), ...cv.sections.filter((s) => s.side)]) out.push(...section(s));
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}
