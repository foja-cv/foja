"""Layer 5: compile the LaTeX source into a PDF with tectonic."""

import shutil
import subprocess
import tempfile
from importlib import resources
from pathlib import Path

from cvgen.latex import PHOTO_NAME


class CompileError(Exception):
    pass


def compile_pdf(tex: str, photo: Path, output: Path) -> None:
    engine = shutil.which("tectonic")
    if engine is None:
        raise CompileError("tectonic is not installed (pacman -S tectonic)")
    template = resources.files("cvgen") / "plantilla" / "structure.tex"

    with tempfile.TemporaryDirectory(prefix="cvgen-") as tmp:
        workdir = Path(tmp)
        (workdir / "cv.tex").write_text(tex, encoding="utf-8")
        (workdir / "structure.tex").write_text(template.read_text(encoding="utf-8"))
        shutil.copyfile(photo, workdir / PHOTO_NAME)
        result = subprocess.run(
            [engine, "--chatter", "minimal", "cv.tex"],
            cwd=workdir,
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            raise CompileError(result.stdout + result.stderr)
        output.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(workdir / "cv.pdf", output)
