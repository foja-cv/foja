# Foja user guide

Foja is a CV editor built on [Typst](https://typst.app). You fill in forms; the preview next to
them is the real Typst output, updated as you type. Everything runs in your browser: your data
stays on your computer.

## Getting started

Open the editor and pick one of:

- **Start with the example**: a fictional CV with two profiles, to see how things fit together.
- **Empty project**: a blank CV.
- **Import JSON**: a `.foja.json` file exported from Foja (yours, or a template someone shared).

Your work is saved in the browser as you go ("Saved" in the header). **Ctrl+S** saves at once.
Replacing the project (new, example, import) keeps the previous one: **Project ▾ → Restore the
previous project** brings it back. Export the project as JSON now and then to keep a copy outside
the browser.

## Profiles and the entry bank

A project holds **one bank of entries** (jobs, degrees, projects) and **several profiles** that
pick from it: a CV for a programming job and one for a teaching post can share the same
entries, each with its own subtitle, summary, sections and layout. Editing an entry changes it in
every profile that uses it; the entry form says which ones do.

- **Profile ▾** in the header switches profiles; **+ New profile** and **Duplicate** make more.
- **Data**: personal data and photo, contacts, skill groups, and the entry bank.
- **Profile**: the profile's text (subtitle, summary, which contacts and skills it shows) and its
  **style and layout**.
- **Sections**: each section holds blocks: an entry from the bank, an item (a bullet with an
  optional heading) or a paragraph. Drag sections and blocks to reorder them (or use the handle
  with the keyboard: Space, arrows, Space). A section can go in the sidebar, and can be
  *compact* (entries without their items, in small type).

Dates use month pickers; an entry can be *ongoing* or have a *single date*. Text can carry
`**bold**`.

## Styles

**Style and layout** shows the three Foja styles, each with a thumbnail of your CV in it:

- **Legajo** (default): serif, the name in small caps over a rule, a sidebar card, the dates in a
  column of their own.
- **Banda**: a band of colour with the name and the photo; one column, sans-serif.
- **Minimal**: black on white with plenty of air; the colour only on the name.

Below them, the options the chosen style honours: one or two columns, sidebar side and width,
photo shape, typeface, size, colour, margins, spacing, paper, date format and the language of
fixed labels (Spanish, English, Portuguese).

**Edit in Typst** copies the profile's style into a style of your own and opens its code; **New
style from scratch** starts from a small skeleton. Errors show above the preview, which keeps the
last good version. How to write a style: [`templates.md`](templates.md).

## One page

The badge above the preview says whether the CV fits on one page and, if not, by how many lines;
the parts that spill over are tinted red, and the sections they belong to get a ⚠ in the
navigation. Click any part of the preview to edit it.

## Exporting

**Export** (Ctrl+E) offers:

| Format | Notes |
| :--- | :--- |
| PDF | The CV as you see it. |
| JPG | One image per page, at 72, 150 or 300 dpi. |
| Word (`.docx`) | One or two columns, in the Legajo look whatever the style (Word cannot run Typst). |
| Typst (`.zip`) | The style, the project and the fonts: compiles with `typst compile` and opens in typst.app. |
| LaTeX (`.zip`) | In the Legajo look; LaTeX breaks lines a little differently, so a CV that just fits in the PDF can run a few lines over. |
| Markdown | A plain CV for a README or a form that takes text. |
| JSON | The project file, to import it again or move it to another computer. |
| All formats | Every one of them in a `.zip`. |

Names in non-Latin scripts: the bundled fonts cover Latin alphabets only, so other scripts show
as missing glyphs for now.

## Privacy and storage

- Nothing is sent anywhere: the project lives in this browser (IndexedDB) and in the files you
  export. There are no accounts.
- The editor works offline once it has been opened.
- Foja edits in one tab at a time, so two tabs never overwrite each other; a second tab offers to
  take over.

## Keyboard

| Keys | |
| :--- | :--- |
| Ctrl+Z, Ctrl+Shift+Z / Ctrl+Y | undo, redo |
| Ctrl+S | save now |
| Ctrl+E | export |
| Ctrl+K | command palette: go to any panel, section, entry or profile, or run an action |
| Escape | closes menus and dialogs |

In the style code editor, Tab indents; Escape then Tab leaves it.

## Appearance

**Appearance ▾** switches the interface theme (Papel y tinta, Neutro, Vivo, or one you import),
light or dark mode, and the interface language (Spanish or English). Making a theme:
[`themes.md`](themes.md).

## Command line

`npx foja build my.foja.json` builds every profile as PDF; `--format` adds svg, typ, tex, md,
json, docx or all. See [`packages/cli/README.md`](../packages/cli/README.md).
