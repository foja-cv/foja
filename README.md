# Foja

A no-code CV editor built on [Typst](https://typst.app): forms instead of code, a live preview
that is the real Typst output, and exports to Typst, PDF, JPG, LaTeX, Markdown, JSON and Word.
Everything runs in the browser; CV data never leaves the user's machine.

Status: early. Phase 0 (the spike) is done; the plan and its results are in
[`docs/plan.md`](docs/plan.md).

## Development

Node dependencies live only inside the container.

```sh
scripts/fonts.sh          # copy XCharter and LM Mono from a local TeX tree (not committed yet)
docker compose up         # Astro dev server with hot reload behind nginx
```

Open <http://127.0.0.1:8090/>. `node scripts/bench.mjs` measures the compile time per change in
headless Chrome.

## Licence

GPL-3.0. See [LICENSE](LICENSE).
