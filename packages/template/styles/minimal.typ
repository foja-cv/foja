// Minimal: black on white with a lot of air, hierarchy only from size and weight, the accent
// colour on the name and nothing else. One column; contacts on the right of the header.

#import "/lib.typ": *

#let ink = rgb("#141414")
#let muted = rgb("#6b6b6b")
#let accent-color = accent(ink)
#let m = margins((top: 15, bottom: 15, left: 17, right: 17))
#let text-width = paper.width - m.left - m.right
#let small = base-size * 0.88

#set document(..document-info)
#set page(width: paper.width, height: paper.height, margin: m)
#set text(font: opt("font", "Noto Sans"), size: base-size * 0.95, fill: ink, lang: lang)
#set par(leading: 0.65em, spacing: 0.65em * density, justify: false)
#set list(marker: text(fill: muted, [–]), indent: 0pt, body-indent: 0.6em, spacing: 0.45em * density)
#show link: set text(hyphenate: false)

#geometry(main: (x: m.left, width: text-width))

#let section-title(title) = block(above: 1.5em * density, below: 0.6em * density, sticky: true, text(
  size: small * 0.95,
  weight: "bold",
  tracking: 0.14em,
  upper(title),
))

#let entry(b, compact) = anchored(b.path, block(above: 1em * density, below: 0pt, {
  grid(
    columns: (1fr, auto),
    column-gutter: 1em,
    text(weight: "medium", b.title), text(size: small, fill: muted, b.period),
  )
  if b.place != "" { text(size: small, fill: muted, b.place) }
  if b.note != none { par(text(size: small, fill: muted, b.note)) }
  if not compact and b.items.len() > 0 {
    v(0.2em)
    list(..b.items.map(item-body))
  }
}))

#let section(s) = anchored(s.path, {
  section-title(s.title)
  for b in s.blocks {
    if b.type == "entry" { entry(b, s.compact) } else if b.type == "item" {
      anchored(b.path, block(above: 0.5em * density, below: 0pt, list(item-body(b))))
    } else { anchored(b.path, par(inline(b.text))) }
  }
})

// ---------------------------------------------------------------- page

#let picture = photo(base-size * 7.5)
#grid(
  columns: (1fr, auto, auto),
  column-gutter: 1.4em,
  align: (bottom, bottom + right, top),
  {
    anchored("name", text(size: base-size * 2.6, fill: accent-color, cv.name))
    v(0.15em)
    anchored("subtitle", text(size: base-size * 1.2, fill: muted, cv.subtitle))
  },
  if cv.contacts.len() > 0 { anchored("contacts", align(right, text(size: small, fill: muted, cv.contacts.map(contact-text).join(linebreak())))) },
  if picture != none { anchored("photo", picture) },
)
#if cv.highlight != none {
  v(1.4em * density)
  anchored("highlight", par[#text(weight: "bold", cv.highlight.title) #h(0.4em) #cv.highlight.text])
}
#if cv.summary != "" {
  v(1.4em * density)
  anchored("summary", par(justify: true, text(size: base-size * 1.02, inline(cv.summary))))
}
#if cv.skills.len() > 0 {
  section-title(labels.skills)
  for (i, row) in cv.skills.enumerate() {
    anchored("skills." + str(i), grid(
      columns: (auto, 1fr),
      column-gutter: 1.5em,
      row-gutter: 0.5em,
      ..row.map(g => (text(size: small, fill: muted, g.title), g.items.join(" · "))).flatten(),
    ))
    v(0.5em)
  }
}
#for s in cv.sections { section(s) }
