"""Layer 1: reading the raw data files (JSON and the small Markdown subset)."""

import json
from pathlib import Path


class DataError(Exception):
    """The data directory is missing something or has the wrong shape."""


def read_json(path: Path) -> dict:
    try:
        with path.open(encoding="utf-8") as file:
            return json.load(file)
    except FileNotFoundError as error:
        raise DataError(f"missing file: {path}") from error
    except json.JSONDecodeError as error:
        raise DataError(f"invalid JSON in {path}: {error}") from error


def read_text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8").strip()
    except FileNotFoundError as error:
        raise DataError(f"missing file: {path}") from error


def parse_markdown(text: str) -> list[tuple[str | None, str]]:
    """Split Markdown into (heading, paragraph) pairs.

    Only `# Heading` lines are recognised; every non-empty line up to the
    next heading is joined into that heading's paragraph. Text before the
    first heading gets a `None` heading.
    """
    pairs: list[tuple[str | None, list[str]]] = []
    for raw in text.splitlines():
        line = raw.strip()
        if line.startswith("#"):
            pairs.append((line.lstrip("#").strip(), []))
        elif line:
            if not pairs:
                pairs.append((None, []))
            pairs[-1][1].append(line)
    return [(heading, " ".join(lines)) for heading, lines in pairs]
