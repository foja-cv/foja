// Word export with the `docx` library: one or two columns following the layout options. Two
// columns are a borderless table whose sidebar cell carries the dotted rule; Word has no
// XCharter, so the text is set in Georgia (on Windows and macOS; LibreOffice substitutes it).

import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  ImageRun,
  LevelFormat,
  Packer,
  Paragraph,
  Table,
  TableBorders,
  TableCell,
  TableLayoutType,
  TableRow,
  TabStopType,
  TextRun,
  VerticalAlign,
  WidthType,
  type IParagraphOptions,
  type ParagraphChild,
} from "docx";
import { DEFAULT_ACCENT, inlineRuns } from "../project.ts";
import type { ResolvedBlock, ResolvedContact, ResolvedCv, ResolvedSection } from "../resolve.ts";
import type { Item } from "../types.ts";

const FONT = "Georgia";
const TWIP_PER_MM = 1440 / 25.4;
const PAPER = { a4: { width: 210, height: 297 }, "us-letter": { width: 215.9, height: 279.4 } };
const NONE = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };

interface Ctx {
  cv: ResolvedCv;
  accent: string;
  /** Half-points. */
  size: number;
  small: number;
  /** Twips. */
  sep: number;
  smallSep: number;
}

function runs(ctx: Ctx, text: string, extra: { bold?: boolean; italics?: boolean; size?: number; color?: string } = {}): TextRun[] {
  return inlineRuns(text).map((r) => new TextRun({ text: r.text, font: FONT, size: extra.size ?? ctx.size, bold: extra.bold || r.bold, italics: extra.italics, color: extra.color }));
}

const plain = (ctx: Ctx, text: string, extra: Parameters<typeof runs>[2] = {}) =>
  new TextRun({ text, font: FONT, size: extra.size ?? ctx.size, bold: extra.bold, italics: extra.italics, color: extra.color });

function para(children: ParagraphChild[], options: Omit<IParagraphOptions, "children"> = {}): Paragraph {
  return new Paragraph({ children, ...options });
}

function bulletItems(ctx: Ctx, items: Item[], size = ctx.size): Paragraph[] {
  return items.map((it) =>
    para([...(it.heading ? [plain(ctx, `${it.heading}. `, { bold: true, size })] : []), ...runs(ctx, it.text, { size })], {
      numbering: { reference: "bullets", level: 0 },
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

function mainSection(ctx: Ctx, s: ResolvedSection, widthTwip: number): Paragraph[] {
  const out = [para([plain(ctx, s.title, { bold: true, size: Math.round(ctx.size * 1.2) })], { spacing: { after: ctx.smallSep }, keepNext: true })];
  for (const b of s.blocks) {
    if (b.type === "item") out.push(...bulletItems(ctx, [b]));
    else if (b.type === "paragraph") out.push(para(runs(ctx, b.text), { alignment: AlignmentType.JUSTIFIED }));
    else {
      const e = b.entry;
      out.push(
        para([plain(ctx, e.title, { bold: true, color: s.compact ? undefined : ctx.accent }), plain(ctx, `\t${e.period}`, { size: ctx.small })], {
          tabStops: [{ type: TabStopType.RIGHT, position: widthTwip }],
          keepNext: true,
        }),
      );
      if (e.place) out.push(para([plain(ctx, e.place, { italics: true, size: s.compact ? ctx.small : ctx.size })], { keepNext: true }));
      if (e.note) out.push(para([plain(ctx, e.note, { size: ctx.small })]));
      if (!s.compact) out.push(...bulletItems(ctx, e.items));
      out.push(para([], { spacing: { after: ctx.smallSep } }));
    }
  }
  out.push(para([], { spacing: { after: ctx.sep } }));
  return out;
}

function header(ctx: Ctx): Paragraph[] {
  const { cv } = ctx;
  return [
    para([plain(ctx, cv.name, { bold: true, color: ctx.accent, size: Math.round(ctx.size * 2.074) })], { spacing: { after: 100 } }),
    para([plain(ctx, cv.subtitle, { bold: true, size: Math.round(ctx.size * 1.2) })], { spacing: { after: 240 } }),
  ];
}

function summary(ctx: Ctx): Paragraph[] {
  const { cv } = ctx;
  if (!cv.summary) return [];
  return [
    para([plain(ctx, `${cv.labels.profile}  `, { bold: true, color: ctx.accent }), ...runs(ctx, cv.summary)], {
      alignment: AlignmentType.JUSTIFIED,
      spacing: { after: ctx.sep },
    }),
  ];
}

function sideBlock(ctx: Ctx, b: ResolvedBlock, alignment: (typeof AlignmentType)[keyof typeof AlignmentType]): Paragraph[] {
  if (b.type === "entry") {
    const e = b.entry;
    return [
      para([plain(ctx, e.title, { bold: true, size: ctx.small })], { alignment }),
      ...[e.place, e.period].filter(Boolean).map((v) => para([plain(ctx, v, { italics: true, size: ctx.small })], { alignment })),
    ];
  }
  if (b.type === "item" && b.heading) {
    return [para([plain(ctx, `${b.heading}. `, { bold: true, size: ctx.small }), ...runs(ctx, b.text, { size: ctx.small })], { alignment: AlignmentType.JUSTIFIED })];
  }
  return [para(runs(ctx, b.text, { size: ctx.small }), { alignment })];
}

function sidebar(ctx: Ctx, widthPt: number): (Paragraph | Table)[] {
  const { cv } = ctx;
  const alignment = cv.layout.sidebar === "left" ? AlignmentType.RIGHT : AlignmentType.LEFT;
  const out: (Paragraph | Table)[] = [];
  const photo = photoRun(cv, widthPt);
  if (photo) out.push(para([photo], { alignment, spacing: { after: 240 } }));
  const heading = (title: string) => para([plain(ctx, title, { bold: true, color: ctx.accent, size: ctx.small })], { alignment, keepNext: true });
  const block = (title: string, values: ParagraphChild[][]) => {
    out.push(heading(title), ...values.map((v) => para(v, { alignment })), para([], { spacing: { after: ctx.sep } }));
  };
  if (cv.highlight) block(cv.highlight.title, [[plain(ctx, cv.highlight.text, { size: ctx.small })]]);
  if (cv.contacts.length) block(cv.labels.contact, cv.contacts.map((c) => [contactChild(ctx, c, ctx.small)]));
  for (const row of cv.skills) {
    if (row.length === 1) {
      block(row[0].title, row[0].items.map((v) => [plain(ctx, v, { size: ctx.small })]));
      continue;
    }
    // Groups side by side: a nested borderless table, one column per group.
    out.push(
      new Table({
        borders: TableBorders.NONE,
        alignment: cv.layout.sidebar === "left" ? AlignmentType.RIGHT : AlignmentType.LEFT,
        rows: [
          new TableRow({
            children: row.map(
              (g) =>
                new TableCell({
                  borders: { top: NONE, bottom: NONE, left: NONE, right: NONE },
                  margins: { left: 60, right: 60 },
                  children: [heading(g.title), ...g.items.map((v) => para([plain(ctx, v, { size: ctx.small })], { alignment }))],
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
    for (const b of s.blocks) out.push(...sideBlock(ctx, b, alignment), para([], { spacing: { after: ctx.smallSep } }));
    out.push(para([], { spacing: { after: ctx.sep } }));
  }
  return out;
}

function twoColumns(ctx: Ctx, textWidthTwip: number): Table {
  const { layout } = ctx.cv;
  const gutter = Math.round(18 * (layout.fontSize / 10) * 20);
  const side = Math.round((textWidthTwip * layout.sidebarWidth) / 100);
  const main = textWidthTwip - side - gutter;
  const cellMargin = 0;
  const dotted = { style: BorderStyle.DOTTED, size: 12, color: ctx.accent };
  const left = layout.sidebar === "left";
  const sideCell = new TableCell({
    width: { size: side, type: WidthType.DXA },
    borders: { top: NONE, bottom: NONE, left: left ? NONE : dotted, right: left ? dotted : NONE },
    margins: { left: left ? cellMargin : gutter / 2, right: left ? gutter / 2 : cellMargin },
    children: sidebar(ctx, (side - gutter / 2) / 20),
  });
  const mainCell = new TableCell({
    width: { size: main + gutter / 2, type: WidthType.DXA },
    borders: { top: NONE, bottom: NONE, left: NONE, right: NONE },
    margins: { left: left ? gutter / 2 : 0, right: left ? 0 : gutter / 2 },
    verticalAlign: VerticalAlign.TOP,
    children: [...header(ctx), ...summary(ctx), ...ctx.cv.sections.filter((s) => !s.side).flatMap((s) => mainSection(ctx, s, main))],
  });
  return new Table({
    layout: TableLayoutType.FIXED,
    width: { size: textWidthTwip, type: WidthType.DXA },
    columnWidths: left ? [side, main + gutter / 2] : [main + gutter / 2, side],
    borders: TableBorders.NONE,
    rows: [new TableRow({ children: left ? [sideCell, mainCell] : [mainCell, sideCell] })],
  });
}

function oneColumn(ctx: Ctx, textWidthTwip: number): (Paragraph | Table)[] {
  const { cv } = ctx;
  const contacts: ParagraphChild[] = cv.contacts.flatMap((c, i) => [...(i ? [plain(ctx, "  ·  ", { size: ctx.small })] : []), contactChild(ctx, c, ctx.small)]);
  const head = [...header(ctx), ...(contacts.length ? [para(contacts, { spacing: { after: 240 } })] : [])];
  const photo = photoRun(cv, ctx.size * 4.5);
  const top: (Paragraph | Table)[] = photo
    ? [
        new Table({
          layout: TableLayoutType.FIXED,
          width: { size: textWidthTwip, type: WidthType.DXA },
          columnWidths: [textWidthTwip - 2000, 2000],
          borders: TableBorders.NONE,
          rows: [
            new TableRow({
              children: [
                new TableCell({ borders: { top: NONE, bottom: NONE, left: NONE, right: NONE }, verticalAlign: VerticalAlign.BOTTOM, children: head }),
                new TableCell({ borders: { top: NONE, bottom: NONE, left: NONE, right: NONE }, children: [para([photo], { alignment: AlignmentType.RIGHT })] }),
              ],
            }),
          ],
        }),
      ]
    : head;
  const highlight = cv.highlight
    ? [para([plain(ctx, `${cv.highlight.title}  `, { bold: true, color: ctx.accent }), plain(ctx, cv.highlight.text)], { spacing: { after: ctx.sep } })]
    : [];
  const skills = cv.skills.length
    ? [
        para([plain(ctx, cv.labels.skills, { bold: true, size: Math.round(ctx.size * 1.2) })], { spacing: { after: ctx.smallSep } }),
        ...cv.skills.flat().map((g) => para([plain(ctx, `${g.title}: `, { bold: true }), plain(ctx, g.items.join(", "))])),
        para([], { spacing: { after: ctx.sep } }),
      ]
    : [];
  return [...top, ...highlight, ...summary(ctx), ...skills, ...cv.sections.flatMap((s) => mainSection(ctx, s, textWidthTwip))];
}

export async function renderDocx(cv: ResolvedCv): Promise<Uint8Array> {
  const l = cv.layout;
  const density = { compact: 0.7, normal: 1, relaxed: 1.3 }[l.density];
  const ctx: Ctx = {
    cv,
    accent: (l.accent ?? DEFAULT_ACCENT).slice(1).toUpperCase(),
    size: Math.round(l.fontSize * 2),
    small: Math.round(l.fontSize * 1.8),
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
          run: { font: FONT, size: ctx.size },
          paragraph: { spacing: { before: 0, after: 0, line: 264 } },
        },
      },
    },
    numbering: {
      config: [
        {
          reference: "bullets",
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: "◦",
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 280, hanging: 200 } }, run: { color: ctx.accent } },
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
        children: l.columns === 2 ? [twoColumns(ctx, textWidth)] : oneColumn(ctx, textWidth),
      },
    ],
  });
  return new Uint8Array(await Packer.toArrayBuffer(doc));
}
