// Foja CV template, spike version: a Typst port of the Wenneker layout that cvgen renders with
// LaTeX. It reads the project document itself; nothing generates Typst source.
//
// Inputs (`sys.inputs`): `datos`, path of the project JSON (default `/project.json`), and
// `perfil`, the profile to lay out (default `programador`).

#let datos = json(sys.inputs.at("datos", default: "/project.json"))
#let perfil = datos.perfiles.at(sys.inputs.at("perfil", default: "programador"))

// Measurements taken from the LaTeX output (memoir, 10pt, geometry 1.2cm). memoir and flowfram
// end up with frames wider than 0.26/0.68 of the geometry text width, so the columns are the
// measured widths and the main column runs into the right margin, as in the PDF.
#let azul = cmyk(100%, 50%, 0%, 0%) // dvipsnames RoyalBlue
#let margen = 1.2cm
#let ancho-lateral = 144.5pt
#let hueco = 18pt
#let ancho-principal = 374pt
#let raya = 1.5pt
#let sep = 1em
#let sep-chica = 0.5em
#let chica = 9pt // \small

#let etiquetas-contacto = (
  telefono: "Teléfono",
  correo: "Correo",
  github: "GitHub",
  linkedin: "LinkedIn",
  web: "Web",
)
#let contactos-url = ("correo", "github", "linkedin", "web")

#set document(
  title: (datos.nombres + datos.apellidos).join(" ") + " — " + perfil.subtitulo,
  author: (datos.nombres + datos.apellidos).join(" "),
)
// A line box of 1em plus 0.2em of leading gives LaTeX's 12pt \baselineskip at 10pt (11pt at 9pt);
// paragraphs and blocks are stacked with no extra space (parskip 0), as in the LaTeX version.
#set text(font: "XCharter", size: 10pt, lang: "es", top-edge: 0.8em, bottom-edge: -0.2em)
#set par(leading: 0.2em, spacing: 0.2em)
#set block(spacing: 0.2em)
#set page(
  paper: "a4",
  margin: (left: margen, y: margen, right: 210mm - margen - ancho-lateral - hueco - ancho-principal),
  // The dotted rule between the columns, on the first page only (the sidebar does not continue).
  background: context if counter(page).get().first() == 1 {
    place(
      top + left,
      dx: margen + ancho-lateral + 6pt,
      dy: margen,
      line(
        angle: 90deg,
        length: 297mm - 2 * margen,
        stroke: (paint: azul, thickness: raya, dash: (0pt, 4pt), cap: "round"),
      ),
    )
  },
)

// `**bold**` inside a plain string.
#let en-linea(s) = s.split("**").enumerate().map(((i, parte)) => if calc.odd(i) { strong(parte) } else { parte }).join()

#let mes(valor) = {
  let (anio, m) = valor.split("-")
  m + "/" + anio
}

// `desde` alone is a single date; `hasta: null` means it is still going on.
#let periodo(e) = {
  if "desde" not in e { return "" }
  if "hasta" not in e { return mes(e.desde) }
  mes(e.desde) + " – " + if e.hasta == none { "actualidad" } else { mes(e.hasta) }
}

#let celeste(cuerpo) = text(fill: azul, strong(cuerpo))

#let vineta = box(baseline: -0.08em, circle(radius: 0.19em, stroke: 0.45pt + azul))
#set list(marker: vineta, indent: 0.1em, body-indent: 0.6em, spacing: 0.2em)

#let items-lista(items) = {
  for item in items {
    list.item({
      if "encabezado" in item { strong(item.encabezado + ".") + " " }
      en-linea(item.texto)
    })
  }
}

// ---------------------------------------------------------------- sidebar

#let foto = if datos.foto == none {
  rect(width: 100%, height: ancho-lateral * 371 / 403, fill: luma(225), stroke: none)[
    #set align(center + horizon)
    #text(fill: luma(120), "foto")
  ]
} else {
  image(datos.foto, width: 100%)
}

#let bloque-lateral(titulo, valores) = {
  par(celeste(titulo) + linebreak() + valores.join(linebreak()))
  v(sep)
}

#let columna-habilidades(grupo) = {
  set align(right)
  par((celeste(grupo), ..datos.habilidades.at(grupo)).join(linebreak()))
}

#let seccion-lateral(s) = {
  par(celeste(s.titulo))
  for e in s.at("entradas", default: ()).map(k => datos.entradas.at(k)) {
    par((strong(e.titulo), ..(e.at("lugar", default: ""), periodo(e)).filter(x => x != "").map(emph)).join(linebreak()))
    v(sep-chica)
  }
  for item in s.at("items", default: ()) {
    if "encabezado" in item {
      // Paragraphs to read: justified, last line flush left (as cvgen does in LaTeX).
      align(left, par(justify: true, strong(item.encabezado + ".") + " " + en-linea(item.texto)))
    } else {
      par(en-linea(item.texto))
    }
    v(sep-chica)
  }
  v(sep)
}

#let lateral = {
  set align(right)
  set text(size: chica)
  foto
  v(12pt)
  if "postulacion" in perfil { bloque-lateral("Curso", (perfil.postulacion,)) }
  bloque-lateral("Contacto", perfil.contactos.map(k => {
    let valor = datos.contactos.at(k)
    if k in contactos-url { text(font: "Latin Modern Mono 9", valor) } else { valor }
  }))
  for fila in perfil.habilidades {
    if fila.len() == 1 {
      bloque-lateral(fila.first(), datos.habilidades.at(fila.first()))
    } else {
      align(right, grid(columns: fila.len(), column-gutter: 1em, ..fila.map(columna-habilidades)))
      v(sep)
    }
  }
  for s in perfil.secciones.filter(s => s.at("lateral", default: false)) { seccion-lateral(s) }
}

// ---------------------------------------------------------------- main column

#let entrada(e, compacta) = {
  let titulo = if compacta { strong(e.titulo) } else { celeste(e.titulo) }
  let lugar = e.at("lugar", default: "")
  par(titulo + h(1fr) + text(size: chica, periodo(e)) + linebreak() + text(size: if compacta { chica } else { 10pt }, emph(lugar)))
  if "nota" in e { par(text(size: chica, e.nota)) }
  if not compacta and "tareas" in e { items-lista(e.tareas) }
  v(sep-chica)
}

#let seccion(s) = {
  par(text(size: 12pt, strong(s.titulo)))
  v(sep-chica)
  let compacta = s.at("compacto", default: false)
  for k in s.at("entradas", default: ()) { entrada(datos.entradas.at(k), compacta) }
  items-lista(s.at("items", default: ()))
  v(sep)
}

#let principal = {
  set par(justify: true)
  text(size: 20.74pt, fill: azul, strong((datos.nombres + datos.apellidos).join(" ")))
  v(5pt)
  text(size: 12pt, strong(perfil.subtitulo))
  v(12pt)
  par(celeste("Perfil") + h(0.66em) + perfil.perfil)
  v(sep)
  for s in perfil.secciones.filter(s => not s.at("lateral", default: false)) { seccion(s) }
}

#grid(
  columns: (ancho-lateral, hueco, ancho-principal),
  lateral, [], principal,
)
