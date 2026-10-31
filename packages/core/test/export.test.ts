import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { resolveProfile, imageSize, toBase64, validate, type Project } from "../src/index.ts";
import { bundleExports, escapeLatex, exportFiles, inlineLatex, inlineMarkdown, renderLatex, renderMarkdown } from "../src/export/index.ts";

const example: Project = JSON.parse(readFileSync(new URL("../../../examples/curriculum.project.json", import.meta.url), "utf8"));
const decoder = new TextDecoder();

/** Names and contents of a stored-only ZIP (what zip.ts writes). */
function unzip(data: Uint8Array): Record<string, Uint8Array> {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const out: Record<string, Uint8Array> = {};
  let at = 0;
  while (view.getUint32(at, true) === 0x04034b50) {
    const size = view.getUint32(at + 18, true);
    const nameLength = view.getUint16(at + 26, true);
    const name = decoder.decode(data.subarray(at + 30, at + 30 + nameLength));
    out[name] = data.subarray(at + 30 + nameLength, at + 30 + nameLength + size);
    at += 30 + nameLength + size;
  }
  return out;
}

describe("resolve", () => {
  test("entries, dates and contacts", () => {
    const cv = resolveProfile(example, "programador");
    expect(cv.name).toBe("Bautista Damián Fiori");
    expect(cv.contacts.map((c) => c.kind)).toEqual(["phone", "email", "linkedin"]);
    expect(cv.contacts[2].href).toBe("https://linkedin.com/in/b-d-fiori");
    const first = cv.sections[0].blocks[0];
    expect(first.type === "entry" && first.entry.period).toBe("05/2026 – actualidad");
    expect(cv.sections.filter((s) => s.side).map((s) => s.id)).toEqual(["fortalezas", "proyectos-personales"]);
  });

  test("one column puts every section in the main flow", () => {
    const p = structuredClone(example);
    p.profiles.programador.layout = { columns: 1 };
    expect(resolveProfile(p, "programador").sections.some((s) => s.side)).toBe(false);
  });

  test("image sizes from headers", () => {
    const png = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAMAAAACCAIAAAASFvFNAAAAEklEQVR4nGP4z8DwnwEIGP4DAC/kBPxtZ0k3AAAAAElFTkSuQmCC"), (c) => c.charCodeAt(0));
    expect(imageSize(png)).toEqual({ width: 3, height: 2 });
  });
});

describe("LaTeX", () => {
  test("escapes specials and keeps bold", () => {
    expect(escapeLatex("50% & $5 #1 a_b {x} ~ ^ \\")).toBe("50\\% \\& \\$5 \\#1 a\\_b \\{x\\} \\textasciitilde{} \\textasciicircum{} \\textbackslash{}");
    expect(inlineLatex("a **b_c** d")).toBe("a \\textbf{b\\_c} d");
  });

  test("two columns: header frame, sidebar first, main after the frame break", () => {
    const tex = renderLatex(resolveProfile(example, "programador"));
    expect(tex).toContain("\\newstaticframe[1]{\\textwidth}");
    expect(tex).toContain("\\FitSide{");
    expect(tex.indexOf("\\SideHeading{Fortalezas}")).toBeLessThan(tex.indexOf("\\framebreak"));
    expect(tex.indexOf("\\framebreak")).toBeLessThan(tex.indexOf("\\CVSection{Experiencia}"));
    expect(tex).toContain("\\definecolor{accent}{HTML}{1F5F5B}");
    expect(tex).not.toMatch(/dotted|RoyalBlue|cmyk/);
    expect(tex).not.toContain("photo"); // the fixture's photo is an SVG, which pdflatex cannot take
  });

  test("layout options reach the preamble", () => {
    const p = structuredClone(example);
    p.profiles.programador.layout = { columns: 1, paper: "us-letter", accent: "#aa3355", fontSize: 11, labels: "en" };
    const tex = renderLatex(resolveProfile(p, "programador"));
    expect(tex).toContain("\\documentclass[letterpaper,11pt]{memoir}");
    expect(tex).toContain("\\definecolor{accent}{HTML}{AA3355}");
    expect(tex).not.toContain("flowframe");
    expect(tex).toContain("\\CVSection{Skills}");
  });

  test("the bundle carries a JPEG photo", async () => {
    const p = structuredClone(example);
    p.assets = { "photo.jpg": { type: "image/jpeg", data: toBase64(new Uint8Array([0xff, 0xd8, 0xff, 0xd9])) } };
    p.person.photo = "photo.jpg";
    const [file] = await exportFiles(p, "programador", "tex");
    expect(Object.keys(unzip(file.data)).sort()).toEqual(["README.txt", "cv.tex", "photo.jpg"]);
  });
});

describe("Markdown", () => {
  test("escapes but keeps bold", () => {
    expect(inlineMarkdown("a **b** _c_ [d]")).toBe("a **b** \\_c\\_ \\[d\\]");
  });

  test("a readable CV", () => {
    const md = renderMarkdown(resolveProfile(example, "programador"));
    expect(md.startsWith("# Bautista Damián Fiori\n\n**Programador**\n")).toBe(true);
    expect(md).toContain("[email@example.com](mailto:email@example.com)");
    expect(md).toContain("### Desarrollador de software\n\n*Obrok* · 05/2026 – actualidad");
    expect(md).toContain("- **Datalogger ATtiny85.** Diseño de un datalogger");
    expect(md.indexOf("## Educación")).toBeLessThan(md.indexOf("## Fortalezas"));
    expect(md).not.toMatch(/\n{3}/);
  });
});

describe("files", () => {
  test("names and the all-formats bundle", async () => {
    const files = [
      ...(await exportFiles(example, "docente-ia", "md")),
      ...(await exportFiles(example, "docente-ia", "json")),
      ...(await exportFiles(example, "docente-ia", "docx")),
    ];
    expect(files.map((f) => f.name)).toEqual([
      "bautista-damian-fiori-docente-ia.md",
      "bautista-damian-fiori.foja.json",
      "bautista-damian-fiori-docente-ia.resolved.json",
      "bautista-damian-fiori-docente-ia.docx",
    ]);
    expect(JSON.parse(decoder.decode(files[1].data))).toEqual(example);
    const resolved = JSON.parse(decoder.decode(files[2].data));
    expect(resolved.format).toBe("foja/2-resolved");
    const all = bundleExports(example, "docente-ia", files);
    expect(Object.keys(unzip(all.data))).toHaveLength(4);
  });

  test("Word: a valid package with the text and the bullets", async () => {
    const [docx] = await exportFiles(example, "programador", "docx");
    expect(docx.data[0]).toBe(0x50); // PK
    // docx deflates its parts; Node's zlib reads them back.
    const { inflateRawSync } = await import("node:zlib");
    const view = new DataView(docx.data.buffer, docx.data.byteOffset);
    let at = 0;
    let documentXml = "";
    while (view.getUint32(at, true) === 0x04034b50) {
      const method = view.getUint16(at + 8, true);
      const size = view.getUint32(at + 18, true);
      const nameLength = view.getUint16(at + 26, true);
      const extra = view.getUint16(at + 28, true);
      const name = decoder.decode(docx.data.subarray(at + 30, at + 30 + nameLength));
      const body = docx.data.subarray(at + 30 + nameLength + extra, at + 30 + nameLength + extra + size);
      if (name === "word/document.xml") documentXml = decoder.decode(method === 8 ? inflateRawSync(body) : body);
      at += 30 + nameLength + extra + size;
    }
    expect(documentXml).toContain("Bautista Damián Fiori");
    expect(documentXml).toContain("Datalogger ATtiny85. ");
    expect(documentXml).toContain("<w:smallCaps/>");
    expect(documentXml).toMatch(/w:fill="[0-9A-F]{6}"/); // the shaded sidebar
    expect(documentXml).not.toContain('w:val="dotted"');
  });
});

describe("hostile or unusual input", () => {
  test("a contact cannot inject LaTeX", () => {
    const p = structuredClone(example);
    p.contacts.email = "a}{x}\\input{/etc/passwd}\\iffalse{";
    p.contacts.website = "https://ex.com/a b_c~d#e%f&g";
    p.profiles.programador.contacts = ["email", "website"];
    const tex = renderLatex(resolveProfile(p, "programador"));
    const hrefs = [...tex.matchAll(/\\href\{([^}]*)\}/g)].map((m) => m[1]);
    expect(hrefs).toHaveLength(2);
    // Only plain characters and escaped percent signs are left.
    for (const h of hrefs) expect(h.replace(/\\%/g, "%")).toMatch(/^[A-Za-z0-9\-./:?=@+,;%]+$/);
    expect(tex).not.toContain("\\input{/etc/passwd}");
  });

  test("ids that are Object.prototype members are not found", () => {
    const p = structuredClone(example);
    p.profiles.programador.sections[0].blocks.push({ type: "entry", entry: "constructor" });
    p.profiles.programador.skills.push(["tostring"]);
    expect(validate(p).filter((x) => x.severity === "error").map((x) => x.message)).toEqual(['no skill group "tostring"', 'no entry "constructor"']);
  });

  test("empty texts and a dropped contact are warnings, not errors", () => {
    const p = structuredClone(example);
    p.profiles.programador.subtitle = "";
    p.profiles.programador.sections[0].blocks.push({ type: "item", text: "" });
    delete p.contacts.phone;
    const problems = validate(p);
    expect(problems.length).toBeGreaterThan(0);
    expect(problems.every((x) => x.severity === "warning")).toBe(true);
  });

  test("names without Latin letters still give file names", async () => {
    const p = structuredClone(example);
    p.person.givenNames = ["Мария"];
    p.person.familyNames = ["Иванова"];
    const [md] = await exportFiles(p, "programador", "md");
    expect(md.name).toBe("cv-programador.md");
  });

  test("a skill starting with [ or * keeps LaTeX line breaks sound", () => {
    const p = structuredClone(example);
    const first = Object.keys(p.skills)[0];
    p.skills[first].items = ["[C++]", "*nix", "Go"];
    const tex = renderLatex(resolveProfile(p, "programador"));
    expect(tex).toContain("[C++]\\\\{}*nix\\\\{}Go");
    expect(tex).not.toMatch(/\\\\\s*\[C/);
  });

  test("control characters do not reach the Word XML", async () => {
    const p = structuredClone(example);
    p.profiles.programador.summary = "uno\u000bdos\u000ctres";
    const [docx] = await exportFiles(p, "programador", "docx");
    const { inflateRawSync } = await import("node:zlib");
    const view = new DataView(docx.data.buffer, docx.data.byteOffset);
    let at = 0;
    let xml = "";
    while (view.getUint32(at, true) === 0x04034b50) {
      const method = view.getUint16(at + 8, true);
      const size = view.getUint32(at + 18, true);
      const nameLength = view.getUint16(at + 26, true);
      const extra = view.getUint16(at + 28, true);
      const name = decoder.decode(docx.data.subarray(at + 30, at + 30 + nameLength));
      const body = docx.data.subarray(at + 30 + nameLength + extra, at + 30 + nameLength + extra + size);
      if (name === "word/document.xml") xml = decoder.decode(method === 8 ? inflateRawSync(body) : body);
      at += 30 + nameLength + extra + size;
    }
    expect(xml).toContain("uno dos tres");
    expect(xml).not.toMatch(/[\u000b\u000c]/);
  });
});
