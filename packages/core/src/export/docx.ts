// Word export with the `docx` library, in Foja's Legajo look whatever the Typst style: the name
// in small caps over a rule, the sidebar as a shaded cell, small-caps section titles, and every
// entry as a row with its dates in a column of their own. One or two columns following the
// layout options. Word has no XCharter, so the serif is Georgia (Windows and macOS; LibreOffice
// substitutes it); the sans option uses Noto Sans, or what the system offers for it.

import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  ImageRun,
  LevelFormat,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableBorders,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
  type IParagraphOptions,
  type ParagraphChild,
} from "docx";
import { DEFAULT_ACCENT, inlineRuns } from "../project.ts";
import type { ResolvedBlock, ResolvedContact, ResolvedCv, ResolvedSection } from "../resolve.ts";
import type { Item } from "../types.ts";

const TWIP_PER_MM = 1440 / 25.4;
const PAPER = { a4: { width: 210, height: 297 }, "us-letter": { width: 215.9, height: 279.4 } };
const NONE = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const NO_BORDERS = { top: NONE, bottom: NONE, left: NONE, right: NONE };
const INK = "1F2A2E";
const MUTED = "68767B";

/** `#rrggbb` mixed with white: `amount` 0 is the colour, 1 is white. */
function lighten(hex: string, amount: number): string {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return c.map((v) => Math.round(v + (255 - v) * amount).toString(16).padStart(2, "0")).join("").toUpperCase();
}

interface Ctx {
  cv: ResolvedCv;
  font: string;
  accent: string;
  tint: string;
  rule: string;
  /** Half-points. */
  size: number;
  small: number;
  /** Twips. */
  sep: number;
  smallSep: number;
}

type RunOptions = { bold?: boolean; italics?: boolean; size?: number; color?: string; smallCaps?: boolean };

const plain = (ctx: Ctx, text: string, o: RunOptions = {}) =>
  new TextRun({ text, font: ctx.font, size: o.size ?? ctx.size, bold: o.bold, italics: o.italics, color: o.color ?? INK, smallCaps: o.smallCaps });

function runs(ctx: Ctx, text: string, o: RunOptions = {}): TextRun[] {
  return inlineRuns(text).map((r) => plain(ctx, r.text, { ...o, bold: o.bold || r.bold }));
}

function para(children: ParagraphChild[], options: Omit<IParagraphOptions, "children"> = {}): Paragraph {
  return new Paragraph({ children, ...options });
}

function bulletItems(ctx: Ctx, items: Item[]): Paragraph[] {
  return items.map((it) =>
    para([...(it.heading ? [plain(ctx, `${it.heading}. `, { bold: true })] : []), ...runs(ctx, it.text)], {
      numbering: { reference: "dash", level: 0 },
      alignment: AlignmentType.JUSTIFIED,
    }),
  );
}

function contactChild(ctx: Ctx, c: ResolvedContact, size: number): ParagraphChild {
  const run = plain(ctx, c.value, { size });
  return c.href && c.kind !== "phone" ? new ExternalHyperlink({ link: c.href, children: [run] }) : run;
}

function photoRun(cv: ResolvedCv, widthPt: number): ImageRun | undefined {
  const photo = cv.photo;
  if (!photo || photo.type === "image/svg+xml") return undefined;
  const size = photo.size ?? { width: 4, height: 3 };
  const width = Math.round((widthPt * 96) / 72); // docx sizes images in pixels at 96 dpi
  return new ImageRun({
    type: photo.type === "image/png" ? "png" : "jpg",
    data: photo.bytes,
    transformation: { width, height: Math.round((width * size.height) / size.width) },
  });
}

/** Small caps title with a hairline under it, kept with what follows. */
function sectionTitle(ctx: Ctx, title: string): Paragraph {
  return para([plain(ctx, title.toLowerCase(), { bold: true, color: ctx.accent, smallCaps: true, size: Math.round(ctx.size * 1.1) })], {
    spacing: { before: ctx.sep, after: ctx.smallSep },
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: ctx.rule, space: 2 } },
    keepNext: true,
  });
}

function mainSection(ctx: Ctx, s: ResolvedSection, widthTwip: number): (Paragraph | Table)[] {
  const dateWidth = Math.round(2 * 10 * TWIP_PER_MM * (ctx.cv.layout.fontSize / 10));
  const rows: TableRow[] = [];
  const out: (Paragraph | Table)[] = [sectionTitle(ctx, s.title)];
  const flushRows = () => {
    if (!rows.length) return;
    out.push(
      new Table({
        layout: TableLayoutType.FIXED,
        width: { size: widthTwip, type: WidthType.DXA },
        columnWidths: [dateWidth, widthTwip - dateWidth],
        borders: TableBorders.NONE,
        rows: rows.splice(0),
      }),
    );
  };
  for (const b of s.blocks) {
    if (b.type !== "entry") {
      flushRows();
      out.push(...(b.type === "item" ? bulletItems(ctx, [b]) : [para(runs(ctx, b.text), { alignment: AlignmentType.JUSTIFIED })]));
      continue;
    }
    const e = b.entry;
    const content = [
      para([plain(ctx, e.title, { bold: true })], { keepNext: true }),
      ...(e.place ? [para([plain(ctx, e.place, { italics: true, color: MUTED })])] : []),
      ...(e.note ? [para([plain(ctx, e.note, { size: ctx.small, color: MUTED })])] : []),
      ...(s.compact ? [] : bulletItems(ctx, e.items)),
      para([], { spacing: { after: ctx.smallSep } }),
    ];
    rows.push(
      new TableRow({
        children: [
          new TableCell({ borders: NO_BORDERS, children: [para([plain(ctx, e.period, { size: ctx.small, color: MUTED })])] }),
          new TableCell({ borders: NO_BORDERS, margins: { left: 160 }, children: content }),
        ],
      }),
    );
  }
  flushRows();
  return out;
}

function header(ctx: Ctx): Paragraph[] {
  const { cv } = ctx;
  return [
    para([plain(ctx, cv.name, { smallCaps: true, size: Math.round(ctx.size * 2.3) })], {
      border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: ctx.accent, space: 1 } },
      spacing: { after: 60 },
    }),
    para([plain(ctx, cv.subtitle, { italics: true, color: MUTED, size: Math.round(ctx.size * 1.25) })], { spacing: { after: ctx.sep } }),
  ];
}

function summary(ctx: Ctx): Paragraph[] {
  return ctx.cv.summary ? [para(runs(ctx, ctx.cv.summary), { alignment: AlignmentType.JUSTIFIED })] : [];
}

function sideBlock(ctx: Ctx, b: ResolvedBlock): Paragraph[] {
  if (b.type === "entry") {
    const e = b.entry;
    return [
      para([plain(ctx, e.title, { bold: true, size: ctx.small })]),
      ...[e.place, e.period].filter(Boolean).map((v) => para([plain(ctx, v, { italics: true, size: ctx.small })])),
    ];
  }
  const heading = b.type === "item" && b.heading ? [plain(ctx, `${b.heading}. `, { bold: true, size: ctx.small })] : [];
  return [para([...heading, ...runs(ctx, b.text, { size: ctx.small })], { alignment: AlignmentType.JUSTIFIED })];
}

function sidebar(ctx: Ctx, widthPt: number): (Paragraph | Table)[] {
  const { cv } = ctx;
  const out: (Paragraph | Table)[] = [];
  const photo = photoRun(cv, widthPt);
  if (photo) out.push(para([photo], { alignment: AlignmentType.CENTER, spacing: { after: 160 } }));
  const heading = (title: string) =>
    para([plain(ctx, title.toLowerCase(), { bold: true, color: ctx.accent, smallCaps: true, size: ctx.small })], { keepNext: true, spacing: { after: 40 } });
  const block = (title: string, values: ParagraphChild[][]) => {
    out.push(heading(title), ...values.map((v) => para(v)), para([], { spacing: { after: ctx.sep } }));
  };
  if (cv.highlight) block(cv.highlight.title, [[plain(ctx, cv.highlight.text, { size: ctx.small })]]);
  if (cv.contacts.length) block(cv.labels.contact, cv.contacts.map((c) => [contactChild(ctx, c, ctx.small)]));
  for (const row of cv.skills) {
    if (row.length === 1) {
      block(row[0].title, row[0].items.map((v) => [plain(ctx, v, { size: ctx.small })]));
      continue;
    }
    out.push(
      new Table({
        borders: TableBorders.NONE,
        rows: [
          new TableRow({
            children: row.map(
              (g) =>
                new TableCell({
                  borders: NO_BORDERS,
                  margins: { right: 120 },
                  children: [heading(g.title), ...g.items.map((v) => para([plain(ctx, v, { size: ctx.small })]))],
                }),
            ),
          }),
        ],
      }),
      para([], { spacing: { after: ctx.sep } }),
    );
  }
  for (const s of cv.sections.filter((s) => s.side)) {
    out.push(heading(s.title));
    for (const b of s.blocks) out.push(...sideBlock(ctx, b), para([], { spacing: { after: ctx.smallSep } }));
    out.push(para([], { spacing: { after: ctx.sep } }));
  }
  return out;
}

function twoColumns(ctx: Ctx, textWidth: number): (Paragraph | Table)[] {
  const { layout } = ctx.cv;
  const gutter = Math.round(6 * TWIP_PER_MM);
  const side = Math.round((textWidth * layout.sidebarWidth) / 100);
  const main = textWidth - side - gutter;
  const pad = 200;
  const left = layout.sidebar === "left";
  const sideCell = new TableCell({
    width: { size: side, type: WidthType.DXA },
    borders: NO_BORDERS,
    shading: { type: ShadingType.CLEAR, color: "auto", fill: ctx.tint },
    margins: { top: pad, bottom: pad, left: pad, right: pad },
    children: sidebar(ctx, (side - 2 * pad) / 20),
  });
  const gap = new TableCell({ width: { size: gutter, type: WidthType.DXA }, borders: NO_BORDERS, children: [para([])] });
  const mainCell = new TableCell({
    width: { size: main, type: WidthType.DXA },
    borders: NO_BORDERS,
    verticalAlign: VerticalAlign.TOP,
    margins: { left: 0, right: 0 },
    children: [...summary(ctx), ...ctx.cv.sections.filter((s) => !s.side).flatMap((s) => mainSection(ctx, s, main))],
  });
  return [
    ...header(ctx),
    new Table({
      layout: TableLayoutType.FIXED,
      width: { size: textWidth, type: WidthType.DXA },
      columnWidths: left ? [side, gutter, main] : [main, gutter, side],
      borders: TableBorders.NONE,
      rows: [new TableRow({ children: left ? [sideCell, gap, mainCell] : [mainCell, gap, sideCell] })],
    }),
  ];
}

function oneColumn(ctx: Ctx, textWidth: number): (Paragraph | Table)[] {
  const { cv } = ctx;
  const contacts: ParagraphChild[] = cv.contacts.flatMap((c, i) => [...(i ? [plain(ctx, "  ·  ", { size: ctx.small, color: MUTED })] : []), contactChild(ctx, c, ctx.small)]);
  const head = [...header(ctx), ...(contacts.length ? [para(contacts, { spacing: { after: ctx.sep } })] : [])];
  const photo = photoRun(cv, ctx.size * 4.25);
  const top: (Paragraph | Table)[] = photo
    ? [
        new Table({
          layout: TableLayoutType.FIXED,
          width: { size: textWidth, type: WidthType.DXA },
          columnWidths: [textWidth - 2000, 2000],
          borders: TableBorders.NONE,
          rows: [
            new TableRow({
              children: [
                new TableCell({ borders: NO_BORDERS, verticalAlign: VerticalAlign.BOTTOM, children: head }),
                new TableCell({ borders: NO_BORDERS, children: [para([photo], { alignment: AlignmentType.RIGHT })] }),
              ],
            }),
          ],
        }),
      ]
    : head;
  const highlight = cv.highlight
    ? [para([plain(ctx, `${cv.highlight.title}  `, { bold: true, color: ctx.accent }), plain(ctx, cv.highlight.text)], { spacing: { after: ctx.smallSep } })]
    : [];
  const skills = cv.skills.length
    ? [
        sectionTitle(ctx, cv.labels.skills),
        ...cv.skills.flat().map((g) => para([plain(ctx, `${g.title.toLowerCase()}: `, { smallCaps: true, color: MUTED }), plain(ctx, g.items.join(", "))])),
      ]
    : [];
  return [...top, ...highlight, ...summary(ctx), ...skills, ...cv.sections.flatMap((s) => mainSection(ctx, s, textWidth))];
}

export async function renderDocx(cv: ResolvedCv): Promise<Uint8Array> {
  const l = cv.layout;
  const density = { compact: 0.7, normal: 1, relaxed: 1.3 }[l.density];
  const accentHex = l.accent ?? DEFAULT_ACCENT;
  const ctx: Ctx = {
    cv,
    font: l.font === "Noto Sans" ? "Noto Sans" : "Georgia",
    accent: accentHex.slice(1).toUpperCase(),
    tint: lighten(accentHex, 0.92),
    rule: lighten(accentHex, 0.5),
    size: Math.round(l.fontSize * 2),
    small: Math.round(l.fontSize * 1.76),
    sep: Math.round(l.fontSize * 20 * density),
    smallSep: Math.round(l.fontSize * 10 * density),
  };
  const paper = PAPER[l.paper];
  const m = l.margins;
  const textWidth = Math.round((paper.width - m.left - m.right) * TWIP_PER_MM);
  const doc = new Document({
    creator: "Foja",
    title: `${cv.name} — ${cv.subtitle}`,
    styles: {
      default: {
        document: {
          run: { font: ctx.font, size: ctx.size, color: INK },
          paragraph: { spacing: { before: 0, after: 0, line: 264 } },
        },
      },
    },
    numbering: {
      config: [
        {
          reference: "dash",
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: "–",
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 240, hanging: 200 } }, run: { color: ctx.accent } },
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: Math.round(paper.width * TWIP_PER_MM), height: Math.round(paper.height * TWIP_PER_MM) },
            margin: {
              top: Math.round(m.top * TWIP_PER_MM),
              bottom: Math.round(m.bottom * TWIP_PER_MM),
              left: Math.round(m.left * TWIP_PER_MM),
              right: Math.round(m.right * TWIP_PER_MM),
            },
          },
        },
        children: l.columns === 2 ? twoColumns(ctx, textWidth) : oneColumn(ctx, textWidth),
      },
    ],
  });
  return new Uint8Array(await Packer.toArrayBuffer(doc));
}
