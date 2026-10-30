# Foja: a CV editor on Typst — research and plan

Status: **proposal, direction agreed, details open** (2026-10-30). Nothing here is built yet.

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

## 1. What exists today

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

0. **Spike** (small): Typst template that reads JSON and reproduces one profile; typst.ts in a
   worker rendering it in a bare Astro page; measure compile time per keystroke.
1. **Typst template + schema + project format v2** (and the `data/` converter); Node CLI
   `foja --formato pdf|typ`; tests on every profile.
2. **Exporters** in `packages/core`: LaTeX (port of `latex.py`), Markdown, JSON, Word, JPG;
   `.zip` bundles; tests.
3. **Web app core**: editor, profiles, live preview, export dialog, IndexedDB; dev in Docker
   Compose with nginx and hot reload.
4. **Polish**: drag-and-drop, undo/redo, click-to-edit, page-fit highlighting, palette,
   photo crop, Playwright tests.
5. **PWA + public web**: manifest, service worker, offline; GitHub Pages at `foja-cv.github.io/foja/`;
   landing page and promotion (after Bautista's OK).
6. **Microsoft Store**: the PWA packaged as MSIX with PWABuilder, free individual account
   (Bautista registers it: Microsoft account, ID and selfie).
7. **Tauri shell + Flathub**: native file access and desktop integration, Flatpak built from
   source; also AUR, unsigned builds for macOS/Windows on GitHub Releases, and SignPath
   Foundation for Windows once the project qualifies. CLI on npm.

## 6. New dependencies (approved 2026-10-30)

- Docker images, **pulled**: `node:24-alpine`, `nginx:alpine`.
- Python: none (the `typst`, `python-docx` and `pillow` packages were added and then removed
  when the exporters moved to TypeScript).
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
  This plan moves there in phase 0.
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
