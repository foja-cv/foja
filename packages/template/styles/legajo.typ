// Legajo: Foja's own look, after the "foja de servicios" it is named for. The name in small caps
// over a rule, a sidebar card on a light tint, small-caps section titles with a hairline, and the
// dates in a column of their own, like a record. One or two columns, sidebar on either side.

#import "/lib.typ": *

#let ink = rgb("#1f2a2e")
#let muted = ink.lighten(38%)
#let accent-color = accent(rgb("#1f5f5b"))
#let tint = accent-color.lighten(92%)
#let m = margins((top: 14, bottom: 14, left: 15, right: 15))
#let two = opt("columns", 2) == 2
#let side-left = opt("sidebar", "left") == "left"
#let text-width = paper.width - m.left - m.right
#let gutter = 7mm
#let side-width = if two { text-width * opt("sidebarWidth", 30) / 100 } else { 0pt }
#let main-width = if two { text-width - side-width - gutter } else { text-width }
#let main-x = if two and side-left { m.left + side-width + gutter } else { m.left }
#let side-x = if side-left { m.left } else { m.left + main-width + gutter }
#let small = base-size * 0.88
#let date-width = 2.25cm * (base-size / 10pt)

#set document(..document-info)
#set page(width: paper.width, height: paper.height, margin: m)
#set text(font: opt("font", "XCharter"), size: base-size, fill: ink, lang: lang)
#set par(leading: 0.55em, spacing: 0.55em * density, justify: true)
#set list(marker: text(fill: accent-color, [–]), indent: 0pt, body-indent: 0.5em, spacing: 0.4em * density)
#show link: set text(hyphenate: false, lang: "en")

#geometry(main: (x: main-x, width: main-width), side: if two { (x: side-x, width: side-width) } else { none })

#let caps(body, tracking: 0.05em) = text(tracking: tracking, smallcaps(body))

// ---------------------------------------------------------------- pieces

#let section-title(title) = block(above: 1.3em * density, below: 0.65em * density, sticky: true, {
  text(fill: accent-color, weight: "bold", caps(lower(title), tracking: 0.08em))
  h(0.6em)
  box(width: 1fr, baseline: -0.32em, line(length: 100%, stroke: 0.5pt + accent-color.lighten(50%)))
})

#let entry(b, compact) = anchored(b.path, block(above: 0.85em * density, below: 0pt, grid(
  columns: (date-width, 1fr),
  column-gutter: 0.8em,
  par(justify: false, text(size: small, fill: muted, b.period)),
  {
    text(weight: "bold", b.title)
    if b.place != "" {
      linebreak()
      text(style: "italic", fill: muted, b.place)
    }
    if b.note != none { par(text(size: small, fill: muted, b.note)) }
    if not compact and b.items.len() > 0 { list(..b.items.map(item-body)) }
  },
)))

#let main-section(s) = anchored(s.path, {
  section-title(s.title)
  for b in s.blocks {
    if b.type == "entry" { entry(b, s.compact) } else if b.type == "item" {
      anchored(b.path, block(above: 0.5em * density, below: 0pt, list(item-body(b))))
    } else { anchored(b.path, par(inline(b.text))) }
  }
})

#let side-heading(title) = text(size: small * 0.95, fill: accent-color, weight: "bold", caps(lower(title), tracking: 0.08em))
#let side-block(title, body) = block(below: 1.1em * density, {
  side-heading(title)
  v(0.25em)
  body
})

#let side-section(s) = side-block(s.title, for b in s.blocks {
  anchored(b.path, column: "side", block(below: 0.6em, if b.type == "entry" {
    strong(b.title)
    if b.place != "" { linebreak() + emph(b.place) }
    if b.period != "" { linebreak() + text(fill: muted, b.period) }
  } else {
    par(justify: true, item-body(b))
  }))
})

#let contacts-lines = cv.contacts.map(contact-text).join(linebreak())

#let sidebar = block(fill: tint, inset: (x: 10pt, y: 12pt), radius: 3pt, width: 100%, {
  set text(size: small)
  set par(justify: false, leading: 0.5em)
  let picture = photo(side-width - 20pt)
  if picture != none {
    anchored("photo", column: "side", align(center, picture))
    v(6pt)
  }
  if cv.highlight != none { anchored("highlight", column: "side", side-block(cv.highlight.title, cv.highlight.text)) }
  if cv.contacts.len() > 0 { anchored("contacts", column: "side", side-block(labels.contact, contacts-lines)) }
  for (i, row) in cv.skills.enumerate() {
    anchored("skills." + str(i), column: "side", if row.len() == 1 {
      side-block(row.first().title, row.first().items.join(linebreak()))
    } else {
      grid(columns: row.len(), column-gutter: 1em, ..row.map(g => side-block(g.title, g.items.join(linebreak()))))
    })
  }
  for s in cv.sections.filter(s => s.side) { anchored(s.path, column: "side", side-section(s)) }
})

#let heading-lines = {
  anchored("name", text(size: base-size * 2.3, caps(cv.name, tracking: 0.04em)))
  v(-0.35em)
  line(length: 100%, stroke: 1.6pt + accent-color)
  v(0.1em)
  anchored("subtitle", text(size: base-size * 1.25, style: "italic", fill: muted, cv.subtitle))
}

#let summary = if cv.summary != "" { anchored("summary", par(inline(cv.summary))) }

// ---------------------------------------------------------------- page

#if two {
  heading-lines
  v(1em * density)
  let main = {
    summary
    for s in cv.sections.filter(s => not s.side) { main-section(s) }
  }
  if side-left { grid(columns: (side-width, main-width), column-gutter: gutter, sidebar, main) } else {
    grid(columns: (main-width, side-width), column-gutter: gutter, main, sidebar)
  }
} else {
  let picture = photo(base-size * 8.5)
  let head = {
    heading-lines
    if cv.contacts.len() > 0 {
      v(0.4em)
      anchored("contacts", text(size: small, fill: muted, cv.contacts.map(contact-text).join(h(0.5em) + sym.dot.c + h(0.5em))))
    }
  }
  if picture == none { head } else {
    grid(columns: (1fr, auto), column-gutter: 1.2em, align: (bottom, top), head, anchored("photo", picture))
  }
  v(1em * density)
  if cv.highlight != none { anchored("highlight", par[#text(fill: accent-color, weight: "bold", cv.highlight.title) #h(0.5em) #cv.highlight.text]) }
  summary
  if cv.skills.len() > 0 {
    section-title(labels.skills)
    for (i, row) in cv.skills.enumerate() {
      anchored("skills." + str(i), grid(
        columns: (date-width, 1fr),
        column-gutter: 0.8em,
        row-gutter: 0.45em,
        ..row.map(g => (text(size: small, fill: muted, caps(lower(g.title))), g.items.join(", "))).flatten(),
      ))
      v(0.45em)
    }
  }
  for s in cv.sections { main-section(s) }
}
