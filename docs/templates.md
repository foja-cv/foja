# Writing a CV style

A Foja style is one Typst file. It imports Foja's library and lays out `cv`, the profile being
built, already resolved:

```typst
#import "/lib.typ": *

#set document(..document-info)
#set page(width: paper.width, height: paper.height, margin: margins((top: 18, bottom: 18, left: 18, right: 18)))
#set text(font: opt("font", "Noto Sans"), size: base-size, lang: lang)

#text(size: 2em, weight: "bold", fill: accent(rgb("#1f5f5b")), cv.name)
#cv.subtitle
```

In the editor: **Estilo y diseño → Editar en Typst** copies the profile's style into one of your
own and opens its code; **Nuevo estilo desde cero** starts from a small skeleton. Your styles
live in the project file (`templates`), so they travel with it and with the Typst export.

## What `cv` holds

| Field | |
| :--- | :--- |
| `cv.name`, `cv.given`, `cv.family` | the whole name, given names, family names |
| `cv.subtitle`, `cv.summary` | strings (`summary` may be `""`) |
| `cv.highlight` | `(title: …, text: …)` or `none` (e.g. the course applied for) |
| `cv.photo`, `cv.photo-shape` | a path for `image()` or `none`; `"square"`, `"rounded"` or `"circle"` |
| `cv.contacts` | array of `(kind, label, value, link)`; `link` is `none` for the phone and the location |
| `cv.skills` | rows of groups `(title, items)`; a row with several groups is meant to go side by side |
| `cv.sections` | array of `(index, path, id, title, side, compact, blocks)` |

Every block of a section is either an entry,
`(type: "entry", path, id, title, place, period, note, items)`, or
`(type: "item" | "paragraph", path, heading, text)`. `period` is already formatted
(`05/2026 – actualidad`); `items` are `(heading, text)` pairs. `side` is true for sections the
user put in the sidebar; a one-column style can ignore it.

## Helpers

| | |
| :--- | :--- |
| `inline(text)` | a string with `**bold**` spans made strong |
| `item-body(item)` | an item with its heading in bold |
| `photo(width, shape: …)` | the photo clipped to its shape, or `none` |
| `contact-text(contact)` | the value, linked when it has a link |
| `labels` | fixed words in the CV's language: `labels.profile`, `labels.contact`, `labels.skills`, `labels.present`, `labels.contacts.phone`, … |
| `month(value)`, `period(entry)` | dates in the profile's format (already applied in `cv`) |
| `document-info` | `(title, author)` for `#set document(..document-info)` |

## Layout options

The profile's options (the **Opciones** panel) reach the style through `opt(key, default)` and a
few ready-made values: `accent(default-colour)`, `base-size`, `density` (0.7, 1 or 1.3),
`paper` (`(width, height)`), `margins(defaults-in-mm)`, `lang`. A style reads the options it
wants and ignores the rest; `opt("columns", 2)`, `opt("sidebar", "left")`,
`opt("sidebarWidth", 30)`, `opt("photo", "square")`, `opt("font", …)` and
`opt("dateFormat", …)` are there too.

Fonts available: **XCharter** (serif), **Noto Sans** (sans) and **Latin Modern Mono 9**.

## Click-to-edit and the page-fit badge

Two optional calls make the editor understand the page:

- `anchored(path, body, column: "main")` marks `body` as the part at `path`, so a click on it
  in the preview opens that part and the selection is outlined on it. Use the paths `cv` gives
  (`s.path`, `b.path`) and these: `"name"`, `"subtitle"`, `"summary"`, `"photo"`,
  `"highlight"`, `"contacts"`, `"skills.0"` (a row). The page-fit badge counts lines from the
  marks too.
- `geometry(main: (x: …, width: …), side: (x: …, width: …))` tells the editor where the columns
  are (from the left edge of the page), so the outlines have the right width. Without it they
  run from the mark to the right margin.

A style without either still compiles and previews; only those two features are missing.

## The built-in styles

`packages/template/styles/legajo.typ`, `banda.typ` and `minimal.typ` are complete examples, and
`packages/template/lib.typ` is the library itself.
