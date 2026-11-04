# Foja roadmap

Foja is a no-code CV editor built on [Typst](https://typst.app). You fill in forms instead of
writing code, the preview next to them is the real Typst output, and the CV exports to PDF, JPG,
Word, Typst, LaTeX, Markdown and JSON. Everything runs in the browser: there are no accounts and
no server, and the CV never leaves your machine.

This document is where I keep what Foja is meant to be, what is already built, what comes next
and the reasons behind the main decisions. How to use the editor is in the
[user guide](guide.md).

## Why I am building it

My own CV was a set of JSON files turned into a PDF by a Python generator through LaTeX (it still
lives in [`cvgen/`](../cvgen/README.md), next to a second generator in C). It worked, but every change meant editing files by hand and waiting
for a LaTeX compile, and nobody else could use it. I wanted the same idea, one bank of entries
and one CV per kind of job, with a real interface on top and Typst underneath.

Typst already has an official online editor (typst.app), but there you write code. The closest
products are RenderCV (YAML to Typst, as a CLI and a web app) and the CV templates on Typst
Universe, which are also edited as code. I did not find a form-based CV builder on Typst, so
that is the gap Foja aims at: forms, a live preview and many exports, not another code editor.

One product, three ways to run it, all from the same release:

1. **A web app** that anyone can open and install, and that keeps growing over time.
2. **A desktop app** installed like any other app on Linux, macOS and Windows.
3. **A command line** (`foja`), which replaces the old generator of my CV.

## Design principles

- **The Typst template is the generator.** The styles read the project JSON and lay out the CV
  themselves, so the browser, the desktop app and the CLI run exactly the same `.typ` files.
  Nothing generates Typst source on the side.
- **Local first, no server.** The web build is the product: Typst compiles to WebAssembly in a
  worker, projects live in IndexedDB, and the desktop app wraps the same build. A static site
  has no server to pay for and nothing to attack, and the CV data stays with its owner.
- **Zero cost, always.** The project never pays for anything: no code-signing certificates, no
  Apple developer account, no paid hosting, no paid domain. Every choice is the best free one.
- **One self-contained project document.** A single JSON file (format `foja/2`) holds the
  person, contacts, skill groups, the shared bank of entries, the profiles, custom styles and the
  photo. A JSON Schema is the contract for the template, the exporters, the editor and the CLI.
- **Two levels, kept explicit.** The bank holds every entry once; a profile chooses which entries
  go where. Editing an entry warns where else it is used, and removing it from a profile never
  deletes it.
- **Layout is data.** Columns, sidebar side and width, photo shape, font, size, accent colour,
  margins, density, page size, date format and label language are options per profile, read by
  the Typst styles and by the Word exporter alike.
- **Typed blocks.** Sections hold blocks (an entry from the bank, an item, a paragraph) and the
  styles render them by type, which leaves room for new kinds of blocks later.
- **One-page discipline.** The preview always says whether the CV fits on one page and, if not,
  which parts spill over.
- **Untrusted input is expected.** A project or a style may come from someone else, so the
  preview strips scripts, embedded HTML and links from the SVG, the CLI compiles in an empty
  temporary root, and every exporter escapes what it writes. Details in the
  [security model](security.md).
- **No access to version control.** Neither the app nor its exports touch anyone's repositories.

## Decisions

### How it is delivered

I compared three options: a local web app in a container, a native Tauri app with a Python sidecar,
and a web core that does all the rendering in the browser, wrapped by Tauri for the desktop.

The third one won on every count that mattered. A container runtime is a poor install for people
who are not developers, especially on macOS and Windows. A frozen Python sidecar makes the installers large
and signing painful (the sidecar has to be signed on its own, and the macOS hardened runtime
breaks PyInstaller without extra work). The in-browser core gives a public web app with static
hosting and no server, small installers that use the system webview, and a preview with no
network round trip. The only thing it cannot do is compile LaTeX in the app (the WebAssembly
TeX distributions download about 120 MB), so LaTeX is exported as source instead.

Containers (rootless Podman) stay for development only, with hot reload behind nginx.

### Free distribution channels

- **Web**: a static site on GitHub Pages, installable as a PWA from Chrome, Edge or Safari. It
  shows up in the system's app menu, works offline, updates itself and needs no signing.
- **Windows**: the Microsoft Store. Individual registration is free and the Store signs MSIX
  packages, so the PWA packaged with PWABuilder avoids SmartScreen warnings at no cost.
- **Linux**: Flathub. It does not accept thin web wrappers, so the Linux app is a Tauri shell
  with real desktop integration: projects opened and saved through the file-chooser portal, its
  own file type, bundled assets and a build from source. Also AUR and plain packages on GitHub
  Releases.
- **macOS**: there is no free notarisation, and Homebrew's main cask repository now refuses apps
  that fail Gatekeeper, so the PWA is the main way there. An ad-hoc-signed build can still be
  offered on GitHub Releases with instructions.
- **Signed Windows installers outside the Store**: SignPath Foundation signs open-source
  projects for free once they have some reputation.
- **CLI**: npm.

### Exporters in TypeScript

I first considered keeping the Python exporters and running them in the browser through Pyodide.
TypeScript was better on quality and on speed: the `docx` library has native support for table
shading, merged cells, section columns and floating images (with `python-docx` those need raw
OOXML), and there is a single schema and a single set of types shared by the forms, the
validation, the exporters and the CLI. Pyodide would also have added seconds of start-up on the
first export and a bridge between two runtimes.

### Astro instead of Next.js

The editor is entirely client-side, and the public pages should load fast. Next.js's strengths
(server rendering, server actions, image optimisation) are unusable in a static export, and its
WebAssembly-in-workers setup needs bundler configuration. Astro outputs static pages by default,
is built on Vite (which handles WebAssembly and module workers natively), ships no JavaScript on
the landing page, and has an official GitHub Pages action. The editor is a React island inside
it, with Tailwind, Zustand (plus `zundo` for undo) and dnd-kit.

### A look of its own

The first template reproduced the look of my LaTeX CV, which is based on the Wenneker template
(CC BY-NC-SA). Before publishing I replaced it, and the LaTeX and Word exports with it, with
three styles of Foja's own: **Legajo** (the default: XCharter, small caps, a tinted sidebar,
dates in a column of their own), **Banda** (a band of colour across the top, Noto Sans) and
**Minimal** (black on white, hierarchy from size and weight only). The interface got the same
treatment: three themes, Papel y tinta, Neutro and Vivo, each light and dark.

## What is built

The work so far, in the order it happened:

- **A spike** (October 30, 2026) to check that live preview without a server is viable: a Typst
  template reading the CV as JSON, compiled by typst.ts in a Web Worker on a bare Astro page. On
  a modest four-core CPU a one-character change takes about 50 ms of Typst and 4 ms of SVG
  rendering, so the preview can follow every keystroke. The compiler is 28 MB of WebAssembly (7
  MB with brotli), which means the first visit needs a loading state and the service worker has
  to precache it.
- **The project format and the CLI.** The `foja/2` format with its JSON Schema and a small
  validator (no extra dependency) that also checks references the schema cannot express;
  layout options; a converter from the old multi-file layout of my CV; and the `foja` command,
  which builds PDF, SVG and a Typst bundle that compiles on its own with plain `typst compile`.
- **The exporters.** All of them start from one resolved profile (entries looked up, dates
  formatted, labels applied): LaTeX as a self-contained `cv.tex` written for Foja, Markdown,
  JSON (the project file and the resolved profile), Word with one or two columns, JPG from the
  browser, and a `.zip` with everything.
- **The editor.** Panels for the personal data, contacts, skill groups and the bank of entries;
  profiles with their sections and layout; inline validation tied to each field; autosave to
  IndexedDB; undo and redo; the live preview with the page-fit badge; and the export dialog.
- **Polish.** Click on the preview to edit what is under the pointer, the selection outlined on
  the preview, the parts that overflow page one tinted, drag-and-drop for sections and blocks
  (with a keyboard alternative), a command palette, and photo cropping.
- **Offline and installable.** A service worker written without a framework (the PWA plugin did
  not support the Astro version), a manifest, the landing page, builds under the `/foja/` base
  path, and the GitHub workflows (tests and build on every push; the Pages deployment runs only
  by hand until I publish).
- **Styles and themes of its own.** The three styles above, a shared Typst library for writing
  more, "Edit in Typst" to copy any style into one of your own, a style editor with errors shown
  above the preview, and interface themes that can be extended with a small, validated theme
  file or from a script.
- **Interface details.** Every text/background pair meets WCAG AA contrast in all themes, style
  cards show the current profile in each style, a phone layout with one pane at a time, and the
  interface in Spanish and English.
- **A review before release.** I had the whole code base reviewed from scratch and fixed what
  came up: a style could read local files through the CLI and could put `javascript:` links in
  the preview; LaTeX could be injected through contact URLs; starting a new project replaced the
  previous one for good, and two tabs overwrote each other's autosave; a slow style could freeze
  the preview; the service worker could break open tabs on update; and several accessibility
  gaps. My three real profiles now fit on one page in Legajo, and the preview replaces only the
  pages that changed, so long CVs no longer block typing.

## What comes next

In this order:

1. **Publish the site** on GitHub Pages at `foja-cv.github.io/foja/`: switch the Pages source to
   GitHub Actions and run the deployment workflow (or let it run on every push to `main`). Then
   promote it.
2. **Publish the CLI on npm** as `foja` (the name was still free at the end of October 2026). The
   package already bundles itself on `npm pack`; it needs an npm account and
   `npm publish -w packages/cli`.
3. **Microsoft Store**: open a free individual Partner Center account, then package the
   published PWA as MSIX with PWABuilder.
4. **Desktop app and Flathub**: the Tauri 2 shell with native file access, a Flatpak built from
   source, and the Flathub submission. Also AUR and unsigned builds for macOS and Windows on
   GitHub Releases, and SignPath Foundation for Windows once the project qualifies.

Smaller things that can go in at any point:

- Open the Word export in Word and LibreOffice. So far the files are only checked as valid
  packages, because neither program is installed on my machine.
- An "Open in Overleaf" button. Overleaf takes the files in a POST to `overleaf.com/docs`, which
  sends the CV to a third party, so it has to be an explicit action and tested against the live
  service.
- Import and export of [JSON Resume](https://jsonresume.org), the open schema for résumés.
- **Versions**, off by default: snapshots on save and named versions ("sent to Acme") with a
  preview, a diff of fields and restore, stored with the project. A history inside the app, not
  a link to any version control system.

Known limitations: the LaTeX export breaks lines a little differently from Typst and can run a
few lines past one page where the PDF fits (the user guide says so).

### Long term

A general, graphical, live Typst editor built around freedom: you collect blocks (text, lists,
entries, images, shapes), arrange them on the page, and the template turns them into Typst. The
CV is the first product on top of that idea. The typed blocks of the data model keep the door
open without building it now; until then everything stays focused on CVs.

## Name and addresses

The name comes from *foja de servicios*, the record of someone's career. `foja` alone is taken
on GitHub, so the handle is `foja-cv`.

- Code: [`foja-cv/foja`](https://github.com/foja-cv/foja), public, GPL-3.0 (an OSI licence, as
  SignPath requires). My own CV data and the first generators live in `cvgen/`.
- Web: `foja-cv.github.io/foja/`. A custom domain can later serve the same site at its root with
  no other change.
- npm: `foja`. Flathub app ID: `io.github.foja_cv.Foja` (Flathub turns the hyphen of a GitHub
  name into an underscore).

## Dependencies

All free and open source, and all Node packages installed only inside the development container:
Astro, React, Tailwind, Zustand and `zundo`, dnd-kit, typst.ts (web compiler, renderer and the
Node compiler for the CLI), `docx`, and Vitest and Playwright for the tests. There is no ZIP or
JSON Schema library: both are small enough to keep in `packages/core`. The bundled fonts are
XCharter, Latin Modern Mono and Noto Sans, each with its licence next to it. The desktop app will
add the Rust toolchain, Tauri 2 and `flatpak-builder`.

## Sources

- typst.ts releases: <https://github.com/Myriad-Dreamin/typst.ts/releases>
- Typst releases: <https://github.com/typst/typst/releases>
- Typst CV templates and RenderCV: <https://typst.app/universe/package/rendercv/>,
  <https://typst.app/universe/package/brilliant-cv/>
- Tauri with a PyInstaller sidecar, signing issues:
  <https://github.com/phoson-lat/Phoson-Desktop/pull/11>,
  <https://github.com/ActivityWatch/activitywatch/issues/1249>
- LaTeX in the browser: <https://github.com/TeXlyre/texlyre-busytex>,
  <https://github.com/SwiftLaTeX/SwiftLaTeX>
- Free distribution: Microsoft Store registration and signing
  <https://blogs.windows.com/windowsdeveloper/2025/05/19/microsoft-store-expands-opportunities-for-windows-app-developers/>,
  <https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/code-signing-options>;
  SignPath Foundation <https://github.com/SignPath/github-actions-demo>;
  Homebrew and Gatekeeper <https://brew.sh/2025/11/12/homebrew-5.0.0/>,
  <https://github.com/Homebrew/brew/issues/20755>
- docx (npm): <https://github.com/dolanmiu/docx/blob/master/docs/usage/tables.md>
- typst.ts Node compiler: <https://www.npmjs.com/package/@myriaddreamin/typst-ts-node-compiler>
- Flathub requirements: <https://docs.flathub.org/docs/for-app-authors/requirements>;
  Tauri on Flathub: <https://v2.tauri.app/distribute/flatpak/>
- Reactive Resume: <https://github.com/amruthpillai/reactive-resume>
