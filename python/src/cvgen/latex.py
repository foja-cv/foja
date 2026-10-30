"""Layer 4: render a `Cv` as a LaTeX document for the Wenneker template."""

from cvgen.model import Cv, Entry, Item, Section

PHOTO_NAME = "foto.jpg"
URL_CONTACTS = {"Correo", "GitHub"}

_SPECIAL = {
    "\\": r"\textbackslash{}",
    "&": r"\&",
    "%": r"\%",
    "$": r"\$",
    "#": r"\#",
    "_": r"\_",
    "{": r"\{",
    "}": r"\}",
    "~": r"\textasciitilde{}",
    "^": r"\textasciicircum{}",
}


def escape(text: str) -> str:
    return "".join(_SPECIAL.get(char, char) for char in text)


def render_sidebar(cv: Cv) -> str:
    lines = [
        r"\userinformation{",
        r"\begin{flushright}",
        rf"\includegraphics[width=\columnwidth]{{{PHOTO_NAME}}}\\[\baselineskip]",
        r"\small",
    ]

    def block(title: str, values: list[str]) -> None:
        lines.append(rf"\SideHeading{{{escape(title)}}}")
        lines.extend(rf"{escape(value)} \\" for value in values)
        lines.append(r"\Sep")

    if cv.application:
        block("Curso", [cv.application])
    block("Domicilio", cv.address)
    lines.append(r"\SideHeading{Contacto}")
    lines.extend(
        rf"\url{{{value}}} \\" if label in URL_CONTACTS else rf"{escape(value)} \\"
        for label, value in cv.contacts
    )
    lines.append(r"\Sep")
    for group, values in cv.skills:
        block(group, values)
    lines += [r"\vfill", r"\end{flushright}", "}"]
    return "\n".join(lines)


def render_items(items: list[Item]) -> str:
    if not items:
        return ""
    lines = [r"\begin{itemize}[leftmargin=1.2em,label=\bluebullet]"]
    for item in items:
        heading = rf"\textbf{{{escape(item.heading)}.}} " if item.heading else ""
        lines.append(rf"\item {heading}{escape(item.text)}")
    lines.append(r"\end{itemize}")
    return "\n".join(lines)


def render_entry(entry: Entry, compact: bool) -> str:
    command = r"\CVCompact" if compact else r"\CVEntry"
    lines = [
        rf"{command}{{{escape(entry.title)}}}{{{escape(entry.place)}}}{{{escape(entry.period)}}}"
    ]
    if entry.note:
        lines.append(rf"{{\small {escape(entry.note)}}}\par")
    if not compact:
        lines.append(render_items(entry.tasks))
    lines.append(r"\SmallSep")
    return "\n".join(line for line in lines if line)


def render_section(section: Section) -> str:
    parts = [rf"\CVSection{{{escape(section.title)}}}"]
    parts += [render_entry(entry, section.compact) for entry in section.entries]
    parts.append(render_items(section.items))
    parts.append(r"\Sep")
    return "\n".join(part for part in parts if part)


def render(cv: Cv) -> str:
    return "\n".join(
        [
            r"\documentclass[a4paper,10pt]{memoir}",
            r"\input{structure.tex}",
            render_sidebar(cv),
            r"\begin{document}",
            r"\userinformation\framebreak",
            rf"\cvheading{{{escape(cv.name)}}}",
            rf"\cvsubheading{{{escape(cv.subtitle)}}}",
            rf"\aboutme{{Perfil}}{{{escape(cv.profile)}}}",
            *[render_section(section) for section in cv.sections],
            r"\end{document}",
            "",
        ]
    )
