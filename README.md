# curriculum
Tools to build a CV from the data in `data/`, with two independent generators:

- **`python/`** (`cvgen`): builds LaTeX on the Wenneker template and compiles it with
  [tectonic](https://tectonic-typesetting.github.io/) (`pacman -S tectonic`).
- **`c/`** (`cvgen-c`): writes the PDF directly, with no dependencies beyond libc.

## Data
- `data/cv.json`: personal data, sidebar skills and every CV entry, keyed by id.
- `data/perfiles/<perfil>.json`: what one CV shows (subtitle, profile text, contacts,
  skill groups and sections with their entries).
- `data/textos/*.md`: prose. `# Heading` lines followed by a paragraph.

Dates are `YYYY-MM`. An entry with only `desde` is a single date; `"hasta": null` means ongoing.

## Usage
```sh
make python PERFIL=docente-cine-debate   # build/cv-docente-cine-debate.pdf
make c PERFIL=docente-cine-debate        # build/cv-docente-cine-debate-c.pdf
make test                                # pytest + C tests
```
