import re
import shutil
import subprocess
from pathlib import Path

import pytest
from cvgen.build import build_cv, format_period
from cvgen.compile import compile_pdf
from cvgen.latex import escape, render
from cvgen.sources import DataError, parse_markdown

DATA = Path(__file__).resolve().parents[2] / "data"


def test_parse_markdown_joins_lines_under_each_heading():
    text = "intro\n# Uno\nprimera\nsegunda\n\n# Dos\ntercera\n"
    assert parse_markdown(text) == [(None, "intro"), ("Uno", "primera segunda"), ("Dos", "tercera")]


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ({}, ""),
        ({"desde": "2026-10"}, "10/2026"),
        ({"desde": "2018-07", "hasta": None}, "07/2018 – actualidad"),
        ({"desde": "2024-09", "hasta": "2024-10"}, "09/2024 – 10/2024"),
    ],
)
def test_format_period(raw, expected):
    assert format_period(raw) == expected


def test_format_period_rejects_bad_dates():
    with pytest.raises(DataError):
        format_period({"desde": "julio"})


def test_escape_latex_specials():
    assert escape("30 % & #1_a") == r"30 \% \& \#1\_a"


@pytest.mark.parametrize("profile", ["docente-cine-debate", "programador"])
def test_every_profile_builds_and_renders(profile):
    cv = build_cv(DATA, profile)
    assert cv.photo.is_file()
    tex = render(cv)
    assert tex.count(r"\begin{itemize}") == tex.count(r"\end{itemize}")
    assert cv.name in tex


def test_cine_debate_profile_contents():
    cv = build_cv(DATA, "docente-cine-debate")
    assert cv.application == "Cine debate"
    assert cv.sections[0].entries[0].title == "Docente particular"
    assert ("Correo", "correo@ejemplo.com") in cv.contacts


def test_unknown_entry_is_reported(tmp_path):
    (tmp_path / "perfiles").mkdir()
    (tmp_path / "cv.json").write_text((DATA / "cv.json").read_text())
    (tmp_path / "perfiles" / "x.json").write_text(
        '{"subtitulo": "", "perfil": "p.md", "contactos": [],'
        ' "secciones": [{"titulo": "S", "entradas": ["nope"]}]}'
    )
    (tmp_path / "p.md").write_text("perfil")
    with pytest.raises(DataError, match="nope"):
        build_cv(tmp_path, "x")


@pytest.mark.skipif(
    not (shutil.which("tectonic") and shutil.which("pdftotext")),
    reason="needs tectonic and pdftotext",
)
def test_overflow_continues_in_main_column(tmp_path):
    cv = build_cv(DATA, "programador")
    output = tmp_path / "cv.pdf"
    compile_pdf(render(cv), cv.photo, output)
    bbox = subprocess.run(
        ["pdftotext", "-bbox", str(output), "-"], capture_output=True, text=True, check=True
    ).stdout
    pages = bbox.split("<page ")[1:]
    assert len(pages) == 2
    words = re.findall(r'xMin="([\d.]+)"[^>]*>([^<]*)<', pages[1])
    assert "Racket" in [word for _, word in words]
    # On A4 the sidebar ends around x = 170pt; nothing on page 2 may start there.
    assert min(float(x) for x, _ in words) > 170
