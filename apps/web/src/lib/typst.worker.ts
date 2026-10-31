// Compiles the CV template with typst.ts off the main thread: SVG pages and the template's marks
// for the preview, PDF for exports.

import { createTypstCompiler, type TypstWorld } from "@myriaddreamin/typst.ts/compiler";
import { createTypstRenderer } from "@myriaddreamin/typst.ts/renderer";
import { disableDefaultFontAssets, loadFonts } from "@myriaddreamin/typst.ts/options.init";
import compilerWasm from "@myriaddreamin/typst-ts-web-compiler/wasm?url";
import rendererWasm from "@myriaddreamin/typst-ts-renderer/wasm?url";
import {
  LABELS_PATH,
  LIB_PATH,
  PROJECT_PATH,
  builtinStylePath,
  customStyleSources,
  fromBase64,
  projectForTypst,
  styleOf,
  typstInputs,
  type Mark,
  type Project,
  type StyleGeometry,
} from "@foja/core";
import lib from "@foja/template/lib.typ?raw";
import labels from "@foja/template/labels.json?raw";

const fontUrls = Object.values(
  import.meta.glob<string>("../../../../packages/template/fonts/*.{otf,ttf}", { query: "?url", import: "default", eager: true }),
);
const styleSources = import.meta.glob<string>("../../../../packages/template/styles/*.typ", { query: "?raw", import: "default", eager: true });

export type WorkerRequest =
  | { type: "render"; id: number; project: Project; profile: string }
  | { type: "pdf"; id: number; project: Project; profile: string };

export type WorkerReply =
  | { type: "ready"; initMs: number }
  | { type: "failed"; error: string }
  | {
      type: "render";
      id: number;
      svg?: string;
      pages?: number;
      marks?: Mark[];
      geometry?: StyleGeometry;
      errors?: string[];
      warnings?: string[];
      compileMs: number;
      renderMs: number;
    }
  | { type: "pdf"; id: number; pdf?: Uint8Array; errors?: string[] };

const compiler = createTypstCompiler();
const renderer = createTypstRenderer();
const encoder = new TextEncoder();

async function init() {
  const start = performance.now();
  const fonts = await Promise.all(fontUrls.map(async (url) => new Uint8Array(await (await fetch(url)).arrayBuffer())));
  await Promise.all([
    compiler.init({
      getModule: () => compilerWasm,
      beforeBuild: [disableDefaultFontAssets(), loadFonts(fonts)],
    }),
    renderer.init({ getModule: () => rendererWasm }),
  ]);
  compiler.addSource(LIB_PATH, lib);
  for (const [path, source] of Object.entries(styleSources)) compiler.addSource(builtinStylePath(path.split("/").pop()!.replace(/\.typ$/, "")), source);
  compiler.mapShadow(LABELS_PATH, encoder.encode(labels));
  postMessage({ type: "ready", initMs: performance.now() - start } satisfies WorkerReply);
}

const ready = init().catch((error) => {
  postMessage({ type: "failed", error: String(error?.stack ?? error) } satisfies WorkerReply);
  throw error;
});

// Assets are mapped again only when they change: decoding a photo on every keystroke is waste.
const mappedAssets = new Map<string, string>();
const customSources = new Map<string, string>();

function load(project: Project) {
  compiler.mapShadow(PROJECT_PATH, projectForTypst(project));
  for (const [path, source] of customStyleSources(project)) {
    if (customSources.get(path) !== source) {
      compiler.addSource(path, source);
      customSources.set(path, source);
    }
  }
  const assets = project.assets ?? {};
  for (const [name, data] of mappedAssets) {
    if (assets[name]?.data !== data) {
      compiler.unmapShadow(`/assets/${name}`);
      mappedAssets.delete(name);
    }
  }
  for (const [name, asset] of Object.entries(assets)) {
    if (!mappedAssets.has(name)) {
      compiler.mapShadow(`/assets/${name}`, fromBase64(asset.data));
      mappedAssets.set(name, asset.data);
    }
  }
}

const errorText = (e: unknown) => String((e as Error)?.stack ?? e);
const asStrings = (d: unknown) => (d as string[] | undefined)?.length ? (d as string[]) : undefined;

// One snapshot per request: compile once, then take the vector artifact, the marks or the PDF
// from the same world.
function withWorld<T>(project: Project, profile: string, fn: (world: TypstWorld) => Promise<T>): Promise<T> {
  load(project);
  return compiler.runWithWorld({ mainFilePath: styleOf(project, profile).path, inputs: typstInputs(profile) }, fn);
}

async function render(req: Extract<WorkerRequest, { type: "render" }>): Promise<WorkerReply> {
  return withWorld(req.project, req.profile, async (world) => {
    const t0 = performance.now();
    const compiled = await world.compile({ diagnostics: "unix" });
    if (compiled.hasError) {
      return { type: "render", id: req.id, errors: asStrings(compiled.diagnostics) ?? ["compile failed"], compileMs: performance.now() - t0, renderMs: 0 };
    }
    const { result: vector } = await world.vector({ diagnostics: "unix" });
    const marks = await world.query<Mark[]>({ selector: "<foja>", field: "value" });
    const geometry = (await world.query<StyleGeometry[]>({ selector: "<foja-geometry>", field: "value" }))[0];
    const t1 = performance.now();
    const svg = await renderer.renderSvg({ artifactContent: vector! });
    const pages = svg.match(/class="typst-page"/g)?.length ?? Math.max(1, ...marks.map((m) => m.page));
    return {
      type: "render",
      id: req.id,
      svg,
      pages,
      marks,
      geometry,
      warnings: asStrings(compiled.diagnostics),
      compileMs: t1 - t0,
      renderMs: performance.now() - t1,
    };
  });
}

async function pdf(req: Extract<WorkerRequest, { type: "pdf" }>): Promise<WorkerReply> {
  return withWorld(req.project, req.profile, async (world) => {
    const { result, diagnostics } = await world.pdf({ diagnostics: "unix" });
    return result ? { type: "pdf", id: req.id, pdf: result } : { type: "pdf", id: req.id, errors: asStrings(diagnostics) ?? ["compile failed"] };
  });
}

// Renders: only the newest request matters, anything queued behind a running one is dropped.
// Exports always run, in order.
let pendingRender: Extract<WorkerRequest, { type: "render" }> | undefined;
const exports: Extract<WorkerRequest, { type: "pdf" }>[] = [];
let busy = false;

async function drain() {
  if (busy) return;
  busy = true;
  await ready;
  while (pendingRender || exports.length) {
    const next = exports.shift();
    if (next) {
      const reply = await pdf(next).catch((e): WorkerReply => ({ type: "pdf", id: next.id, errors: [errorText(e)] }));
      postMessage(reply, reply.type === "pdf" && reply.pdf ? [reply.pdf.buffer] : []);
      continue;
    }
    const req = pendingRender!;
    pendingRender = undefined;
    postMessage(
      await render(req).catch((e): WorkerReply => ({ type: "render", id: req.id, errors: [errorText(e)], compileMs: 0, renderMs: 0 })),
    );
  }
  busy = false;
}

onmessage = (event: MessageEvent<WorkerRequest>) => {
  if (event.data.type === "render") pendingRender = event.data;
  else exports.push(event.data);
  void drain();
};
