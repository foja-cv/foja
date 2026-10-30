"""Command line entry point: `cvgen --perfil docente-cine-debate`."""

import argparse
import sys
from pathlib import Path

from cvgen.build import build_cv
from cvgen.compile import CompileError, compile_pdf
from cvgen.latex import render
from cvgen.sources import DataError


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="cvgen", description="Build the CV as a PDF.")
    parser.add_argument("--datos", type=Path, default=Path("data"), help="data directory")
    parser.add_argument("--perfil", default="docente-cine-debate", help="profile in data/perfiles")
    parser.add_argument("--salida", type=Path, help="output file (default build/cv-<perfil>.pdf)")
    parser.add_argument("--tex", action="store_true", help="write the .tex instead of the PDF")
    args = parser.parse_args(argv)

    suffix = ".tex" if args.tex else ".pdf"
    output = args.salida or Path("build") / f"cv-{args.perfil}{suffix}"
    try:
        cv = build_cv(args.datos, args.perfil)
        tex = render(cv)
        if args.tex:
            output.parent.mkdir(parents=True, exist_ok=True)
            output.write_text(tex, encoding="utf-8")
        else:
            compile_pdf(tex, cv.photo, output)
    except (DataError, CompileError) as error:
        print(f"cvgen: {error}", file=sys.stderr)
        return 1
    print(output)
    return 0


if __name__ == "__main__":
    sys.exit(main())
