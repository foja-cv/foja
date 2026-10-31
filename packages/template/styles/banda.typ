// Banda: a band of colour across the top of the first page with the name, the photo beside it;
// one column below, sans-serif, section titles marked with a block of the accent colour.

#import "/lib.typ": *

#let ink = rgb("#1d2327")
#let muted = ink.lighten(42%)
#let accent-color = accent(rgb("#1f5f5b"))
#let m = margins((top: 10, bottom: 14, left: 16, right: 16))
#let band = 36mm
#let text-width = paper.width - m.left - m.right
#let small = base-size * 0.9

#set document(..document-info)
#set page(
  width: paper.width,
  height: paper.height,
  margin: m,
  background: context if counter(page).get().first() == 1 { place(top + left, rect(width: 100%, height: band, fill: accent-color)) },
)
#set text(font: opt("font", "Noto Sans"), size: base-size * 0.95, fill: ink, lang: lang)
#set par(leading: 0.6em, spacing: 0.6em * density, justify: false)
#set list(marker: text(fill: accent-color, sym.bullet), indent: 0.2em, body-indent: 0.5em, spacing: 0.4em * density)
#show link: set text(hyphenate: false)

#geometry(main: (x: m.left, width: text-width))

#let section-title(title) = block(above: 1.35em * density, below: 0.6em * density, sticky: true, {
  box(baseline: 0.12em, rect(width: 3.5pt, height: 0.95em, fill: accent-color))
  h(0.5em)
  text(size: base-size * 1.15, weight: "medium", title)
})

#let entry(b, compact) = anchored(b.path, block(above: 0.8em * density, below: 0pt, {
  text(weight: "bold", b.title)
  h(1fr)
  text(size: small, fill: muted, b.period)
  if b.place != "" {
    linebreak()
    text(size: small, fill: accent-color, weight: "medium", b.place)
  }
  if b.note != none { par(text(size: small, fill: muted, b.note)) }
  if not compact and b.items.len() > 0 { list(..b.items.map(item-body)) }
}))

#let section(s) = anchored(s.path, {
  section-title(s.title)
  for b in s.blocks {
    if b.type == "entry" { entry(b, s.compact) } else if b.type == "item" {
      anchored(b.path, block(above: 0.45em * density, below: 0pt, list(item-body(b))))
    } else { anchored(b.path, par(inline(b.text))) }
  }
})

// ---------------------------------------------------------------- the band

#let picture = photo(band - m.top - 8mm, shape: if cv.photo-shape == "square" { "rounded" } else { cv.photo-shape })
#block(height: band - m.top, width: 100%, {
  set text(fill: white)
  grid(
    columns: (1fr, auto),
    align: (horizon, horizon),
    {
      anchored("name", text(size: base-size * 2.3, weight: "bold", cv.name))
      v(0.1em)
      anchored("subtitle", text(size: base-size * 1.25, cv.subtitle))
    },
    if picture != none { anchored("photo", picture) },
  )
})
#v(0.9em)

// ---------------------------------------------------------------- body

#if cv.contacts.len() > 0 {
  anchored("contacts", text(size: small, fill: muted, cv.contacts.map(contact-text).join(h(0.45em) + text(fill: accent-color, sym.bullet) + h(0.45em))))
}
#if cv.skills.len() > 0 {
  v(0.5em)
  for (i, row) in cv.skills.enumerate() {
    anchored("skills." + str(i), grid(
      columns: (1fr,) * row.len(),
      column-gutter: 1.5em,
      ..row.map(g => text(size: small)[#text(weight: "bold", g.title): #g.items.join(" · ")]),
    ))
    v(0.25em)
  }
}
#if cv.highlight != none {
  v(0.5em)
  anchored("highlight", par[#text(fill: accent-color, weight: "bold", cv.highlight.title) #h(0.4em) #cv.highlight.text])
}
#if cv.summary != "" {
  v(0.4em)
  anchored("summary", par(justify: true, inline(cv.summary)))
}
#for s in cv.sections { section(s) }
