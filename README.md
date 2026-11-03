# Foja

A no-code CV editor built on [Typst](https://typst.app): forms instead of code, a live preview
that is the real Typst output, and exports to Typst, PDF, JPG, LaTeX, Markdown, JSON and Word.
Everything runs in the browser; your CV never leaves your machine.

- **Profiles from one bank of entries**: one CV per kind of job, the entries written once.
- **Three styles of its own** (Legajo, Banda, Minimal) with layout options, and **styles you
  write in Typst** ("Edit in Typst" copies any style into one of your own).
- **One-page discipline**: the preview says whether the CV fits and what spills over; click a
  part of the preview to edit it.
- **Exports**: PDF, JPG, Word, Typst, LaTeX, Markdown, JSON.
- **Private and offline**: no accounts, no server; installable as an app; Spanish and English.

User guide: [`docs/guide.md`](docs/guide.md). Writing a style: [`docs/templates.md`](docs/templates.md).
Interface themes: [`docs/themes.md`](docs/themes.md). Security model: [`docs/security.md`](docs/security.md).
Command line: [`packages/cli/README.md`](packages/cli/README.md).

Status: the editor, the exporters and the CLI work; the site is not published yet. What is
built, what comes next and why: [`docs/ROADMAP.md`](docs/ROADMAP.md).

## Layout

```
packages/core      project format (JSON Schema + types), validation, shared helpers
packages/template  the Typst styles (Legajo, Banda, Minimal), their library, labels and fonts
packages/cli       `foja` on Node: build PDF/SVG/Typst bundles from a project
apps/web           the Astro site and editor
examples/          fictional example projects (Spanish, English) and a test fixture (fake phone)
```


## Development

Node dependencies live only inside rootless Podman containers, and the repository is mounted read-only there:
nothing that runs in a container can change the sources or `.git`. Dependencies, caches and output live in volumes.

```sh
mkdir -p node_modules apps/web/node_modules apps/web/.astro apps/web/dist .out   # once: their mount points
podman compose up                                   # Astro dev server with hot reload behind nginx
podman compose run --rm web npm test                # tests
podman compose run --rm web npm run foja -- build examples/curriculum.project.json --out .out
podman volume export foja_out | tar -x -C .out      # copies what the CLI wrote to .out/
```

`scripts/e2e-pwa.sh` builds the site as GitHub Pages serves it (under `/foja/`) and checks it,
offline use included. `scripts/e2e.sh` runs the end-to-end tests against the running dev stack, with Playwright and a
headless Chromium in a container that shares the stack's network; nothing on the host is reachable from it.

## Licence

GPL-3.0. See [LICENSE](LICENSE).
