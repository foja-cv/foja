# foja

The command line of [Foja](https://github.com/foja-cv/foja), a CV editor on Typst: builds CVs
from a Foja project (`.foja.json`, made in the editor or by hand) with the same Typst styles the
web editor uses.

```sh
npx foja build my.foja.json                       # a PDF per profile
npx foja build my.foja.json --profile dev --format pdf --format docx --out out
npx foja build my.foja.json --format all          # every format in one .zip
npx foja validate my.foja.json
```

Formats: `pdf`, `svg`, `typ` (a `.zip` that compiles with plain `typst compile`), `tex`
(LaTeX), `md`, `json`, `docx` (Word), `all`. Needs Node 24 or later.

The project format is described by its JSON Schema
([`project.schema.json`](https://github.com/foja-cv/foja/blob/main/packages/core/schema/project.schema.json));
styles of your own, written in Typst, are explained in
[`docs/templates.md`](https://github.com/foja-cv/foja/blob/main/docs/templates.md).

Licence: GPL-3.0. The bundled fonts keep their own licences (files next to them in
`dist/template/fonts`).
