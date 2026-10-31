// Foja's template library. Every CV style, the built-in ones and those people write themselves,
// is a Typst file that starts with
//
//     #import "/lib.typ": *
//
// and lays out `cv`, the profile being built, already resolved: entries looked up, dates
// formatted, labels in the CV's language, contacts with their links. The marks (`anchored`) and
// the column geometry (`geometry`) are what the editor uses for click-to-edit and the page-fit
// badge; a style works without them, those two features just do not.
//
// Inputs (`sys.inputs`): `project`, path of the project JSON (default `/project.json`), and
// `profile`, the id of the profile to lay out (default: the first one). The photo is a file under
// `/assets/`.

#let project = json(sys.inputs.at("project", default: "/project.json"))
#let profile-id = sys.inputs.at("profile", default: project.profiles.keys().first())
#let profile = project.profiles.at(profile-id)
#let layout = profile.at("layout", default: (:))

/// A layout option of the profile, or `default` when it is not set.
#let opt(key, default) = layout.at(key, default: default)

#let all-labels = json("/labels.json")
#let lang = project.language.split("-").first()
/// Fixed words in the CV's language: `labels.profile`, `labels.contact`, `labels.skills`,
/// `labels.present`, `labels.months`, `labels.contacts.<kind>`.
#let labels = all-labels.at(opt("labels", lang), default: all-labels.en)

// ---------------------------------------------------------------- text and dates

/// A plain string where `**bold**` spans become strong.
#let inline(s) = s.split("**").enumerate().map(((i, part)) => if calc.odd(i) { strong(part) } else { part }).join()

/// `2026-05` in the profile's date format: `05/2026`, `may 2026` or `2026`.
#let month(value) = {
  let (year, m) = value.split("-")
  let format = opt("dateFormat", "MM/YYYY")
  if format == "YYYY" { year } else if format == "MMM YYYY" { labels.months.at(int(m) - 1) + " " + year } else {
    m + "/" + year
  }
}

/// The period of an entry: `start` alone is a single date, `end: none` means ongoing.
#let period(e) = {
  if "start" not in e { return "" }
  if "end" not in e { return month(e.start) }
  let start = month(e.start)
  let end = if e.end == none { labels.present } else { month(e.end) }
  if start == end { start } else { start + " – " + end }
}

/// The text of an item, with its heading in bold.
#let item-body(it) = {
  if it.at("heading", default: none) != none { strong(it.heading + ".") + " " }
  inline(it.text)
}

// ---------------------------------------------------------------- options

/// The accent colour: the profile's, or the style's `default`.
#let accent(default) = if "accent" in layout { rgb(layout.accent) } else { default }
/// Body size in points (`fontSize`, default 10).
#let base-size = opt("fontSize", 10) * 1pt
/// Spacing factor of the `density` option: 0.7, 1 or 1.3.
#let density = (compact: 0.7, normal: 1, relaxed: 1.3).at(opt("density", "normal"))
/// Page size of the `paper` option.
#let paper = if opt("paper", "a4") == "a4" { (width: 210mm, height: 297mm) } else { (width: 215.9mm, height: 279.4mm) }
/// The margins: the profile's (in mm), each falling back to the style's `default` (also in mm).
#let margins(default) = {
  let m = layout.at("margins", default: (:))
  (
    top: m.at("top", default: default.top) * 1mm,
    bottom: m.at("bottom", default: default.bottom) * 1mm,
    left: m.at("left", default: default.left) * 1mm,
    right: m.at("right", default: default.right) * 1mm,
  )
}

// ---------------------------------------------------------------- marks for the editor

/// An invisible marker; `anchored` puts one at each end of a part.
#let mark(path, kind, column) = context [#metadata((
  path: path,
  kind: kind,
  column: column,
  page: here().page(),
  x: here().position().x.pt(),
  y: here().position().y.pt(),
))<foja>]

/// `body`, marked as the part at `path` (e.g. `cv.sections.at(0).path`) in `column` ("main" or
/// "side"), so that a click on it in the editor opens that part.
#let anchored(path, body, column: "main") = {
  mark(path, "start", column)
  body
  mark(path, "end", column)
}

/// Declares where the columns are on the page (from the left edge), for the editor to know the
/// width of a marked part: `geometry(main: (x: 200pt, width: 360pt), side: (x: 34pt, width: 150pt))`.
#let geometry(main: none, side: none) = {
  let pt(c) = if c == none { none } else { (x: c.x.pt(), width: c.width.pt()) }
  [#metadata((main: pt(main), side: pt(side)))<foja-geometry>]
}

// ---------------------------------------------------------------- the CV, resolved

#let link-for(kind, value) = {
  if kind == "email" { "mailto:" + value } else if kind in ("website", "github", "linkedin") {
    if value.starts-with("http") { value } else { "https://" + value }
  } else { none }
}

/// Everything a style lays out:
/// - `name`, `given`, `family`, `subtitle`, `summary` (may be ""), `highlight` (`(title, text)` or none);
/// - `photo` (a path for `image`, or none) and `photo-shape` ("square", "rounded", "circle");
/// - `contacts`: array of `(kind, label, value, link)` (`link` is none for phone and location);
/// - `skills`: rows of groups `(title, items)`; a row with several groups goes side by side;
/// - `sections`: array of `(index, path, id, title, side, compact, blocks)`; `side` is true for
///   sections meant for a sidebar; each block is either
///   `(type: "entry", path, id, title, place, period, note, items)` or
///   `(type: "item" | "paragraph", path, heading, text)`.
#let cv = {
  let person = project.person
  let photo-name = person.at("photo", default: none)
  (
    name: (person.givenNames + person.familyNames).join(" "),
    given: person.givenNames.join(" "),
    family: person.familyNames.join(" "),
    subtitle: profile.subtitle,
    summary: profile.summary,
    highlight: profile.at("highlight", default: none),
    photo: if photo-name == none or opt("photo", "square") == "none" { none } else { "/assets/" + photo-name },
    photo-shape: opt("photo", "square"),
    contacts: profile
      .contacts
      .filter(k => k in project.contacts)
      .map(k => (kind: k, label: labels.contacts.at(k), value: project.contacts.at(k), link: link-for(k, project.contacts.at(k)))),
    skills: profile.skills.map(row => row.filter(id => id in project.skills).map(id => project.skills.at(id))).filter(row => row.len() > 0),
    sections: profile
      .sections
      .enumerate()
      .map(((i, s)) => (
        index: i,
        path: "sections." + str(i),
        id: s.id,
        title: s.title,
        side: s.at("column", default: "main") == "side",
        compact: s.at("compact", default: false),
        blocks: s
          .blocks
          .enumerate()
          .map(((j, b)) => {
            let path = "sections." + str(i) + ".blocks." + str(j)
            if b.type == "entry" {
              let e = project.entries.at(b.entry)
              (
                type: "entry",
                path: path,
                id: b.entry,
                title: e.title,
                place: e.at("place", default: ""),
                period: period(e),
                note: e.at("note", default: none),
                items: e.at("items", default: ()),
              )
            } else {
              (type: b.type, path: path, heading: b.at("heading", default: none), text: b.text)
            }
          }),
      )),
  )
}

/// The photo at `width`, in the profile's shape; none when there is no photo.
#let photo(width, shape: cv.photo-shape) = {
  if cv.photo == none { return none }
  if shape == "circle" {
    box(clip: true, radius: 50%, width: width, height: width, image(cv.photo, width: width, height: width, fit: "cover"))
  } else if shape == "rounded" {
    box(clip: true, radius: width * 0.08, image(cv.photo, width: width))
  } else {
    image(cv.photo, width: width)
  }
}

/// A contact value as text, linked when it has a link.
#let contact-text(c) = if c.link == none { c.value } else { link(c.link, c.value) }

/// The document metadata every style should set.
#let document-info = (title: cv.name + " — " + cv.subtitle, author: cv.name)
