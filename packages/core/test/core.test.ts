import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { LABELS, crc32, formatPeriod, inlineRuns, resolveLayout, typstBundle, validate, zip, type Project } from "../src/index.ts";

const example: Project = JSON.parse(readFileSync(new URL("../../../examples/curriculum.project.json", import.meta.url), "utf8"));
const clone = (): Project => structuredClone(example);

describe("validate", () => {
  test("the example project is valid", () => {
    expect(validate(example)).toEqual([]);
  });

  test("structural problems point at the value", () => {
    const p: any = clone();
    delete p.profiles.programador.subtitle;
    p.entries.obrok.start = "2026-13";
    p.entries.obrok.color = "red";
    p.profiles.programador.sections[0].blocks.push({ type: "entry" });
    const problems = validate(p).map((x) => `${x.path} ${x.message}`);
    expect(problems).toContain('/profiles/programador missing "subtitle"');
    expect(problems).toContain("/entries/obrok/start does not match ^[0-9]{4}-(0[1-9]|1[0-2])$");
    expect(problems).toContain("/entries/obrok/color unknown member");
    expect(problems.some((x) => x.startsWith("/profiles/programador/sections/0/blocks/"))).toBe(true);
  });

  test("broken references are reported once the structure is sound", () => {
    const p = clone();
    p.profiles.programador.sections[0].blocks.push({ type: "entry", entry: "missing" });
    p.profiles.programador.contacts.push("github");
    p.entries.tecso.end = "2020-01";
    const problems = validate(p).map((x) => `${x.path} ${x.message}`);
    expect(problems).toEqual([
      "/profiles/programador/contacts/3 the project has no github contact",
      `/profiles/programador/sections/0/blocks/${p.profiles.programador.sections[0].blocks.length - 1}/entry no entry "missing"`,
      "/entries/tecso/end ends before it starts",
    ]);
  });
});

describe("dates", () => {
  const es = LABELS.es;
  test("formats like the template", () => {
    expect(formatPeriod({ title: "x", start: "2024-09", end: "2024-10" }, {}, es)).toBe("09/2024 – 10/2024");
    expect(formatPeriod({ title: "x", start: "2018-07", end: null }, {}, es)).toBe("07/2018 – actualidad");
    expect(formatPeriod({ title: "x", start: "2026-10" }, {}, es)).toBe("10/2026");
    expect(formatPeriod({ title: "x" }, {}, es)).toBe("");
    expect(formatPeriod({ title: "x", start: "2024-09", end: "2024-10" }, { dateFormat: "YYYY" }, es)).toBe("2024");
    expect(formatPeriod({ title: "x", start: "2024-09", end: null }, { dateFormat: "MMM YYYY" }, LABELS.en)).toBe("Sep 2024 – present");
  });
});

test("inline bold runs", () => {
  expect(inlineRuns("a **b** c")).toEqual([
    { text: "a ", bold: false },
    { text: "b", bold: true },
    { text: " c", bold: false },
  ]);
});

test("layout defaults", () => {
  const l = resolveLayout({ margins: { top: 20 } });
  expect(l.columns).toBe(2);
  expect(l.margins).toEqual({ top: 20, bottom: 12, left: 12, right: 8.7 });
});

describe("zip", () => {
  test("crc32", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
  });

  test("writes a central directory listing every file", () => {
    const out = zip({ "a.txt": "hello", "dir/b.bin": new Uint8Array([1, 2, 3]) });
    const view = new DataView(out.buffer);
    const end = out.length - 22;
    expect(view.getUint32(end, true)).toBe(0x06054b50);
    expect(view.getUint16(end + 10, true)).toBe(2);
    expect(view.getUint32(0, true)).toBe(0x04034b50);
  });
});

test("the Typst bundle carries the project without inline assets", () => {
  const files = typstBundle(example, "programador", { "cv.typ": "//", "labels.json": "{}", fonts: { "X.otf": new Uint8Array(1) } });
  expect(Object.keys(files).sort()).toEqual(["README.txt", "assets/photo.svg", "cv.typ", "fonts/X.otf", "labels.json", "project.json"]);
  expect(JSON.parse(files["project.json"] as string).assets).toBeUndefined();
  expect(files["README.txt"]).toContain("--input profile=programador");
});
