// Compiles the CV template with typst.ts and renders it to SVG, off the main thread.
//
// In:  { id, project, perfil }  — the project JSON as text and the profile to lay out.
// Out: { id, svg?, errors?, compileMs, renderMs } or { ready, initMs }.

import { createTypstCompiler } from "@myriaddreamin/typst.ts/compiler";
import { createTypstRenderer } from "@myriaddreamin/typst.ts/renderer";
import { disableDefaultFontAssets, loadFonts } from "@myriaddreamin/typst.ts/options.init";
import compilerWasm from "@myriaddreamin/typst-ts-web-compiler/wasm?url";
import rendererWasm from "@myriaddreamin/typst-ts-renderer/wasm?url";
import template from "../../../../packages/template/cv.typ?raw";

const FONTS = [
  "XCharter-Roman.otf",
  "XCharter-Bold.otf",
  "XCharter-Italic.otf",
  "XCharter-BoldItalic.otf",
  "lmmono9-regular.otf",
];

export type CompileRequest = { id: number; project: string; perfil: string };
export type CompileReply =
  | { ready: true; initMs: number }
  | { failed: string }
  | { id: number; svg?: string; errors?: string[]; warnings?: string[]; compileMs: number; renderMs: number };

const compiler = createTypstCompiler();
const renderer = createTypstRenderer();
const encoder = new TextEncoder();

async function init() {
  const start = performance.now();
  const base = import.meta.env.BASE_URL.replace(/\/?$/, "/");
  const fonts = await Promise.all(
    FONTS.map(async (name) => new Uint8Array(await (await fetch(`${base}fonts/${name}`)).arrayBuffer())),
  );
  await Promise.all([
    compiler.init({
      getModule: () => compilerWasm,
      beforeBuild: [disableDefaultFontAssets(), loadFonts(fonts)],
    }),
    renderer.init({ getModule: () => rendererWasm }),
  ]);
  compiler.addSource("/cv.typ", template);
  postMessage({ ready: true, initMs: performance.now() - start } satisfies CompileReply);
}

const ready = init().catch((error) => {
  postMessage({ failed: String(error?.stack ?? error) } satisfies CompileReply);
  throw error;
});

// Only the newest request matters: anything queued behind a running compile is dropped.
let pending: CompileRequest | undefined;
let busy = false;

async function drain() {
  if (busy) return;
  busy = true;
  await ready;
  while (pending) {
    const { id, project, perfil } = pending;
    pending = undefined;
    compiler.mapShadow("/project.json", encoder.encode(project));
    const t0 = performance.now();
    const { result, diagnostics } = await compiler.compile({
      mainFilePath: "/cv.typ",
      inputs: { perfil },
      diagnostics: "unix",
    });
    const t1 = performance.now();
    const svg = result ? await renderer.renderSvg({ artifactContent: result }) : undefined;
    const t2 = performance.now();
    postMessage({
      id,
      svg,
      errors: result ? undefined : (diagnostics as string[] | undefined) ?? ["compile failed"],
      warnings: result ? (diagnostics as string[] | undefined) : undefined,
      compileMs: t1 - t0,
      renderMs: t2 - t1,
    } satisfies CompileReply);
  }
  busy = false;
}

onmessage = (event: MessageEvent<CompileRequest>) => {
  pending = event.data;
  void drain();
};
