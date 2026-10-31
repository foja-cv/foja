# Foja: a CV editor on Typst — research and plan

Status: **phase 4 done** (2026-10-31): drag-and-drop, click-to-edit, page-fit highlighting,
command palette, photo crop; see [Phase 4 results](#phase-4-results-2026-10-31). Earlier:
[phase 3](#phase-3-results-2026-10-31),
[phase 2](#phase-2-results-2026-10-31), [phase 1](#phase-1-results-2026-10-31),
[phase 0](#phase-0-results-2026-10-30). Moved here from `bafif/curriculum`
(`docs/gui-plan.md`), where the history of the earlier drafts stays.

## Goal

A CV editor where the main generator is **Typst**: forms instead of code, a live preview that is
the real Typst output, and exports to Typst, PDF, JPG, LaTeX, Markdown, JSON and Word.

One product, three ways to run it, from the same release:

1. **CLI** (`foja`), replacing today's `cvgen`.
2. **Desktop app** installed like any other app on Linux, macOS and Windows.
3. **Public web app** that anyone can open, to keep adding features to over time.

Positioning: *a no-code CV editor built on Typst*. Note that "the Overleaf of Typst" is already
typst.app (the official, collaborative Typst editor, where you write code), so the pitch should
stress forms + live preview + exports, not the editor itself. Closest existing products:
RenderCV (YAML → Typst, CLI and a web app) and the CV templates on Typst Universe (edited as
code). No form-based Typst CV builder showed up in the search.

## 1. What exists today (in `bafif/curriculum`)

- `data/cv.json`, `data/perfiles/*.json`, `data/textos/*.md`, `data/img/foto.jpg`.
- `python/` (`cvgen`): `sources` → `model` → `build` → `latex` → `compile` (tectonic, ~1.9 s warm).
- `c/` (`cvgen-c`): dependency-free C, PDF with Helvetica, < 10 ms.

## 2. Comparison of the delivery options

| | A. Local web app in Docker | B. Tauri + Python sidecar | **C. Local-first web core + Tauri shell** |
| :--- | :--- | :--- | :--- |
| How it runs | `docker compose up`, browser on localhost | Native app; FastAPI frozen with PyInstaller/Nuitka next to it | Static web app; all rendering in the browser (WASM); Tauri wraps the same build |
| Shows up as a normal app | No | Yes (.deb/.rpm/AppImage, .dmg, .msi/.exe) | Yes (same installers) |
| Install for non-technical people | Bad: needs Docker Desktop on macOS/Windows | Good | Good |
| Installer size | n/a (images of hundreds of MB) | Large: Python + deps per OS | Small: Tauri uses the system webview; Typst WASM a few MB |
| Same code for the public web | Needs a server per user or shared | Needs a server | **Yes: the web build is the product**, static hosting |
| Server cost / attack surface for the web | Server that compiles untrusted input | Same | **None**: no server, CV data never leaves the user's browser |
| Signing / packaging pain | — | High: sidecar must be signed separately; macOS hardened runtime breaks PyInstaller's Python.framework without extra entitlements and inside-out signing | Low: only Tauri's own binary |
| Preview latency | Server round-trip | Local round-trip | In-process WASM, no network |
| Offline | Yes | Yes | Yes (assets cached; bundled in the desktop app) |
| LaTeX PDF compile in-app | Yes (tectonic) | Yes | No (BusyTeX WASM exists but downloads ~120 MB); export `.tex` instead |

**Chosen direction: C.** Docker stays for development only (hot reload + nginx, as usual), not as
the way people run the app.

### Zero cost, always

Hard rule: **the project never pays for anything** — no code-signing certificates, no Apple
Developer Program, no paid hosting, no paid domain. Every choice below is the best free option.

| Need | Free solution |
| :--- | :--- |
| Web hosting | Static site on GitHub Pages (public repo) or Cloudflare Pages; free subdomain (`*.github.io` / `*.pages.dev`) |
| Builds and releases | GitHub Actions (free for public repos, Linux/macOS/Windows runners) + GitHub Releases |
| "Installed like any app", all three systems | **PWA**: the web app installs from Chrome/Edge on Linux, macOS and Windows (and Safari "Add to Dock" on macOS), appears in the system's app menu, works offline, updates itself, and needs no signing at all |
| Windows without SmartScreen warnings | **Microsoft Store**: individual registration is free (ID check with a Microsoft account); MSIX packages are signed by Microsoft for free. The PWA can be packaged as MSIX with PWABuilder. (A plain MSI/EXE in the Store would need a paid certificate, so not that route.) |
| Signed Windows installers outside the Store | **SignPath Foundation**: free signing for OSI-licensed open source (GPL-3.0 qualifies), built on public GitHub Actions, each release approved by hand; publisher shows as "SignPath Foundation"; asks for some project reputation, so apply once there are users |
| Linux | **Flathub** (free, appears in GNOME Software/Discover, auto-updates), AUR, AppImage/.deb/.rpm on GitHub Releases; no signing needed |
| macOS native app | No free notarisation exists, and since 2026-09-01 Homebrew's main cask repo refuses apps that fail Gatekeeper. So on macOS the **PWA is the primary way**. An ad-hoc-signed Tauri `.dmg` can still be offered on GitHub Releases with the "System Settings → Privacy & Security → Open Anyway" instructions, or through our own Homebrew tap |
| App updates | Tauri updater with our own (free) signing key pair — not a CA certificate |
| CLI | npm (`npx`), Node single-executable binaries on GitHub Releases, AUR |

Chosen channels (2026-10-30): **PWA on GitHub Pages**, **Microsoft Store** (the PWA as MSIX,
free individual account) and **Flathub**. Flathub does not accept thin web wrappers, so the
Linux app is the Tauri shell with real desktop integration: opening and saving project files
through the file-chooser portal, its own file type and MIME association, fully offline with
bundled assets, built from source with vendored npm/Cargo dependencies. App ID based on the
GitHub organisation (`io.github.foja_cv.Foja`), which Flathub verifies for free.

## 3. Architecture (Typst-first)

```
                    project.json  (one self-contained document, validated by cv.schema.json)
                          │
     ┌────────────────────┼─────────────────────────┐
     ▼                    ▼                         ▼
 Typst template      exporters                  editor UI
 (reads the JSON)    LaTeX · Markdown ·         forms, profiles,
     │               JSON · Word                drag-and-drop
     ▼
 typst compiler ── PDF · SVG (preview) · PNG → JPG
 (typst.ts: WASM in the browser, native addon in the CLI)
```

Everything is TypeScript, in a workspace:

```
packages/core     schema, project format, layout options, exporters (LaTeX, Markdown, JSON, Word)
packages/template the Typst template and fonts
packages/cli      `foja` on Node, typst-ts-node-compiler for PDF/PNG
apps/web          Astro site: landing + the editor as a React island; PWA
apps/desktop      Tauri 2 shell for Flathub (and unsigned builds elsewhere)
```

The Python and C generators stay in the repo as they are (they build the current CVs) and are
retired once the new CLI reaches parity.

- **The Typst template is the generator.** It reads the project JSON (`json(...)` /
  `sys.inputs`) and lays out the CV itself, so the browser, the desktop app and the CLI all run
  the exact same `.typ` files. No Typst source is generated by Python or TypeScript.
- **Exported `.typ`** = the template + `cv.json` + photo in a `.zip`; it compiles with plain
  `typst compile` and opens in typst.app.
- **Project format v2:** one JSON document per user with base data, profiles and texts inline
  (the current multi-file `data/` layout does not fit a browser). A JSON Schema
  (`schema/cv.schema.json`) is the contract for the template, the exporters and the UI. A
  converter imports the current `data/` layout.
- **Preview:** typst.ts in a Web Worker compiles on every change (debounced) and renders SVG
  pages; the last good render stays on screen while compiling or when there is an error. Anchors
  emitted by the template (`context metadata((id: …, pos: here().position()))`) give
  click-to-edit and the page-fit indicator.
- **Exports:**

| Format | How |
| :--- | :--- |
| Typst | `.zip` with template, `cv.json`, photo (and fonts) |
| PDF | Typst |
| JPG | Typst PNG/canvas → JPEG, dpi selectable; one file per page |
| LaTeX | `.zip` with `cv.tex`, `structure.tex`, photo; optional "Open in Overleaf" button (verify their API) |
| Markdown | plain CV for READMEs, GitHub profiles, pasting into forms |
| JSON | the project file (import/export) and the resolved profile; JSON Resume later |
| Word | `.docx`, one or two columns following the layout options |

- **Fonts:** XCharter OTF bundled (CTAN `xcharter`, verify the licence) so the look matches the
  current LaTeX CV; more templates/fonts later.
- **Storage (web):** IndexedDB in the browser, plus import/export of the project JSON. No
  accounts, no server in the first public version. Desktop: project files on disk.
- **Hosting (web):** GitHub Pages, deployed by GitHub Actions, at the free `foja-cv.github.io/foja/`
  address of a GitHub organisation named after the product (a custom domain can be pointed at
  it later with a CNAME, without changing anything else). Installable as a PWA (manifest +
  service worker, offline). Publishing needs Bautista's explicit OK.
- **`cvgen-c`:** stays in `bafif/curriculum`, out of the GUI.
- **No access to version control.** Neither the app nor its exports touch any repository of the
  user. Committing the repo's `data/` stays manual and outside the app.

### Layout options (the user shapes the CV)

The layout is data, not code: a `diseño` object per profile that the Typst template and the
Word exporter both read. First set of options:

- columns: one or two; sidebar left or right, its width;
- show/hide photo, its shape; section order and which column each one goes in;
- font family and size, accent colour, margins, spacing density, page size (A4/Letter);
- date format and language of the fixed labels.

Word honours the same options (one column, or a two-column table). More options are added over
time without changing the data model.

### Versions (opt-in)

Off by default. When the user enables it, the app keeps its own history of the project:
snapshots on save and named versions ("sent to Kuepa"), with preview, diff of fields and
restore. Stored with the project (IndexedDB on the web, next to the project file on desktop).
It is not a VCS integration and never reads or writes a repository.

### Long-term vision

A general live, graphical Typst editor built around freedom: the user accumulates objects
(blocks: text, lists, entries, images, shapes) and organises them on the page, and the
template turns them into Typst. The CV is the first product on top of it. To keep that door
open without building it now, the data model uses typed blocks (an entry, a list of items, a
paragraph) and the template renders blocks by type, so new block types and layouts can be added
later. Until then, everything is scoped to CVs.

### Decision: exporters in TypeScript

Compared on quality first, then speed (download size was not a concern):

| | Python via Pyodide | **TypeScript** |
| :--- | :--- | :--- |
| Word quality | `python-docx`: solid for paragraphs and tables, but cell shading, section columns, frames and floating images need raw OOXML by hand | `docx` (npm) 9.9: native API for table shading and merges, section columns, floating images and text frames, and a layout engine that places things the way Word does |
| LaTeX, Markdown, JSON | Existing `latex.py` (~120 lines) reused | Ported once; plain string building, same output |
| Correctness | Schema checked twice (Python and the UI's TypeScript) and kept in sync by hand | One schema and one set of types shared by the forms, validation, exporters and CLI |
| Speed in the browser | Pyodide start-up of seconds on first export, CPython in WASM slower than native JS, data copied across a bridge | Native JS, instant |
| CLI | Python, `typst` binding | Node 24, `typst-ts-node-compiler` (native addon of the same typst.ts project the browser uses) |
| Failure modes | Two runtimes and a JS↔Python bridge | One runtime |

**TypeScript wins on quality** (better Word output, one source of truth for the data model)
and on speed. The Python packages installed earlier (`typst`, `python-docx`, `pillow`) were
removed again.

### Decision: Astro, not Next.js

Same criterion. The app is a fully client-side editor (WASM in workers, IndexedDB, no server)
plus public pages (landing, docs) that should load fast and rank well.

| | Next.js (static export) | **Astro** |
| :--- | :--- | :--- |
| Fit | Its strengths (server rendering, server actions, image optimisation, middleware) are unusable in a static export | Static output by default; the editor is a React island (`client:only`), the rest ships no JS |
| WASM and workers (typst.ts) | Needs webpack/Turbopack configuration for WASM in workers | Built on Vite, which handles WASM and module workers natively |
| Landing page performance | React runtime on every page | Zero JS on the landing and docs pages |
| PWA | Community plugins for the App Router, extra wiring for static export | `@vite-pwa/astro` integration |
| GitHub Pages | `basePath`, `.nojekyll` (the `_next/` folder is otherwise dropped) | Official `withastro/action` deployment, `base` option |
| Tauri | Works with static export | Works (static `dist/`) |

**Astro** it is; React, Tailwind, Zustand (+ `zundo`) and dnd-kit inside the editor island.

## 4. UX design

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ CV ▸ [programador ▾]  [+ perfil] [duplicar]     ● sin guardar   ↶ ↷   [Exportar ▾]│
├──────────────┬────────────────────────────┬──────────────────────────────────────┤
│ Datos        │  Editor of the selection   │  Preview                 1/1 pág ✓    │
│  Personales  │                            │  ┌──────────────────────────┐         │
│  Contactos   │  Obrok — Desarrollador…    │  │                          │ zoom    │
│  Habilidades │  Lugar   [Obrok        ]   │  │   (SVG pages, hotspots   │ fit     │
│ Perfil       │  Desde   [05/2026] Hasta…  │  │    clickable → editor)   │         │
│  Texto       │  Nota    [...          ]   │  │                          │         │
│  Secciones ≡ │  Tareas  ≡ item  ≡ item  + │  └──────────────────────────┘         │
│   Experiencia│                            │  ⚠ main column overflows by 4 lines   │
└──────────────┴────────────────────────────┴──────────────────────────────────────┘
```

- **Two levels, explicit:** the *data bank* (all entries, shared by every profile) and the
  *profile* (which entries, in which section, order, compact, sidebar). Editing an entry warns
  "used in 3 profiles". Including an entry in a profile is a checkbox, not a delete.
- Drag-and-drop for sections and entries (with a keyboard alternative); per-section toggles for
  compact and sidebar.
- Month pickers and an "ongoing" switch for dates; inline validation from the JSON Schema.
- **One-page discipline:** permanent "1 page ✓ / overflows by N lines" badge; overflowing
  entries highlighted in the preview.
- Click on the preview → selects the field; selecting a field → highlights it in the preview.
- Autosave, undo/redo (Ctrl+Z / Ctrl+Shift+Z), Ctrl+S, command palette (Ctrl+K).
- Export dialog: format, dpi, "all formats (.zip)"; remembers the last choice.
- First run: start from an example CV or import JSON; template picker later.
- Interface in Spanish first (i18n-ready for English); light/dark; keyboard reachable.

Stack: Astro + React island + TypeScript + Tailwind, Zustand (+ `zundo` for undo/redo),
TanStack Query only where there is async work, dnd-kit, typst.ts, `docx`, Tauri 2.

## 5. Phases

0. **Spike** (small, **done 2026-10-30**): Typst template that reads JSON and reproduces one
   profile; typst.ts in a worker rendering it in a bare Astro page; measure compile time per
   keystroke.
1. **Typst template + schema + project format v2** (and the `data/` converter); Node CLI
   `foja --formato pdf|typ`; tests on every profile (**done 2026-10-31**).
2. **Exporters** in `packages/core`: LaTeX (port of `latex.py`), Markdown, JSON, Word, JPG;
   `.zip` bundles; tests (**done 2026-10-31**).
3. **Web app core**: editor, profiles, live preview, export dialog, IndexedDB; dev in Docker
   Compose with nginx and hot reload (**done 2026-10-31**).
4. **Polish**: drag-and-drop, undo/redo, click-to-edit, page-fit highlighting, palette,
   photo crop, Playwright tests (**done 2026-10-31**).
5. **PWA + public web**: manifest, service worker, offline; GitHub Pages at `foja-cv.github.io/foja/`;
   landing page and promotion (after Bautista's OK).
6. **Microsoft Store**: the PWA packaged as MSIX with PWABuilder, free individual account
   (Bautista registers it: Microsoft account, ID and selfie).
7. **Tauri shell + Flathub**: native file access and desktop integration, Flatpak built from
   source; also AUR, unsigned builds for macOS/Windows on GitHub Releases, and SignPath
   Foundation for Windows once the project qualifies. CLI on npm.

## Phase 0 results (2026-10-30)

What was built (all in this repo):

| Piece | Where |
| :--- | :--- |
| Converter `data/` → one project document (`formato: "foja/2-draft"`): texts inline, Markdown tasks as `{encabezado, texto}` items, never reads `privado.json`; `--public` swaps the phone for a fake one and drops the photo | `scripts/convert-curriculum.mjs` |
| Test project with the three current profiles (fake phone, no address, no photo) | `examples/curriculum.project.json` |
| Typst template: reads the JSON (`json(...)`, profile from `sys.inputs.perfil`) and lays out the Wenneker look of the LaTeX CV (sidebar left and right-aligned, dotted rule, blue headings, circle bullets) | `packages/template/cv.typ` |
| Astro page + Web Worker: typst.ts compiles on every change (80 ms debounce, only the newest request is compiled), renders SVG, keeps the last good render on error, shows warnings | `apps/web/src/pages/index.astro`, `apps/web/src/lib/typst.worker.ts` |
| Dev environment: `docker compose up` → Astro dev server (hot reload) behind nginx at `http://127.0.0.1:8090/` | `docker-compose.yml`, `docker/nginx.conf` |
| Benchmark: opens `/?bench=N` in headless Chrome over the DevTools protocol, N one-character edits in a row | `scripts/bench.mjs` |

Versions: typst.ts 0.7.0 (compiler, renderer, wrapper), Astro 7.4.0, `node:24-alpine`.

### Compile time per change

`node scripts/bench.mjs http://127.0.0.1:8090/ 50`: 50 edits in a row, each adding one character
to the subtitle of `programador` and waiting for the SVG. Headless Chrome 158, Intel i3-8100
(4 cores), dev server. Two runs:

| | Run 1 | Run 2 |
| :--- | :--- | :--- |
| Typst compile, p50 / p90 / max | 50.8 / 57.3 / 95.6 ms | 46.5 / 60.0 / 79.6 ms |
| SVG render, p50 / p90 | 4.1 / 5.1 ms | 3.8 / 5.7 ms |
| Round trip (editor → SVG in the DOM), p50 / p90 | 82.5 / 113.4 ms | 76.9 / 100.7 ms |
| First compile (cold) | 370 ms | 399 ms |
| Worker start (WASM + 5 fonts) | 363 ms | 250 ms |

Reading:

- **Per keystroke ≈ 50 ms of Typst + 4 ms of SVG**: live preview on every change is viable with
  no server, even on a modest CPU. With the 80 ms debounce the page updates ≈ 160 ms after the
  last keystroke.
- The ≈ 25–30 ms between compile + render and the round trip is main-thread work: serialising
  the textarea, `postMessage` of the whole SVG and replacing it with `innerHTML`. Phase 3 should
  render incrementally (typst.ts `renderSvgDiff` / incremental server, or patch only the
  changed page) and send the project as data, not text.
- Cold start ≈ 0.6–0.8 s until the first page. The compiler WASM is **28.3 MB** (7.1 MB with
  brotli, 10.8 MB gzip); the renderer 1.0 MB; the fonts 0.6 MB. Fine once cached (PWA), but
  the first visit of the web app needs a loading state and the service worker should precache
  the WASM.

### Fidelity to the LaTeX CV

Same text, same line breaks in most paragraphs, same layout. Things learnt:

- memoir + flowfram end up with frames wider than `0.26`/`0.68` of the geometry text width; the
  template uses the widths measured on the PDF (sidebar 144.5 pt, gap 18 pt, main 374 pt, main
  column into the right margin).
- Line metrics: a 1 em line box (`top-edge: 0.8em`, `bottom-edge: -0.2em`) plus 0.2 em leading
  reproduces `\baselineskip` (12 pt at 10 pt, 11 pt at 9 pt) with no paragraph skip.
- Typst's Spanish hyphenation differs a little from babel's, so some paragraphs break one line
  differently and the page ends ≈ 1–2 lines lower.
- `\url` in LaTeX uses LM Mono 9; in Typst that font's family is `"Latin Modern Mono 9"`.

### Gotchas

- Vite must not pre-bundle typst.ts (`optimizeDeps.exclude`), the WASM is imported with `?url`.
- `fetch` of the fonts and `disableDefaultFontAssets()`: nothing is downloaded from a CDN.
- typst.ts SVG comes with fixed `width`/`height` attributes; drop `height` to scale it by CSS.
- `chrome --headless --dump-dom --timeout` does not wait for the page; hence the CDP script.

### Open points before phase 1

- ~~**Font licences.**~~ Resolved in phase 1: XCharter (Bitstream Charter free font licence) and
  LM Mono 9 (GUST Font License, LPPL 1.3c) both allow redistribution; they are committed in
  `packages/template/fonts/` with their licence texts.
- **Template look.** The Typst code is written from scratch, but the look is that of the
  Wenneker LaTeX template (CC BY-NC-SA 3.0). Decide whether to credit it or make the default
  template visibly our own before the public web release.
- ~~**Project format.**~~ Resolved in phase 1: `foja/2`, see below.

## Phase 1 results (2026-10-31)

| Piece | Where |
| :--- | :--- |
| **Project format `foja/2`**: English keys; `person`, `contacts` (fixed kinds), `skills` (groups by id), `entries` (the shared bank), `profiles` (by id) and `assets` (base64, the photo). A profile has `subtitle`, optional `highlight` (a first sidebar block, e.g. the course applied for), `contacts`, `skills` (rows of group ids), `summary`, `sections` and `layout`. Sections hold **typed blocks**: `entry` (a reference into the bank), `item` (heading + text) and `paragraph`; `column: "side"` puts a section in the sidebar | `packages/core/schema/project.schema.json`, `packages/core/src/types.ts` |
| **Validation**: the JSON Schema, checked by a small validator for the subset the schema uses (no new dependency), plus the references the schema cannot express (missing entries, skill groups, contacts or photo; end before start). Problems carry a JSON Pointer for the editor | `packages/core/src/validate.ts` |
| **Layout options** (`layout`, all optional, the defaults reproduce the LaTeX CV): one or two columns, sidebar left/right and its width, photo square/rounded/circle/none, font, size, accent colour, margins, density, A4/Letter, date format (`MM/YYYY`, `MMM YYYY`, `YYYY`), label language (`es`, `en`; labels in `packages/template/labels.json`, shared with the exporters) | `packages/template/cv.typ` |
| **Template on `foja/2`**: inputs `project` and `profile`; assets as files under `/assets/`. It emits invisible marks (`<foja>`: path, start/end, page, y) around every editable part, for click-to-edit and the page-fit badge in phase 4 | `packages/template/cv.typ` |
| **CLI** `foja build <project> [--profile id] [--format pdf\|svg\|typ] [--out dir]`, `foja validate`, `foja convert-curriculum <data> <out> [--public]`; Typst through `typst-ts-node-compiler` (the native addon of typst.ts). `typ` writes a `.zip` (template, labels, project, assets, fonts and licences, README) that compiles with a plain `typst compile --font-path fonts --input profile=<id> cv.typ` | `packages/cli/` |
| **Core helpers** shared by the CLI, the web worker and the exporters: layout defaults, dates and periods (same rules as the template), `**bold**` runs, what Typst sees (`/project.json` without the asset data, assets as files), a stored-only ZIP writer, the Typst bundle | `packages/core/src/` |
| **Tests** (vitest, 27): the example validates, structural and reference errors point at the value, dates, ZIP, every profile compiles to one page, marks come in pairs, ten layout variants compile, the Typst bundle compiles on its own, the converter | `packages/*/test/`, `npm test` (in the container) |
| **Web worker on `foja/2`**: compile, vector, marks and PDF from one snapshot (`runWithWorld`; `query` on a fresh world fails with "document is not compiled"); assets mapped again only when they change; errors caught and reported. The spike page moved to `/spike` | `apps/web/src/lib/typst.worker.ts`, `apps/web/src/pages/spike.astro` |

**Fidelity**: the three profiles laid out by the phase 1 template and by the phase 0 template give
the same word positions (pdftotext `-bbox`, 0 words moved by more than 0.3 pt; the only change is
that the photo placeholder is now a grey SVG asset instead of a box with the word "foto"). The
marks do not move anything.

**Speed** (headless Chrome, 30 edits, same machine as phase 0): compile + marks p50 51.7 ms, p90
62.2 ms; SVG 4.0 ms; round trip p50 86.6 ms. Same as phase 0: the query adds nothing measurable.

**Converter note**: `convert-curriculum` reads the photo of `data/` into the project unless
`--public` is given; the public fixture gets a grey 403×371 SVG instead. The address
(`privado.json`, `domicilio`) is never read.

**JPG**: `typst-ts-node-compiler` 0.7.0 has no PNG output, so JPG is an export of the web app
(SVG → canvas → JPEG); the CLI does PDF, SVG and the Typst bundle (and the exporters of phase 2).

## Phase 2 results (2026-10-31)

All exporters start from one **resolved profile** (`packages/core/src/resolve.ts`: entries looked
up, dates formatted, labels and layout defaults applied, contacts with links, photo bytes and
pixel size read from the JPEG/PNG header). They live under `@foja/core/export`, outside the main
entry, so the preview worker does not load `docx`.

| Format | What it is | Where |
| :--- | :--- | :--- |
| LaTeX | `.zip` with one self-contained `cv.tex` (memoir + flowfram + XCharter; sidebar and dotted rule on page 1, the main column continues) and the photo. The preamble is **written for Foja**: the Wenneker `structure.tex` (CC BY-NC-SA) is not copied. It follows the same layout options and geometry (in `bp`) as the Typst template; round and rounded photos are clipped with TikZ | `export/latex.ts` |
| Markdown | One column: name, subtitle, contacts as links, summary, skills, the main sections, then the sidebar ones; `**bold**` kept, the rest escaped | `export/markdown.ts` |
| JSON | The project file (`<name>.foja.json`, what the editor imports) and the profile resolved into plain data (`foja/2-resolved`) | `export/json.ts` |
| Word | `docx` 9.12: two columns as a fixed borderless table whose sidebar cell carries the dotted rule in the accent colour (left or right), skill groups side by side in a nested table, bullets in the accent colour, right tab for the dates, links clickable; one column with the photo beside the name. Text in **Georgia** (Word has no XCharter) | `export/docx.ts` |
| JPG | Browser only: the SVG drawn on a canvas at the chosen dpi, one JPEG per page; the text-selection `<foreignObject>` layer is stripped first (it would taint the canvas) | `apps/web/src/lib/jpg.ts` |
| All | Every format of a profile in one `.zip` | `bundleExports` in `export/index.ts` |

File names: `<name-slug>-<profile>.<ext>`, e.g. `bautista-damian-fiori-programador.pdf`. CLI:
`foja build … --format tex|md|json|docx|all`.

**Checked**: 38 tests (11 new: resolution, LaTeX escaping and preamble, Markdown, file names, the
all-formats bundle, the Word package). The LaTeX of three layouts (default; sidebar right, round
photo, accent; one column, rounded photo, English, month names) **compiles with tectonic** and
looks like the Typst output: the sidebar is 2–4 pt lower and the main column 6–9 pt higher (the
latter matches the original cvgen PDF, so the Typst template sits slightly lower than LaTeX;
justified paragraphs break differently, so a sidebar that is almost full in Typst can run a
line longer in LaTeX). The Word files are valid packages (every XML part parses; text, photo,
tables, bullets and dotted rule present) but **have not been opened in Word or LibreOffice**:
neither is installed here.

**Not done**: the "Open in Overleaf" button. Overleaf takes files as data URLs in a POST to
`overleaf.com/docs`, which sends the CV to a third party; it needs testing against the live
service, so it is left for after the public release, as an explicit user action.

## Phase 3 results (2026-10-31)

`/editor` is a React island (`client:only`) in `apps/web/src/editor/`; `/` is a placeholder
landing (phase 5). Dev: `docker compose up`, <http://127.0.0.1:8090/editor>.

| Piece | Where |
| :--- | :--- |
| **State**: Zustand store with the project, the profile, the selection and the validation problems (recomputed on every change, whatever made it: an edit, undo, a load). Undo history with `zundo` (one step per burst of edits, 800 ms; 200 steps) | `store.ts` |
| **Storage**: IndexedDB (`foja` / `projects` / `current`), autosave 500 ms after the last change, Ctrl+S, a warning before leaving with unsaved changes, state shown in the header | `storage.ts`, `App.tsx` |
| **First run**: the example (a **fictional** person, `examples/example.project.json`, two profiles; Bautista's CV stays a test fixture only), an empty project, or import a `.foja.json` (validated; the problems are listed) | `Welcome.tsx`, `projects.ts` |
| **Header**: profile selector, new, duplicate, delete (with an in-page confirmation), save state, undo/redo, project menu (new, example, import), Export (Ctrl+E) | `App.tsx` |
| **Data panels**: person (names, CV language, photo upload: JPEG/PNG up to 5 MB, stored as an asset), contacts, skill groups (one item per line), the **entry bank** (where each entry is used; "used in N profiles" warning; deletion blocked while a profile uses it) and the entry form (month pickers, "ongoing" and "single date", note, items) | `forms/` |
| **Profile panels**: name, subtitle, summary, highlight block, which contacts, skill rows (groups side by side); layout options (every option of phase 1); sections with typed blocks (include an entry of the bank, new entry, item, paragraph; reorder with ↑ ↓; column; compact) | `forms/` |
| **Inline validation**: fields show the problem at their JSON Pointer; the preview header counts all problems and lists them on click | `store.ts` (`useProblem`), `Preview.tsx` |
| **Preview**: the worker of phase 1, debounced 80 ms; badge "1 página ✓" / "N páginas ⚠"; compile errors shown above the last good render; timings | `preview.ts`, `Preview.tsx` |
| **Export dialog**: PDF (worker), JPG (72/150/300 dpi), Word, Typst, LaTeX, Markdown, JSON (the project file), all formats (`.zip`, with the resolved JSON); remembers the last choice | `ExportDialog.tsx` |
| **End-to-end tests**: Playwright 1.64 in the node container drives the host's Chrome over CDP (no browser download; Chrome on 127.0.0.1 with a throw-away profile); 12 tests: render, edit + autosave + reload, undo/redo, shared entry across profiles, layout, five exports, invalid import, markup injection | `scripts/e2e.sh`, `tests/e2e/` |

**Security**: the SVG from typst.ts carries a `<script>` (its own interaction code) and a
text-selection layer of HTML in `<foreignObject>` with the user's text. Both are removed before
the SVG is shown or rasterised (`apps/web/src/lib/svg.ts`): an imported project could carry
markup, and the script is not valid XML, which also broke the JPG export. The e2e test puts an
`<img onerror>` in the subtitle and checks that nothing reaches the page.

**Bugs found by the e2e tests and fixed**: a Zustand selector that returned a fresh `{}` (an
endless render loop in the layout panel); buttons whose `title` became their accessible name
("Exportar" was announced as "Ctrl+E"); the profile selector had no proper label; a stale Astro
dev lock after restarting the container (`astro dev --force`).

**Build**: `astro build` gives a static `dist/` of 30 MB (the compiler WASM is 28 MB, 7 MB with
brotli). The fonts are emitted twice (once for the worker, once for the Typst export), 0.6 MB.

## Phase 4 results (2026-10-31)

| Piece | Where |
| :--- | :--- |
| **Page geometry** in `packages/core`, with the template's rules: column boxes, a box per marked part (start to end, the width of its column, split across pages), the innermost part under a point, overflow in lines of body text | `packages/core/src/geometry.ts` |
| **Click-to-edit**: a click on the preview finds the part under it (sidebar and main column apart) and selects it: an entry opens the entry form, a section its panel, the name the personal data, skills the skill groups | `Preview.tsx`, `selection.ts` |
| **Selection highlight**: what is selected is outlined on the preview (an entry everywhere it appears) | `Preview.tsx` |
| **Page fit**: badge "N páginas ⚠ se pasa ~L líneas"; blocks that start past page 1 tinted red; ⚠ next to the sections that overflow in the navigation | `Preview.tsx`, `App.tsx` |
| **Drag-and-drop** (dnd-kit) for the sections (navigation) and the blocks of a section; the handle works from the keyboard (Space, arrows, Space; Escape cancels), and ↑ ↓ remain | `Sortable.tsx` |
| **Undo/redo** (phase 3): Ctrl+Z, Ctrl+Shift+Z / Ctrl+Y, buttons | `store.ts` |
| **Command palette** (Ctrl+K): panels, sections, entries, other profiles, export, undo/redo, one/two columns; accent-insensitive filter, arrows and Enter | `Palette.tsx` |
| **Photo crop**: on upload, a crop frame (drag to frame, zoom, 4:5, 1:1 or the 403:371 of the original layout); stored as a JPEG of at most 800 px | `PhotoCrop.tsx` |
| **Tests**: 41 unit tests (3 new on geometry), 17 end-to-end (5 new: click-to-edit and highlight in both columns, overflow badge and boxes, keyboard reordering, palette, photo crop) | `packages/cli/test/`, `tests/e2e/polish.spec.ts` |

**Fixed along the way**: a palette item could be chosen by a list appearing under a resting
pointer (`mouseenter`), so Enter ran another command (found as a flaky test; it now follows
real mouse moves only); contact addresses were hyphenated, and in Spanish the hyphen of
`lucia-romero-ejemplo` was repeated on the next line (addresses are now unhyphenated and set in
English).

## 6. New dependencies (approved 2026-10-30)

- Docker images, **pulled**: `node:24-alpine`, `nginx:alpine`.
- Python: none (the `typst`, `python-docx` and `pillow` packages were added and then removed
  when the exporters moved to TypeScript).
- Installed in phase 0 (inside the container): `astro` 7.4.0, `@myriaddreamin/typst.ts`,
  `@myriaddreamin/typst-ts-web-compiler` and `@myriaddreamin/typst-ts-renderer` 0.7.0.
- Installed in phase 1: `@myriaddreamin/typst-ts-node-compiler` 0.7.0, `vitest` 4.1.12 (dev).
  No ZIP or JSON Schema library: both are small enough to keep in `packages/core`.
- Installed in phase 2: `docx` 9.12.0.
- Installed in phase 3: `@astrojs/react` 7.1.0, `react` and `react-dom` 19.1.10, `tailwindcss`
  and `@tailwindcss/vite` 4.3.3, `zustand` 5.0.15, `zundo` 2.3.0, `@dnd-kit/core` 6.3.1,
  `@dnd-kit/sortable` 10.0.0, `@dnd-kit/utilities` 3.2.2, `@playwright/test` 1.64.1 (dev; no
  browsers downloaded, the tests use the Chrome on the host).
- Still to install, each in the phase that needs it (npm needs the workspace; Rust and
  `webkit2gtk-4.1` are system packages installed with pkexec, with Bautista at the PC):
- npm (inside the container only): `astro`, `@astrojs/react`, `@vite-pwa/astro`, `react`,
  `tailwindcss`, `@myriaddreamin/typst.ts` (+ web compiler/renderer), 
  `@myriaddreamin/typst-ts-node-compiler` (CLI), `docx`, `zustand`, `zundo`, `@dnd-kit/core`,
  `@dnd-kit/sortable`, `vitest` and `@playwright/test` (dev).
- Desktop (phase 7): Rust toolchain + `@tauri-apps/cli` (Tauri 2), `flatpak-builder`.
- Fonts: XCharter OTF from CTAN.

All of them are free and open source.

## 7. Name, repository and addresses

The product is **Foja** (from *foja de servicios*, the record of someone's career). Handle
`foja-cv` (`foja` alone is taken on GitHub).

- GitHub organisation `foja-cv`, created by Bautista from the web (the `gh` token has no
  `admin:org`). Org setup like `capital-austral`: 2FA required.
- Code in a new public repo **`foja-cv/foja`** (GPL-3.0, OSI-approved as SignPath requires),
  separate from `bafif/curriculum`, which keeps Bautista's own data and the legacy generators.
  This plan moved here in phase 0 (`docs/plan.md`).
- Web: GitHub Pages of `foja-cv/foja` → **`foja-cv.github.io/foja/`** (Astro `base: "/foja"`).
  A custom domain later serves the same site at its root, with no other change.
- npm: `foja` (CLI command `foja`). Flathub app ID: `io.github.foja_cv.Foja` (Flathub turns the
  hyphen of a GitHub name into an underscore).

## 8. Decisions log

Settled on 2026-10-30: the name Foja and the `foja-cv` organisation; exporters in TypeScript; Astro; GitHub Pages; PWA, Microsoft Store
(MSIX) and Flathub as channels; no paid service of any kind.

Also settled on 2026-10-30: Typst is the main generator and the preview; exports to LaTeX, Markdown,
JSON and Word; Word in one or two columns driven by the layout options; JSON Resume
(<https://jsonresume.org>, the open JSON schema for résumés) left for a later import/export;
the app never accesses the user's repositories, version history is an opt-in feature of the
app itself.

## Sources

- typst-py: <https://pypi.org/project/typst/>, <https://typst-py.readthedocs.io/en/latest/>
- typst.ts releases: <https://github.com/Myriad-Dreamin/typst.ts/releases>
- Typst releases: <https://github.com/typst/typst/releases>
- Typst CV templates and RenderCV: <https://typst.app/universe/package/rendercv/>,
  <https://typst.app/universe/package/brilliant-cv/>, <https://typst.pages.dev/>
- Tauri + PyInstaller sidecar signing issues:
  <https://github.com/phoson-lat/Phoson-Desktop/pull/11>,
  <https://github.com/gptme/gptme/pull/4510>, <https://github.com/ActivityWatch/activitywatch/issues/1249>
- LaTeX in the browser: <https://github.com/TeXlyre/texlyre-busytex>, <https://github.com/SwiftLaTeX/SwiftLaTeX>
- Free distribution: Microsoft Store free registration and Store signing
  <https://blogs.windows.com/windowsdeveloper/2025/05/19/microsoft-store-expands-opportunities-for-windows-app-developers/>,
  <https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/code-signing-options>;
  SignPath Foundation <https://github.com/SignPath/github-actions-demo>;
  Homebrew and Gatekeeper <https://brew.sh/2025/11/12/homebrew-5.0.0/>,
  <https://github.com/Homebrew/brew/issues/20755>
- docx (npm) 9.9.0: <https://github.com/dolanmiu/docx/releases/tag/9.9.0>,
  <https://github.com/dolanmiu/docx/blob/master/docs/usage/tables.md>
- typst.ts Node compiler: <https://www.npmjs.com/package/@myriaddreamin/typst-ts-node-compiler>
- Flathub requirements: <https://docs.flathub.org/docs/for-app-authors/requirements>,
  Tauri on Flathub: <https://v2.tauri.app/distribute/flatpak/>
- Reactive Resume: <https://github.com/amruthpillai/reactive-resume>
- python-docx: <https://skelmis-docx.readthedocs.io/>
- Table-layout résumés and parsers: <https://github.com/geektechlive/blastjob/issues/33>
