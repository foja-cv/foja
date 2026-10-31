// What the Typst compiler needs to see, the same for the browser worker, the CLI and the `.typ`
// export: the project JSON at /project.json (without the asset data, which would make every
// compile parse megabytes of base64) and each asset as a file under /assets/.

import type { Project } from "./types.ts";

export const MAIN_PATH = "/cv.typ";
export const LABELS_PATH = "/labels.json";
export const PROJECT_PATH = "/project.json";

const encoder = new TextEncoder();

export function fromBase64(data: string): Uint8Array {
  const raw = atob(data);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function toBase64(bytes: Uint8Array): string {
  let raw = "";
  for (let i = 0; i < bytes.length; i += 0x8000) raw += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(raw);
}

/** The project as the template reads it. */
export function projectForTypst(project: Project): Uint8Array {
  const { assets: _assets, ...rest } = project;
  return encoder.encode(JSON.stringify(rest));
}

/** `[path, bytes]` of every asset. */
export function assetFiles(project: Project): [string, Uint8Array][] {
  return Object.entries(project.assets ?? {}).map(([name, asset]) => [`/assets/${name}`, fromBase64(asset.data)]);
}

export function typstInputs(profileId: string): Record<string, string> {
  return { profile: profileId };
}

/** A marker emitted by the template around each editable part (see `mark` in cv.typ). */
export interface Mark {
  path: string;
  kind: "start" | "end";
  page: number;
  y: number;
}
