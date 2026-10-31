// Foja CV template. It reads a project document (format foja/2) and lays out one of its
// profiles; the browser, the CLI and a plain `typst compile` all run this same file. Nothing
// generates Typst source.
//
// Inputs (`sys.inputs`): `project`, path of the project JSON (default `/project.json`), and
// `profile`, the id of the profile to lay out (default: the first one). Assets (the photo) are
// files under `/assets/`.
//
// The default layout is a port of the Wenneker look that cvgen renders with LaTeX (memoir, 10pt,
// geometry 1.2cm); its measurements were taken from that PDF.

#let project = json(sys.inputs.at("project", default: "/project.json"))
#let profile-id = sys.inputs.at("profile", default: project.profiles.keys().first())
#let profile = project.profiles.at(profile-id)
#let layout = profile.at("layout", default: (:))
#let opt(key, default) = layout.at(key, default: default)

#let all-labels = json("labels.json")
#let labels = all-labels.at(opt("labels", project.language.split("-").first()), default: all-labels.en)

// ---------------------------------------------------------------- measurements

#let columns = opt("columns", 2)
#let sidebar-side = opt("sidebar", "left")
#let base = opt("fontSize", 10) * 1pt
#let k = base / 10pt // scale of the fixed spacings, measured at 10pt
#let small = base * 0.9 // \small
#let accent = if "accent" in layout { rgb(layout.accent) } else { cmyk(100%, 50%, 0%, 0%) } // RoyalBlue
#let margins = layout.at("margins", default: (:))
#let margin = (
  top: margins.at("top", default: 12) * 1mm,
  bottom: margins.at("bottom", default: 12) * 1mm,
  left: margins.at("left", default: 12) * 1mm,
  // memoir and flowfram end up with frames wider than the geometry text width, so the main column
  // runs into the right margin; 8.7mm reproduces the measured widths.
  right: margins.at("right", default: 8.7) * 1mm,
)
#let (page-width, page-height) = if opt("paper", "a4") == "a4" { (210mm, 297mm) } else { (215.9mm, 279.4mm) }
#let text-width = page-width - margin.left - margin.right
#let gutter = 18pt * k
#let side-width = text-width * opt("sidebarWidth", 26.93) / 100
#let main-width = if columns == 2 { text-width - side-width - gutter } else { text-width }
#let density = (compact: 0.7, normal: 1, relaxed: 1.3).at(opt("density", "normal"))
#let sep = 1em * density
#let sep-small = 0.5em * density
#let rule = 1.5pt

#let full-name = (project.person.givenNames + project.person.familyNames).join(" ")

#set document(title: full-name + " — " + profile.subtitle, author: full-name)
// A line box of 1em plus 0.2em of leading gives LaTeX's 12pt \baselineskip at 10pt (11pt at 9pt);
// paragraphs and blocks are stacked with no extra space (parskip 0), as in the LaTeX version.
#set text(font: opt("font", "XCharter"), size: base, lang: project.language.split("-").first(), top-edge: 0.8em, bottom-edge: -0.2em)
#set par(leading: 0.2em, spacing: 0.2em)
#set block(spacing: 0.2em)
#set page(
  width: page-width,
  height: page-height,
  margin: margin,
  // The dotted rule between the columns, on the first page only (the sidebar does not continue).
  background: context if columns == 2 and counter(page).get().first() == 1 {
    let x = if sidebar-side == "left" { margin.left + side-width + gutter / 3 } else { margin.left + main-width + gutter * 2 / 3 }
    place(
      top + left,
      dx: x,
      dy: margin.top,
      line(
        angle: 90deg,
        length: page-height - margin.top - margin.bottom,
        stroke: (paint: accent, thickness: rule, dash: (0pt, 4pt), cap: "round"),
      ),
    )
  },
)

// ---------------------------------------------------------------- helpers

// Invisible markers around every editable part, with the position where it starts and ends; the
// editor queries them (`<foja>`) for click-to-edit and to find what overflows the page.
#let mark(path, kind) = context [#metadata((path: path, kind: kind, page: here().page(), y: here().position().y.pt()))<foja>]
#let anchored(path, body) = {
  mark(path, "start")
  body
  mark(path, "end")
}

// `**bold**` inside a plain string.
#let inline(s) = s.split("**").enumerate().map(((i, part)) => if calc.odd(i) { strong(part) } else { part }).join()

#let month(value) = {
  let (year, m) = value.split("-")
  let format = opt("dateFormat", "MM/YYYY")
  if format == "YYYY" { year } else if format == "MMM YYYY" { labels.months.at(int(m) - 1) + " " + year } else {
    m + "/" + year
  }
}

// `start` alone is a single date; `end: null` means it is still going on.
#let period(e) = {
  if "start" not in e { return "" }
  if "end" not in e { return month(e.start) }
  let start = month(e.start)
  let end = if e.end == none { labels.present } else { month(e.end) }
  if start == end { start } else { start + " – " + end }
}

#let accented(body) = text(fill: accent, strong(body))

#let bullet = box(baseline: -0.08em, circle(radius: 0.19em, stroke: 0.45pt + accent))
#set list(marker: bullet, indent: 0.1em, body-indent: 0.6em, spacing: 0.2em)

#let item-content(it) = {
  if "heading" in it { strong(it.heading + ".") + " " }
  inline(it.text)
}

#let mono-contacts = ("email", "website", "github", "linkedin")
#let contact-value(kind) = {
  let value = project.contacts.at(kind)
  // Addresses are never hyphenated, and set in English so that a hyphen of their own is not
  // repeated at the start of the next line, as Spanish typesetting does.
  if kind in mono-contacts { text(font: "Latin Modern Mono 9", lang: "en", hyphenate: false, value) } else { value }
}

#let photo(width) = {
  let name = project.person.at("photo", default: none)
  let shape = opt("photo", "square")
  if name == none or shape == "none" { return none }
  let path = "/assets/" + name
  if shape == "circle" {
    box(clip: true, radius: 50%, width: width, height: width, image(path, width: width, height: width, fit: "cover"))
  } else if shape == "rounded" {
    box(clip: true, radius: width * 0.06, image(path, width: width))
  } else {
    image(path, width: width)
  }
}

// ---------------------------------------------------------------- sidebar

#let side-align = if sidebar-side == "left" { right } else { left }

#let side-block(title, values) = {
  par(accented(title) + linebreak() + values.join(linebreak()))
  v(sep)
}

#let skill-column(group) = {
  set align(side-align)
  par((accented(group.title), ..group.items).join(linebreak()))
}

#let side-section(s, path) = anchored(path, {
  par(accented(s.title))
  for (j, b) in s.blocks.enumerate() {
    anchored(path + ".blocks." + str(j), if b.type == "entry" {
      let e = project.entries.at(b.entry)
      let details = (e.at("place", default: ""), period(e)).filter(x => x != "").map(emph)
      par((strong(e.title), ..details).join(linebreak()))
    } else if "heading" in b {
      // Paragraphs to read: justified, last line flush left (as cvgen does in LaTeX).
      align(left, par(justify: true, strong(b.heading + ".") + " " + inline(b.text)))
    } else {
      par(inline(b.text))
    })
    v(sep-small)
  }
  v(sep)
})

#let is-side(s) = columns == 2 and s.at("column", default: "main") == "side"

#let sidebar = {
  set align(side-align)
  set text(size: small)
  let picture = photo(side-width)
  if picture != none {
    anchored("photo", picture)
    v(12pt * k)
  }
  if "highlight" in profile { anchored("highlight", side-block(profile.highlight.title, (profile.highlight.text,))) }
  if profile.contacts.len() > 0 { anchored("contacts", side-block(labels.contact, profile.contacts.map(contact-value))) }
  for (i, row) in profile.skills.enumerate() {
    anchored("skills." + str(i), if row.len() == 1 {
      let group = project.skills.at(row.first())
      side-block(group.title, group.items)
    } else {
      align(side-align, grid(columns: row.len(), column-gutter: 1em, ..row.map(id => skill-column(project.skills.at(id)))))
      v(sep)
    })
  }
  for (i, s) in profile.sections.enumerate() {
    if is-side(s) { side-section(s, "sections." + str(i)) }
  }
}

// ---------------------------------------------------------------- main column

#let entry(e, compact) = {
  let title = if compact { strong(e.title) } else { accented(e.title) }
  let place = text(size: if compact { small } else { base }, emph(e.at("place", default: "")))
  par(title + h(1fr) + text(size: small, period(e)) + linebreak() + place)
  if "note" in e { par(text(size: small, e.note)) }
  if not compact and "items" in e {
    for it in e.items { list.item(item-content(it)) }
  }
  v(sep-small)
}

#let main-section(s, path) = anchored(path, {
  par(text(size: base * 1.2, strong(s.title)))
  v(sep-small)
  let compact = s.at("compact", default: false)
  for (j, b) in s.blocks.enumerate() {
    anchored(path + ".blocks." + str(j), if b.type == "entry" {
      entry(project.entries.at(b.entry), compact)
    } else if b.type == "item" {
      list.item(item-content(b))
    } else {
      par(inline(b.text))
    })
  }
  v(sep)
})

#let heading-lines = {
  anchored("name", text(size: base * 2.074, fill: accent, strong(full-name)))
  v(5pt * k)
  anchored("subtitle", text(size: base * 1.2, strong(profile.subtitle)))
}

#let summary = if profile.summary != "" {
  anchored("summary", par(accented(labels.profile) + h(0.66em) + inline(profile.summary)))
  v(sep)
}

#let main-sections = for (i, s) in profile.sections.enumerate() {
  if not is-side(s) { main-section(s, "sections." + str(i)) }
}

#let main-column = {
  set par(justify: true)
  heading-lines
  v(12pt * k)
  summary
  main-sections
}

// One column: contacts under the name, the photo beside it, skills as a section of their own.
#let single-column = {
  set par(justify: true)
  let contacts = profile.contacts.map(contact-value)
  let head = {
    heading-lines
    if contacts.len() > 0 {
      v(4pt * k)
      anchored("contacts", text(size: small, contacts.join(h(0.6em) + sym.dot.c + h(0.6em))))
    }
  }
  let picture = photo(base * 9)
  if picture == none { head } else { grid(columns: (1fr, auto), column-gutter: 1em, align: (left + bottom, top), head, anchored("photo", picture)) }
  v(12pt * k)
  if "highlight" in profile {
    anchored("highlight", par(accented(profile.highlight.title) + h(0.66em) + profile.highlight.text))
    v(sep)
  }
  summary
  if profile.skills.len() > 0 {
    par(text(size: base * 1.2, strong(labels.skills)))
    v(sep-small)
    for (i, row) in profile.skills.enumerate() {
      anchored("skills." + str(i), for id in row {
        let group = project.skills.at(id)
        par(strong(group.title + ":") + " " + group.items.join(", "))
      })
    }
    v(sep)
  }
  main-sections
}

#if columns == 2 {
  if sidebar-side == "left" {
    grid(columns: (side-width, gutter, main-width), sidebar, [], main-column)
  } else {
    grid(columns: (main-width, gutter, side-width), main-column, [], sidebar)
  }
} else {
  single-column
}
