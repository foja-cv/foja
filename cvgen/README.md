# cvgen
Foja started here, as the generator I wrote for my own CV, and I still build my CVs with it.
I keep my CV as data, in `data/`, and build it with two generators. They work independently,
read the same files and produce the same layout:

- **`python/`** (`cvgen`): builds LaTeX on the Wenneker template and compiles it with
  [tectonic](https://tectonic-typesetting.github.io/). Typeset with XCharter.
- **`c/`** (`cvgen-c`): writes the PDF directly in C17, with no dependencies beyond libc.
  Typeset with the PDF base fonts (Helvetica), which are a bit wider, so it fills pages sooner.

Each CV is a *profile*: a small JSON file that picks which sections and entries to show, so from
one set of data I get a CV for each kind of job I apply to. The data is my real CV, except for
my address, phone and email, which stay out of the repository (see [`privado.json`](#privadojson)).

## Requirements
- Python generator: [uv](https://docs.astral.sh/uv/) and tectonic (`pacman -S tectonic`).
  tectonic downloads the LaTeX packages it needs on the first run.
- C generator: a C17 compiler and `make`.

## Usage
From `cvgen/`:

```sh
make python PERFIL=docente-ia   # build/cv-docente-ia.pdf
make c PERFIL=docente-ia        # build/cv-docente-ia-c.pdf
make test                       # pytest + C tests
make lint                       # ruff check + format check
```

The generators can also be called directly:

```sh
uv run cvgen --perfil docente-ia [--datos data] [--privado privado.json] [--salida out.pdf] [--tex]
c/build/cvgen-c -p docente-ia [-d data] [-P privado.json] [-o out.pdf]
```

`--tex` writes the LaTeX source instead of compiling it. Both print the output path on success
and exit with status 1 and a message on stderr when the data is invalid.

## Data
```
data/
├── cv.json          personal data, contacts, skill groups and every entry, keyed by id
├── privado.json     address, phone and email; ignored by git, see privado.ejemplo.json
├── img/foto.jpg     photo for the sidebar
├── perfiles/*.json  one file per CV
└── textos/*.md      prose: profile texts, task lists, strengths
```

### `cv.json`
- `nombres`, `apellidos`, `foto` (path relative to `data/`).
- `contactos`: the public ones, `github`, `linkedin` and `web`. The phone and email go in
  `privado.json`.
- `habilidades`: groups of skills for the sidebar, e.g. `{"Idiomas": ["Español (nativo)", …]}`.
- `entradas`: every experience, education or project entry, keyed by id:

```json
"docencia": {
    "titulo": "Docente particular",
    "lugar": "Independiente",
    "desde": "2018-07",
    "hasta": null,
    "tareas": "textos/tareas_docencia.md",
    "nota": "optional line shown under the title"
}
```

Dates are `YYYY-MM`. An entry with only `desde` is a single date; `"hasta": null` means ongoing.
`tareas` points to a Markdown file with the details; `nota` is a short line that is shown even
in compact sections.

### `privado.json`
My address, phone and email are not in the repository. They go in `data/privado.json`, which
git ignores; to start one, copy `privado.ejemplo.json`, which has made-up values:

- `contactos`: `telefono` and `correo`. They are added to the ones in `cv.json`, and a profile
  shows them by listing them in its `contactos`, like any other.
- `domicilio`: `calle`, `ciudad`, `provincia`, `pais`. Only profiles with `"domicilio": true`
  show it; without that key the CV has no address.

The file is optional, but a profile that shows any of these fails if it is missing. The tests
always use `privado.ejemplo.json`, never the real file.

### Profiles
`data/perfiles/<perfil>.json` describes one CV:

```json
{
    "subtitulo": "Docente de Inteligencia Artificial",
    "perfil": "textos/perfil_docente_ia.md",
    "postulacion": "optional; shown as a «Curso» block in the sidebar",
    "domicilio": false,
    "contactos": ["telefono", "correo", "linkedin"],
    "habilidades": [["Web", "Programación"], "Idiomas"],
    "secciones": [
        {"titulo": "Experiencia docente", "entradas": ["docencia"]},
        {"titulo": "Fortalezas", "items": "textos/fortalezas_docente_ia.md"},
        {"titulo": "Educación", "entradas": ["tuia", "tecnico"], "compacto": true}
    ]
}
```

Each `habilidades` row is a group name, or a pair of them shown side by side: the right one as
wide as its longest line, the left one in the rest of the sidebar.

A section lists `entradas` (ids from `cv.json`), `items` (a Markdown file of headed paragraphs,
or a list of plain lines), or both. `"compacto": true` shows each entry as title, place, dates and `nota`, without its
`tareas`.
`"lateral": true` moves the section to the sidebar, below the skills, as entry titles with
their place and dates, headed paragraphs justified and plain lines right-aligned. In any item,
`**text**` is bold. The sidebar never breaks across pages: the C
generator stops with an error if it does not fit, and LaTeX spills it into the main column.

### Texts
`data/textos/*.md` hold plain paragraphs (profile texts) or `# Heading` lines each followed by a
paragraph (tasks and strengths).

## Page length
A CV should fit on one page; trim the profile until it does. If it does not, neither generator
fails: the sidebar stays on the first page and the main column continues on the next ones.

## Tests
`make test` runs both suites:

- `python/tests`: builds every profile, checks the data validation, and compiles an overflowing
  CV to check that it continues in the main column (skipped without tectonic and `pdftotext`).
- `c/tests`: JSON and Markdown parsing, dates, font metrics, and the PDF of each profile against
  the real data (the teacher CVs on one page, `programador` overflowing onto a second).

## License
GPL-3.0. See [LICENSE](../LICENSE).
