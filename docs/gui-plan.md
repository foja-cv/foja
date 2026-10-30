# GUI for the CV generator — research and plan

Status: **proposal, waiting for approval** (2026-10-30). Nothing here is built yet.

Goal: a graphical editor for the data in `data/` with the best UX possible, a live preview, and
export to JSON, LaTeX, Typst, PDF, JPG and Word (`.docx`).

## 1. What exists today

- `data/cv.json` (personal data, contacts, skill groups, every entry by id), `data/perfiles/*.json`
  (one CV per profile: which sections/entries, order, `compacto`, `lateral`), `data/textos/*.md`
  (profile texts, task lists, strengths), `data/img/foto.jpg`.
- `data/privado.json` (git-ignored): the address. Only profiles with `"domicilio": true` show it;
  today that is only `docente-cine-debate`, because the posting asks for it.
- `python/` (`cvgen`): layered — `sources` → `model` → `build` → `latex` → `compile` (tectonic).
- `c/` (`cvgen-c`): dependency-free C17, writes the PDF directly with Helvetica.

Measured on BAFLIN (`programador` profile):

| Step | Time |
| :--- | ---: |
| `cvgen` (LaTeX + tectonic, warm cache) | ~1.9 s |
| `cvgen-c` | < 10 ms |
| `pdftoppm -jpeg -r 150`, one page | ~60 ms |

tectonic is too slow to recompile on every keystroke; it can only be an on-demand preview.

Installed on the host: tectonic 0.17, poppler (`pdftoppm`), ImageMagick, Docker, node 24.
Not installed: typst, pandoc, LibreOffice.

## 2. Research findings

### Typst
- **Python binding `typst`** (PyPI, typst-py, Apache-2.0, prebuilt abi3 wheels): compiles to PDF,
  PNG (with `ppi`) and SVG, returns bytes when no `output` is given, takes the sources as a
  `{filename: bytes}` dict (no temp files), and `typst.Compiler()` keeps the world (fonts) loaded
  between compilations. Also `typst.query(...)` to read `metadata` back out of a document.
  Tracks upstream Typst 0.14/0.15. Docs: <https://typst-py.readthedocs.io/>.
- **In the browser** (`typst.ts`, Myriad-Dreamin): stable 0.7.0 targets Typst 0.14.2; 0.8.0 is
  still in release candidates (Typst 0.15). Using it would mean generating the `.typ` source in
  TypeScript too (duplicating the Python generator) or shipping it from the server anyway, so it
  buys little here. **Not chosen**; server-side compile with typst-py is a single source of truth.
- Upstream Typst: 0.15.1 (2026-07-17).
- Fonts: the LaTeX output uses XCharter. Typst only bundles Libertinus, New Computer Modern and
  DejaVu Sans Mono, so the XCharter OTF files (CTAN `xcharter`, free Bitstream licence — verify
  before bundling) go in the repo and are passed with `font_paths`, so both engines look alike.
- Click-to-edit from the preview is feasible without IDE APIs: the template emits
  `context metadata((id: ..., pos: here().position()))` next to each entry and section, the
  backend reads them with `typst.query`, and the frontend overlays clickable hotspots on the SVG.
  The same trick gives the page-fit indicator (where the main column ends, how many pages).

### Word (`.docx`)
- `python-docx` (backend) and `docx` (npm) can both build the usual CV layout: a borderless
  two-column table with a shaded narrow sidebar (photo, contacts, skills) and the main column.
- Caveat: some ATS parsers read only paragraphs and skip table content. Mitigation: keep the
  table to the two columns and use real headings/paragraphs inside the cells; offer a
  "single column (ATS)" variant of the Word export.
- Word cannot be pixel-identical to Typst/LaTeX (fonts are not embedded, Word reflows). The goal
  is a clean, editable document with the same content and order. A Word preview would need
  LibreOffice to render it; not planned.
- **Chosen:** `python-docx`, so every generator lives in the same Python package.

### JPG
- Rasterise the PDF of the chosen engine with `pdftoppm -jpeg -r <dpi>` (poppler; ~60 ms per
  page), so the JPG always matches the PDF. One JPG per page; several pages go in a `.zip`.
  Typst can also emit PNG directly (`format="png"`), which avoids poppler for the Typst engine.

### UX patterns in existing open-source CV builders
Looked at Reactive Resume (v5/v6), Resume Stack, OpenResume and RenderCV for patterns, not to
copy any of them:
- Split view: editor on the left, live preview on the right, preview never blanks while
  recompiling (keep the last good render, show a small "compiling" state).
- Drag-and-drop ordering of sections and of entries inside a section (dnd-kit is the usual
  choice in React).
- Click on the preview to jump to the field; inline validation; structured dates.
- Autosave plus undo/redo (Reactive Resume keeps up to 200 steps) and recovery of drafts.
- Live controls for page size, spacing and font (later, not in the first version).
- JSON export/import as the portable format; JSON Resume is the common interchange schema.

## 3. Proposed architecture

A **local web app** (only on `127.0.0.1`, nothing exposed), in the repo, following the usual stack:

```
curriculum/
├── python/            cvgen: + typst.py, docx.py, raster.py, export.py (new layers)
├── api/               cvgen-api: FastAPI over cvgen (new uv workspace member)
├── web/               Next.js App Router + TypeScript + Tailwind, Zustand + TanStack Query
├── fonts/             XCharter OTF for Typst
├── nginx/             reverse proxy: / → web, /api → api
└── compose.yaml       api (uvicorn --reload), web (next dev), nginx; bound to 127.0.0.1
```

- **Data stays in `data/`** (the repo, versioned with git). The API reads and writes those files
  in place; there is no database. The UI shows "unsaved" and "uncommitted" states.
- **Single source of truth for rendering:** every format comes out of `cvgen`. The CLI gains
  `--formato {pdf,tex,typ,json,jpg,docx}` and `--motor {typst,latex,c}` for PDF/JPG.
- **Preview engine:** Typst by default (compile in tens of ms with a warm `typst.Compiler`, sent
  as SVG per page: sharp at any zoom and light). C is also instant and can be live. LaTeX is
  on demand ("Update" button, ~2 s), since its line breaking differs from the other two. Each
  engine has its own page-fit badge because they fill pages differently.
- **Draft vs. saved:** the frontend keeps the edited document in a Zustand store (with `zundo`
  for undo/redo); preview requests send the draft (`POST /api/preview`, debounced ~200 ms, the
  previous request aborted); saving writes the files.
- **Types:** Pydantic models in the API → OpenAPI → TypeScript types with `openapi-typescript`,
  so the frontend and backend share one schema.
- Docker images: `python:3.13-slim` + uv + tectonic + poppler-utils (tectonic package cache in a
  volume), `node:24-alpine` (all npm installs inside the container), `nginx:alpine`.

### API sketch

| Method | Path | Does |
| :--- | :--- | :--- |
| GET | `/api/data` | `cv.json`, every profile and text, resolved into one document |
| PUT | `/api/data` | validate and write back to `data/` (atomic writes) |
| POST | `/api/preview?motor=typst` | draft + profile → SVG pages, anchors, page count, warnings |
| POST | `/api/export?formato=…&motor=…` | draft + profile → file (or `.zip` for multi-file) |
| POST | `/api/foto` | upload/crop the photo |
| GET | `/api/git` | dirty files, last commit (read-only; committing stays manual) |

### Export details

| Format | Content |
| :--- | :--- |
| JSON | the profile fully resolved (texts inlined) — self-contained; optional JSON Resume variant |
| LaTeX | `.zip` with `cv.tex`, `structure.tex` and the photo (compiles as is, Overleaf-ready) |
| Typst | `.zip` with `cv.typ`, the photo (and fonts note) |
| PDF | engine selectable: Typst (default), LaTeX, C |
| JPG | per page from the chosen engine's PDF, dpi selectable (150/300) |
| Word | `.docx`, two-column table layout; optional single-column ATS variant |
| All | one `.zip` with every format for the profile |

## 4. UX design

Layout (desktop first, resizable split, light/dark):

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ CV ▸ [programador ▾]  [+ perfil] [duplicar]     ● sin guardar   ↶ ↷   [Exportar ▾]│
├──────────────┬────────────────────────────┬──────────────────────────────────────┤
│ Datos        │  Editor of the selection   │  Preview  [Typst|C|LaTeX]  1/1 pág ✓  │
│  Personales  │                            │  ┌──────────────────────────┐         │
│  Contactos   │  Obrok — Desarrollador…    │  │                          │ zoom    │
│  Habilidades │  Lugar   [Obrok        ]   │  │   (SVG pages, hotspots   │ fit     │
│ Perfil       │  Desde   [05/2026] Hasta…  │  │    clickable → editor)   │         │
│  Texto       │  Nota    [...          ]   │  │                          │         │
│  Secciones ≡ │  Tareas  ≡ item  ≡ item  + │  └──────────────────────────┘         │
│   Experiencia│                            │  ⚠ main column overflows by 4 lines   │
│   Educación  │                            │                                      │
└──────────────┴────────────────────────────┴──────────────────────────────────────┘
```

- **Two levels, made explicit:** the *data bank* (all entries, shared by every profile) and the
  *profile* (which entries, in which section, order, compact, sidebar). Editing an entry warns
  "used in 3 profiles". Toggling an entry for a profile is a checkbox, not a delete.
- **Address:** per-profile checkbox «Mostrar domicilio», **unchecked by default** (new profiles
  included). The address is edited and saved only in `data/privado.json`, never in `cv.json` or
  anything else under git, and never sent to GitHub.
- Sections and entries reorder by drag-and-drop (with keyboard alternative); per section toggles
  for `compacto` and `lateral`.
- Tasks/strengths edited as a list of items (optional heading + paragraph), serialised back to
  the existing Markdown subset, so the files stay hand-editable.
- Month pickers for dates, "ongoing" switch for `hasta: null`; inline validation messages next to
  the field (the same rules as `DataError`).
- **One-page discipline:** permanent badge "1 page ✓ / overflows by N lines" per engine, and the
  overflowing entries highlighted in the preview.
- Click on the preview → selects the field in the editor; selecting a field → scrolls and
  highlights it in the preview.
- Autosave of the draft in the browser (recovery after a crash); explicit "Save" writes `data/`
  (Ctrl+S). Undo/redo (Ctrl+Z / Ctrl+Shift+Z). Command palette (Ctrl+K) for profiles and exports.
- Export dialog: format, engine, dpi, and "all formats (.zip)"; remembers the last choice.
- Interface in Spanish; code, docs and commits in English.
- Accessibility: keyboard reachable, visible focus, contrast checked in both themes.

## 5. Phases

Each phase is meant for its own session, with its own commit(s) on `main`.

1. **Typst generator** (`cvgen.typst` + template + XCharter fonts): same layout as LaTeX,
   tests that build every profile and compare page counts; `--formato typ` and `--motor typst`.
2. **Remaining exports**: JSON (resolved), Word (`python-docx`), JPG (poppler / Typst PNG),
   multi-file `.zip`s; CLI flags; tests.
3. **API + Docker Compose + nginx** skeleton: read/write `data/`, preview, export; bound to
   localhost; hot reload in both containers.
4. **Frontend core**: layout, profile switcher, data bank, profile editor, live preview,
   export dialog.
5. **Polish**: drag-and-drop, undo/redo, click-to-edit hotspots, page-fit highlighting, command
   palette, photo crop, Playwright end-to-end tests.

## 6. New dependencies (need approval before installing)

- Python (PyPI): `typst`, `python-docx`, `fastapi`, `uvicorn`, `pydantic`, `python-multipart`.
- npm (inside the container only): `next`, `react`, `tailwindcss`, `zustand`, `zundo`,
  `@tanstack/react-query`, `@dnd-kit/core`, `@dnd-kit/sortable`, `openapi-typescript`,
  `@playwright/test` (dev).
- Docker images: `python:3.13-slim`, `node:24-alpine`, `nginx:alpine`.
- Fonts: XCharter OTF from CTAN.

## 7. Open decisions

1. Local web app in Docker (recommended, matches the usual stack) vs. a desktop app (Tauri).
2. JSON export: the repo's own resolved format only, or also JSON Resume.
3. Word: two-column layout only, or also a single-column ATS variant.
4. Whether the GUI should also commit (`git commit` button) or leave git to the terminal
   (recommended: read-only git status).

## Sources

- typst-py: <https://pypi.org/project/typst/>, <https://typst-py.readthedocs.io/en/latest/>
- typst.ts releases: <https://github.com/Myriad-Dreamin/typst.ts/releases>
- Typst releases: <https://github.com/typst/typst/releases>
- Reactive Resume: <https://github.com/amruthpillai/reactive-resume>,
  <https://hub.docker.com/r/amruthpillai/reactive-resume>
- Resume Stack: <https://github.com/arunike/Resume-Stack>
- python-docx docs: <https://skelmis-docx.readthedocs.io/>
- Table-layout résumés and parsers: <https://github.com/geektechlive/blastjob/issues/33>
