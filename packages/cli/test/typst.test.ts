import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { NodeCompiler } from "@myriaddreamin/typst-ts-node-compiler";
import { BUILTIN_STYLES, STYLE_SKELETON, markBoxes, overflowLines, partAt, slug, typstBundle, validate, type Layout, type Project } from "@foja/core";
import { Typst, templateFiles } from "../src/typst.ts";
import { parseMarkdown } from "../src/convert.ts";

const read = (path: string): Project => JSON.parse(readFileSync(new URL(`../../../examples/${path}`, import.meta.url), "utf8"));
const curriculum = read("curriculum.project.json");
const example = read("example.project.json");
const A4 = { width: 595.28, height: 841.89 };

function withStyle(project: Project, style: string, layout: Layout = {}): Project {
  const p = structuredClone(project);
  for (const profile of Object.values(p.profiles)) profile.layout = { ...profile.layout, ...layout, template: style };
  return p;
}

describe.each(BUILTIN_STYLES.map((s) => s.id))("style %s", (style) => {
  test("compiles every profile, with marks in pairs and a declared geometry", () => {
    for (const project of [curriculum, example]) {
      const p = withStyle(project, style);
      const typst = new Typst(p);
      for (const id of Object.keys(p.profiles)) {
        const doc = typst.compile(id);
        expect(typst.pdf(doc).subarray(0, 5).toString()).toBe("%PDF-");
        const marks = typst.marks(doc);
        const paths = new Set(marks.map((m) => m.path));
        for (const path of ["name", "subtitle", "sections.0", "sections.0.blocks.0"]) expect(paths).toContain(path);
        for (const path of paths) expect(marks.filter((m) => m.path === path).map((m) => m.kind).sort()).toEqual(["end", "start"]);
        expect(typst.geometry(doc)?.main?.width).toBeGreaterThan(200);
      }
    }
  });
});

test("the example fits on one page in the default style", () => {
  const typst = new Typst(example);
  for (const id of Object.keys(example.profiles)) expect(typst.compile(id).numOfPages).toBe(1);
});

describe("click geometry (Legajo)", () => {
  const typst = new Typst(example);
  const doc = typst.compile("desarrolladora");
  const marks = typst.marks(doc);
  const geometry = typst.geometry(doc)!;
  const boxes = markBoxes(marks, geometry, A4);

  test("the two columns are declared", () => {
    expect(geometry.side!.x).toBeLessThan(geometry.main!.x);
  });

  test("a point finds the innermost part in its column", () => {
    const entry = boxes.find((b) => b.path === "sections.0.blocks.1")!;
    expect(partAt(boxes, 1, entry.x + 10, entry.y + entry.height / 2)).toBe("sections.0.blocks.1");
    const contacts = boxes.find((b) => b.path === "contacts")!;
    expect(contacts.x).toBe(geometry.side!.x);
    expect(partAt(boxes, 1, contacts.x + 20, contacts.y + contacts.height / 2)).toBe("contacts");
  });

  test("overflow is counted in lines", () => {
    expect(overflowLines(marks)).toBe(0);
    const long = structuredClone(example);
    const s = long.profiles.desarrolladora.sections[0];
    s.blocks = Array.from({ length: 6 }, () => s.blocks).flat();
    const t2 = new Typst(long);
    const m2 = t2.marks(t2.compile("desarrolladora"));
    expect(Math.max(...m2.map((m) => m.page))).toBeGreaterThan(1);
    expect(overflowLines(m2)).toBeGreaterThan(5);
  });
});

const variants: [string, Layout][] = [
  ["one column", { columns: 1 }],
  ["one column, round photo", { columns: 1, photo: "circle" }],
  ["sidebar on the right, wide", { sidebar: "right", sidebarWidth: 38 }],
  ["no photo", { photo: "none" }],
  ["English labels, month names", { labels: "en", dateFormat: "MMM YYYY" }],
  ["years only, sans", { dateFormat: "YYYY", font: "Noto Sans" }],
  ["letter paper, wide margins", { paper: "us-letter", margins: { top: 25, bottom: 25, left: 25, right: 25 } }],
  ["compact, small type", { density: "compact", fontSize: 9 }],
  ["relaxed, large type, accent", { density: "relaxed", fontSize: 11, accent: "#aa3355" }],
];

describe("layout options", () => {
  test.each(variants)("%s", (_, layout) => {
    for (const style of BUILTIN_STYLES.map((s) => s.id)) {
      const p = withStyle(curriculum, style, layout);
      expect(validate(p)).toEqual([]);
      expect(new Typst(p).compile("programador").numOfPages).toBeGreaterThanOrEqual(1);
    }
  });
});

describe("styles of one's own", () => {
  test("the skeleton compiles as a project style", () => {
    const p = structuredClone(example);
    p.templates = { mio: { name: "Mío", source: STYLE_SKELETON } };
    p.profiles.desarrolladora.layout = { template: "mio" };
    expect(validate(p)).toEqual([]);
    const typst = new Typst(p);
    const doc = typst.compile("desarrolladora");
    expect(new Set(typst.marks(doc).map((m) => m.path))).toContain("sections.0.blocks.0");
  });

  test("a style that does not exist is a validation error", () => {
    const p = structuredClone(example);
    p.profiles.desarrolladora.layout = { template: "nada" };
    expect(validate(p).map((x) => x.path)).toEqual(["/profiles/desarrolladora/layout/template"]);
  });

  test("a style with a Typst error reports it", () => {
    const p = structuredClone(example);
    p.templates = { roto: { name: "Roto", source: '#import "/lib.typ": *\n#cv.nope' } };
    p.profiles.desarrolladora.layout = { template: "roto" };
    expect(() => new Typst(p).compile("desarrolladora")).toThrow(/Typst failed/);
  });
});

test("the Typst bundle compiles on its own", () => {
  const p = withStyle(example, "banda");
  const files = typstBundle(p, "docente", templateFiles());
  expect(Object.keys(files)).toEqual(expect.arrayContaining(["cv.typ", "lib.typ", "styles/legajo.typ", "styles/banda.typ", "styles/minimal.typ"]));
  const fontBlobs = Object.entries(files)
    .filter(([name]) => /\.(otf|ttf)$/.test(name))
    .map(([, data]) => Buffer.from(data as Uint8Array));
  const compiler = NodeCompiler.create({ workspace: "/bundle", fontArgs: [{ fontBlobs }] });
  for (const [name, data] of Object.entries(files)) {
    compiler.mapShadow(`/bundle/${name}`, Buffer.from(typeof data === "string" ? new TextEncoder().encode(data) : data));
  }
  const result = compiler.compile({ mainFilePath: "/bundle/cv.typ", inputs: { profile: "docente" } });
  expect(result.takeError()).toBeNull();
  expect(result.result?.numOfPages).toBe(1);
});

describe("curriculum converter", () => {
  test("slug", () => {
    expect(slug("Programación")).toBe("programacion");
    expect(slug("Experiencia docente y de debate")).toBe("experiencia-docente-y-de-debate");
  });
  test("parseMarkdown", () => {
    expect(parseMarkdown("intro\n# Uno\nlinea a\nlinea b\n\n# Dos\nc")).toEqual([
      { text: "intro" },
      { heading: "Uno", text: "linea a linea b" },
      { heading: "Dos", text: "c" },
    ]);
  });
});
