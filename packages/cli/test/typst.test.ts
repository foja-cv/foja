import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { NodeCompiler } from "@myriaddreamin/typst-ts-node-compiler";
import { typstBundle, validate, type Layout, type Project } from "@foja/core";
import { Typst, templateFiles } from "../src/typst.ts";
import { slug } from "@foja/core";
import { parseMarkdown } from "../src/convert.ts";

const example: Project = JSON.parse(readFileSync(new URL("../../../examples/curriculum.project.json", import.meta.url), "utf8"));
const profiles = Object.keys(example.profiles);

describe("every profile", () => {
  const typst = new Typst(example);
  test.each(profiles)("%s fits on one page", (id) => {
    const doc = typst.compile(id);
    expect(doc.numOfPages).toBe(1);
    expect(typst.pdf(doc).subarray(0, 5).toString()).toBe("%PDF-");
  });

  test("marks come in start/end pairs with positions", () => {
    const marks = typst.marks(typst.compile("programador"));
    const paths = new Set(marks.map((m) => m.path));
    for (const path of ["name", "summary", "contacts", "sections.0", "sections.0.blocks.0", "sections.3.blocks.0"]) {
      expect(paths).toContain(path);
    }
    for (const path of paths) {
      const [start, end] = ["start", "end"].map((kind) => marks.find((m) => m.path === path && m.kind === kind)!);
      expect(start.page).toBe(1);
      expect(end.y).toBeGreaterThanOrEqual(start.y);
    }
  });
});

const variants: [string, Layout][] = [
  ["one column", { columns: 1 }],
  ["one column, round photo", { columns: 1, photo: "circle" }],
  ["sidebar on the right", { sidebar: "right", sidebarWidth: 32 }],
  ["no photo, rounded corners", { photo: "none" }],
  ["rounded photo", { photo: "rounded" }],
  ["English labels, month names", { labels: "en", dateFormat: "MMM YYYY" }],
  ["years only", { dateFormat: "YYYY" }],
  ["letter paper, wide margins", { paper: "us-letter", margins: { top: 20, bottom: 20, left: 20, right: 20 } }],
  ["compact, small type", { density: "compact", fontSize: 9 }],
  ["relaxed, large type, accent", { density: "relaxed", fontSize: 11, accent: "#aa3355" }],
];

describe("layout options", () => {
  test.each(variants)("%s", (_, layout) => {
    const project = structuredClone(example);
    project.profiles.programador.layout = layout;
    expect(validate(project)).toEqual([]);
    const typst = new Typst(project);
    const doc = typst.compile("programador");
    expect(doc.numOfPages).toBeGreaterThanOrEqual(1);
  });

  test("the one-column layout lists the skills as a section", () => {
    const project = structuredClone(example);
    project.profiles.programador.layout = { columns: 1 };
    const svg = new Typst(project).svg(new Typst(project).compile("programador"));
    expect(svg.length).toBeGreaterThan(1000);
  });
});

test("the Typst bundle compiles on its own", () => {
  const files = typstBundle(example, "docente-ia", templateFiles());
  const fontBlobs = Object.entries(files)
    .filter(([name]) => name.endsWith(".otf"))
    .map(([, data]) => Buffer.from(data as Uint8Array));
  // The bundle is compiled from its own directory, as `typst compile` would with the root there.
  const compilerAtRoot = NodeCompiler.create({ workspace: "/bundle", fontArgs: [{ fontBlobs }] });
  for (const [name, data] of Object.entries(files)) {
    compilerAtRoot.mapShadow(`/bundle/${name}`, Buffer.from(typeof data === "string" ? new TextEncoder().encode(data) : data));
  }
  const result = compilerAtRoot.compile({ mainFilePath: "/bundle/cv.typ", inputs: { profile: "docente-ia" } });
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

describe("geometry of the marks", async () => {
  const { markBoxes, partAt, overflowLines, pageGeometry } = await import("@foja/core");
  const typst = new Typst(example);
  const profile = example.profiles.programador;
  const boxes = markBoxes(typst.marks(typst.compile("programador")), profile);

  test("the columns match the template", () => {
    const g = pageGeometry(profile.layout);
    expect(g.side!.width).toBeCloseTo(144.5, 0);
    expect(g.main.width).toBeCloseTo(374, 0);
  });

  test("a point in a column finds the innermost part there", () => {
    const summary = boxes.find((b) => b.path === "summary")!;
    expect(partAt(boxes, 1, summary.x + 50, summary.y + summary.height / 2)).toBe("summary");
    const entry = boxes.find((b) => b.path === "sections.0.blocks.1")!;
    expect(partAt(boxes, 1, entry.x + 10, entry.y + entry.height / 2)).toBe("sections.0.blocks.1");
    const contacts = boxes.find((b) => b.path === "contacts")!;
    expect(contacts.x).toBeLessThan(summary.x);
    expect(partAt(boxes, 1, contacts.x + 100, contacts.y + 2)).toBe("contacts");
  });

  test("overflow is counted in lines", () => {
    expect(overflowLines(typst.marks(typst.compile("programador")), profile.layout)).toBe(0);
    const long = structuredClone(example);
    const p = long.profiles.programador;
    p.sections[0].blocks.push(...p.sections[0].blocks, ...p.sections[0].blocks);
    const t2 = new Typst(long);
    const marks = t2.marks(t2.compile("programador"));
    expect(Math.max(...marks.map((m) => m.page))).toBeGreaterThan(1);
    expect(overflowLines(marks, p.layout)).toBeGreaterThan(5);
  });
});
