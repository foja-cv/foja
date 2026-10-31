# Foja

A no-code CV editor built on [Typst](https://typst.app): forms instead of code, a live preview
that is the real Typst output, and exports to Typst, PDF, JPG, LaTeX, Markdown, JSON and Word.
Everything runs in the browser; CV data never leaves the user's machine.

Status: early. The plan and the results of each phase are in [`docs/plan.md`](docs/plan.md).

## Layout

```
packages/core      project format (JSON Schema + types), validation, shared helpers
packages/template  the Typst template, its labels and fonts (with their licences)
packages/cli       `foja` on Node: build PDF/SVG/Typst bundles from a project
apps/web           the Astro site and editor
examples/          a project with three profiles (fake phone, placeholder photo)
```

## Development

Node dependencies live only inside the container.

```sh
docker compose up                                   # Astro dev server with hot reload behind nginx
docker compose run --rm web npm test                # tests
docker compose run --rm web npm run foja -- build examples/curriculum.project.json --out .out
```

`scripts/e2e.sh` runs the end-to-end tests (Playwright in the container, driving the Chrome
installed on the host) against the running dev stack.

Open <http://127.0.0.1:8090/editor>. `node scripts/bench.mjs` measures the compile time per change in
headless Chrome (`/spike?bench=N`).

## Licence

GPL-3.0. See [LICENSE](LICENSE).
