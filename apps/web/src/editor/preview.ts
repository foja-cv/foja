// The live preview: one compiler worker for the whole page, fed with the current project and
// profile (debounced), plus PDF exports through the same worker.

import { create } from "zustand";
import type { Mark, Project, StyleGeometry } from "@foja/core";
import type { WorkerReply, WorkerRequest } from "../lib/typst.worker";
import { useEditor } from "./store";

export interface PreviewState {
  ready: boolean;
  failed?: string;
  svg?: string;
  pages: number;
  marks: Mark[];
  geometry?: StyleGeometry;
  errors?: string[];
  warnings?: string[];
  compileMs?: number;
  renderMs?: number;
  /** The project the shown render came from (it can lag behind while typing). */
  renderedId: number;
}

export const usePreview = create<PreviewState>()(() => ({ ready: false, pages: 0, marks: [], renderedId: 0 }));

// Development builds expose the preview state to the end-to-end tests and the console.
if (import.meta.env.DEV) (globalThis as { __fojaPreview?: typeof usePreview }).__fojaPreview = usePreview;

let worker: Worker | undefined;
let nextId = 1;
const pdfWaiting = new Map<number, (reply: Extract<WorkerReply, { type: "pdf" }>) => void>();

function start(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL("../lib/typst.worker.ts", import.meta.url), { type: "module" });
  worker.onerror = (event) => usePreview.setState({ failed: event.message || "the compiler did not load" });
  worker.onmessage = ({ data }: MessageEvent<WorkerReply>) => {
    if (data.type === "ready") usePreview.setState({ ready: true });
    else if (data.type === "failed") usePreview.setState({ failed: data.error });
    else if (data.type === "pdf") {
      pdfWaiting.get(data.id)?.(data);
      pdfWaiting.delete(data.id);
    } else {
      // The last good render stays on screen when there is an error.
      usePreview.setState(
        data.svg
          ? { svg: data.svg, pages: data.pages ?? 1, marks: data.marks ?? [], geometry: data.geometry, errors: undefined, warnings: data.warnings, compileMs: data.compileMs, renderMs: data.renderMs, renderedId: data.id }
          : { errors: data.errors, compileMs: data.compileMs },
      );
    }
  };
  return worker;
}

function post(request: WorkerRequest) {
  start().postMessage(request);
}

let timer: ReturnType<typeof setTimeout> | undefined;

/** Starts the worker and re-renders whenever the project or the profile changes. */
export function connectPreview() {
  start();
  const render = () => {
    const { project, profileId } = useEditor.getState();
    if (project && project.profiles[profileId]) post({ type: "render", id: nextId++, project, profile: profileId });
  };
  render();
  return useEditor.subscribe((state, prev) => {
    if (state.project === prev.project && state.profileId === prev.profileId) return;
    clearTimeout(timer);
    timer = setTimeout(render, 80);
  });
}

export function compilePdf(project: Project, profile: string): Promise<Uint8Array> {
  const id = nextId++;
  post({ type: "pdf", id, project, profile });
  return new Promise((resolve, reject) =>
    pdfWaiting.set(id, (reply) => (reply.pdf ? resolve(reply.pdf) : reject(new Error((reply.errors ?? ["PDF failed"]).join("\n"))))),
  );
}
