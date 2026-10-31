// LaTeX export: one self-contained `cv.tex` (memoir + flowfram, XCharter) that reproduces the
// Typst layout, with its photo, in a `.zip`. The preamble is written for Foja; the measurements
// are the template's, in big points (`bp`, the Typst point), so both outputs share one geometry.

import type { ResolvedBlock, ResolvedCv, ResolvedSection } from "../resolve.ts";
import { resolveProfile } from "../resolve.ts";
import type { Item, Project } from "../types.ts";
import type { ZipInput } from "../zip.ts";

const SPECIAL: Record<string, string> = {
  "\\": "\\textbackslash{}",
  "&": "\\&",
  "%": "\\%",
  $: "\\$",
  "#": "\\#",
  _: "\\_",
  "{": "\\{",
  "}": "\\}",
  "~": "\\textasciitilde{}",
  "^": "\\textasciicircum{}",
};

export function escapeLatex(text: string): string {
  return [...text].map((c) => SPECIAL[c] ?? c).join("");
}

/** Escaped text where `**...**` is bold. */
export function inlineLatex(text: string): string {
  return escapeLatex(text).replace(/\*\*(.+?)\*\*/g, "\\textbf{$1}");
}

const BABEL: Record<string, string> = {
  es: "spanish,es-noshorthands",
  en: "english",
  pt: "portuguese",
  fr: "french",
  de: "ngerman",
  it: "italian",
};

const MM = 72 / 25.4; // bp per millimetre
const PAPER = { a4: { width: 210, height: 297, option: "a4paper" }, "us-letter": { width: 215.9, height: 279.4, option: "letterpaper" } };
const bp = (value: number) => `${+value.toFixed(3)}bp`;

/** The photo's file name inside the bundle; SVG is left out (pdflatex cannot include it). */
function photoFile(cv: ResolvedCv): string | undefined {
  if (!cv.photo || cv.photo.type === "image/svg+xml") return undefined;
  return cv.photo.type === "image/png" ? "photo.png" : "photo.jpg";
}

/** Sizes in bp: TikZ does not parse `\dimexpr`, so every length is a number here. */
function photoCommand(cv: ResolvedCv, file: string, widthBp: number): string {
  const shape = cv.layout.photo;
  const width = bp(widthBp);
  if (shape === "square") return `\\includegraphics[width=${width}]{${file}}`;
  const size = cv.photo!.size ?? { width: 1, height: 1 };
  if (shape === "circle") {
    // Fill a square of side `width` (the larger side is cut) and clip it round.
    const fit = size.width >= size.height ? `height=${width}` : `width=${width}`;
    return [
      "\\begin{tikzpicture}",
      `\\clip (0,0) circle (${bp(widthBp / 2)});`,
      `\\node[inner sep=0pt] at (0,0) {\\includegraphics[${fit}]{${file}}};`,
      "\\end{tikzpicture}",
    ].join("");
  }
  return [
    "\\begin{tikzpicture}",
    `\\clip[rounded corners=${bp(widthBp * 0.06)}] (0,0) rectangle (${width},${bp((widthBp * size.height) / size.width)});`,
    `\\node[inner sep=0pt,anchor=south west] at (0,0) {\\includegraphics[width=${width}]{${file}}};`,
    "\\end{tikzpicture}",
  ].join("");
}

/** Text width and column widths in bp, as in cv.typ. */
function geometry(cv: ResolvedCv) {
  const l = cv.layout;
  const paper = PAPER[l.paper];
  const textWidth = (paper.width - l.margins.left - l.margins.right) * MM;
  const gutter = 18 * (l.fontSize / 10);
  const side = (textWidth * l.sidebarWidth) / 100;
  return { paper, textWidth, gutter, side, main: textWidth - side - gutter };
}

function preamble(cv: ResolvedCv): string[] {
  const l = cv.layout;
  const { paper, textWidth, gutter, side, main } = geometry(cv);
  const size = [9, 10, 11, 12].reduce((a, b) => (Math.abs(b - l.fontSize) < Math.abs(a - l.fontSize) ? b : a));
  const density = { compact: 0.7, normal: 1, relaxed: 1.3 }[l.density];
  const m = l.margins;
  const textHeight = (paper.height - m.top - m.bottom) * MM;
  const accent = l.accent ? `\\definecolor{accent}{HTML}{${l.accent.slice(1).toUpperCase()}}` : "\\definecolor{accent}{cmyk}{1,0.5,0,0}";
  const lines = [
    `\\documentclass[${paper.option},${size}pt]{memoir}`,
    "% Made with Foja (https://github.com/foja-cv/foja). Compile with pdflatex, lualatex or tectonic.",
    "\\usepackage[T1]{fontenc}",
    "\\usepackage{XCharter}",
    `\\usepackage[${BABEL[cv.language.split("-")[0]] ?? "english"}]{babel}`,
    `\\usepackage[paperwidth=${paper.width}mm,paperheight=${paper.height}mm,top=${m.top}mm,bottom=${m.bottom}mm,left=${m.left}mm,right=${m.right}mm]{geometry}`,
    "\\usepackage{graphicx}",
    "\\usepackage{flowfram}",
    "\\usepackage{url}",
    "\\usepackage{xcolor}",
    "\\usepackage{tikz}",
    "\\usepackage{enumitem}",
    "\\setlist{noitemsep,nolistsep}",
    accent,
    "\\pagestyle{empty}",
    "\\setlength{\\parindent}{0pt}",
    `\\newcommand{\\Sep}{\\vspace{${density}em}}`,
    `\\newcommand{\\SmallSep}{\\vspace{${0.5 * density}em}}`,
    "\\newcommand{\\Accent}[1]{\\textbf{\\color{accent}#1}}",
    "\\newcommand{\\SideHeading}[1]{\\Accent{#1}\\\\}",
    "\\newcommand{\\Bullet}{\\textcolor{accent}{$\\circ$}}",
    "\\newcommand{\\CVSection}[1]{{\\Large\\textbf{#1}}\\par\\SmallSep}",
    "\\newcommand{\\CVEntry}[3]{\\Accent{#1}\\hfill{\\small #3}\\par{\\itshape #2}\\par}",
    "\\newcommand{\\CVCompact}[3]{\\textbf{#1}\\hfill{\\small #3}\\par{\\small\\itshape #2}\\par}",
  ];
  if (l.columns === 2) {
    const left = l.sidebar === "left";
    const sideX = left ? 0 : main + gutter;
    const mainX = left ? side + gutter : 0;
    const ruleX = left ? side + gutter / 3 - 0.75 : main + (gutter * 2) / 3 - 0.75;
    lines.push(
      "% The sidebar and the dotted rule exist on the first page only; the main column continues.",
      `\\newflowframe[1]{${bp(side)}}{${bp(textHeight)}}{${bp(sideX)}}{0pt}[side]`,
      `\\newflowframe[1]{${bp(main)}}{${bp(textHeight)}}{${bp(mainX)}}{0pt}[main]`,
      `\\newflowframe[>1]{${bp(main)}}{${bp(textHeight)}}{${bp(mainX)}}{0pt}[continuation]`,
      `\\newstaticframe[1]{1.5bp}{${bp(textHeight)}}{${bp(ruleX)}}{0pt}[rule]`,
      "\\begin{staticcontents*}{rule}",
      "\\tikz{\\draw[loosely dotted,color=accent,line width=1.5bp](0,0) -- (0,\\textheight);}",
      "\\end{staticcontents*}",
    );
  }
  return lines;
}

function items(list: Item[]): string[] {
  if (list.length === 0) return [];
  return [
    "\\begin{itemize}[leftmargin=1.2em,label=\\Bullet]",
    ...list.map((it) => `\\item ${it.heading ? `\\textbf{${escapeLatex(it.heading)}.} ` : ""}${inlineLatex(it.text)}`),
    "\\end{itemize}",
  ];
}

function mainSection(s: ResolvedSection): string[] {
  const out = [`\\CVSection{${escapeLatex(s.title)}}`];
  // Consecutive item blocks make one list.
  let pending: Item[] = [];
  const flush = () => {
    out.push(...items(pending));
    pending = [];
  };
  for (const b of s.blocks) {
    if (b.type === "item") {
      pending.push(b);
      continue;
    }
    flush();
    if (b.type === "paragraph") out.push(`${inlineLatex(b.text)}\\par`);
    else {
      const e = b.entry;
      out.push(`${s.compact ? "\\CVCompact" : "\\CVEntry"}{${escapeLatex(e.title)}}{${escapeLatex(e.place)}}{${escapeLatex(e.period)}}`);
      if (e.note) out.push(`{\\small ${escapeLatex(e.note)}}\\par`);
      if (!s.compact) out.push(...items(e.items));
      out.push("\\SmallSep");
    }
  }
  flush();
  out.push("\\Sep");
  return out;
}

function sideBlock(b: ResolvedBlock): string {
  if (b.type === "entry") {
    const e = b.entry;
    const details = [e.place, e.period].filter(Boolean).map((v) => `{\\itshape ${escapeLatex(v)}}\\\\`);
    return [`\\textbf{${escapeLatex(e.title)}}\\\\`, ...details].join("\n");
  }
  if (b.type === "item" && b.heading) {
    // A paragraph to read: justified, last line flush left.
    return `{\\leftskip=0pt \\rightskip=0pt \\parfillskip=0pt plus 1fil \\textbf{${escapeLatex(b.heading)}.} ${inlineLatex(b.text)}\\par}`;
  }
  return `${inlineLatex(b.text)}\\par`;
}

function contactValue(c: ResolvedCv["contacts"][number]): string {
  return c.kind === "phone" || c.kind === "location" ? escapeLatex(c.value) : `\\url{${c.value}}`;
}

function sidebar(cv: ResolvedCv, photo: string | undefined): string[] {
  const align = cv.layout.sidebar === "left" ? "flushright" : "flushleft";
  const out = [`\\begin{${align}}`, "\\small"];
  if (photo) out.push(`${photoCommand(cv, photo, geometry(cv).side)}\\\\[12bp]`);
  const block = (title: string, values: string[]) => {
    out.push(`\\SideHeading{${escapeLatex(title)}}`, ...values.map((v) => `${v}\\\\`), "\\Sep");
  };
  if (cv.highlight) block(cv.highlight.title, [escapeLatex(cv.highlight.text)]);
  if (cv.contacts.length) block(cv.labels.contact, cv.contacts.map(contactValue));
  const column = cv.layout.sidebar === "left" ? "r" : "l";
  for (const row of cv.skills) {
    if (row.length === 1) block(row[0].title, row[0].items.map(escapeLatex));
    else {
      const columns = row.map(
        (g) => `\\begin{tabular}[t]{@{}${column}@{}}${[`\\Accent{${escapeLatex(g.title)}}`, ...g.items.map(escapeLatex)].join(" \\\\ ")}\\end{tabular}`,
      );
      out.push(`${columns.join("\\hspace{1em}")}\\\\`, "\\Sep");
    }
  }
  for (const s of cv.sections.filter((s) => s.side)) {
    out.push(`\\SideHeading{${escapeLatex(s.title)}}`);
    for (const b of s.blocks) out.push(sideBlock(b), "\\SmallSep");
    out.push("\\Sep");
  }
  out.push(`\\end{${align}}`);
  return out;
}

function heading(cv: ResolvedCv): string[] {
  return [
    `{\\Huge\\bfseries\\color{accent}${escapeLatex(cv.name)}}\\par\\vspace{.6\\baselineskip}`,
    `{\\Large\\bfseries ${escapeLatex(cv.subtitle)}}\\par`,
  ];
}

function summary(cv: ResolvedCv): string[] {
  return cv.summary ? [`\\Accent{${escapeLatex(cv.labels.profile)}}~~${inlineLatex(cv.summary)}\\par`, "\\Sep"] : [];
}

function body(cv: ResolvedCv, photo: string | undefined): string[] {
  const main = cv.sections.filter((s) => !s.side).flatMap(mainSection);
  if (cv.layout.columns === 2) {
    return [...sidebar(cv, photo), "\\framebreak", ...heading(cv), "\\bigskip", ...summary(cv), ...main];
  }
  const contacts = cv.contacts.map(contactValue).join(" \\enspace$\\cdot$\\enspace ");
  const head = [...heading(cv), ...(contacts ? ["\\vspace{4bp}", `{\\small ${contacts}\\par}`] : [])];
  const photoWidth = cv.layout.fontSize * 9;
  const top = photo
    ? [
        `\\begin{minipage}[b]{\\dimexpr\\linewidth-${bp(photoWidth)}-1em\\relax}`,
        ...head,
        "\\end{minipage}\\hfill",
        `\\begin{minipage}[t]{${bp(photoWidth)}}\\vspace{0pt}${photoCommand(cv, photo, photoWidth)}\\end{minipage}\\par`,
      ]
    : head;
  const skills = cv.skills.length
    ? [
        `\\CVSection{${escapeLatex(cv.labels.skills)}}`,
        ...cv.skills.flat().map((g) => `\\textbf{${escapeLatex(g.title)}:} ${g.items.map(escapeLatex).join(", ")}\\par`),
        "\\Sep",
      ]
    : [];
  const highlight = cv.highlight ? [`\\Accent{${escapeLatex(cv.highlight.title)}}~~${escapeLatex(cv.highlight.text)}\\par`, "\\Sep"] : [];
  return [...top, "\\bigskip", ...highlight, ...summary(cv), ...skills, ...main];
}

export function renderLatex(cv: ResolvedCv): string {
  const photo = photoFile(cv);
  return [...preamble(cv), "\\begin{document}", ...body(cv, photo), "\\end{document}", ""].join("\n");
}

export function latexBundle(project: Project, profileId: string): ZipInput {
  const cv = resolveProfile(project, profileId);
  const files: ZipInput = {
    "cv.tex": renderLatex(cv),
    "README.txt": [
      "CV made with Foja (https://github.com/foja-cv/foja).",
      "",
      "Compile cv.tex with pdflatex (or lualatex, or tectonic); it needs the memoir, XCharter,",
      "flowfram, tikz and enumitem packages, which come with TeX Live and MiKTeX.",
      ...(cv.photo?.type === "image/svg+xml" ? ["", "The photo is an SVG, which pdflatex cannot include, so it was left out."] : []),
      "",
    ].join("\n"),
  };
  const photo = photoFile(cv);
  if (photo) files[photo] = cv.photo!.bytes;
  return files;
}
