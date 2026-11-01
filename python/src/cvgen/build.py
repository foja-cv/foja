"""Layer 3: combine the base data with a profile into a `Cv`."""

from pathlib import Path

from cvgen.model import Cv, Entry, Item, Section
from cvgen.sources import DataError, parse_markdown, read_json, read_text

CONTACT_LABELS = {
    "telefono": "Teléfono",
    "correo": "Correo",
    "github": "GitHub",
    "linkedin": "LinkedIn",
    "web": "Web",
}
ONGOING = "actualidad"
PRIVATE = "privado.json"


def format_month(value: str) -> str:
    """`"2026-08"` -> `"08/2026"`."""
    year, _, month = value.partition("-")
    if not (year.isdigit() and month.isdigit()):
        raise DataError(f"bad date {value!r}, expected YYYY-MM")
    return f"{month}/{year}"


def format_period(raw: dict) -> str:
    """`desde` alone is a single date; `hasta: null` means it is still going on."""
    if "desde" not in raw:
        return ""
    start = format_month(raw["desde"])
    if "hasta" not in raw:
        return start
    end = ONGOING if raw["hasta"] is None else format_month(raw["hasta"])
    return f"{start} – {end}"


def load_items(data_dir: Path, value: str | list[str] | None) -> list[Item]:
    """Tasks are either a list of strings or the path of a Markdown file."""
    if value is None:
        return []
    if isinstance(value, list):
        return [Item(text) for text in value]
    return [Item(text, heading) for heading, text in parse_markdown(read_text(data_dir / value))]


def build_entry(data_dir: Path, raw: dict) -> Entry:
    return Entry(
        title=raw["titulo"],
        place=raw.get("lugar", ""),
        period=format_period(raw),
        note=raw.get("nota", ""),
        tasks=load_items(data_dir, raw.get("tareas")),
    )


def build_section(data_dir: Path, raw: dict, entries: dict) -> Section:
    unknown = [key for key in raw.get("entradas", []) if key not in entries]
    if unknown:
        raise DataError(f"section {raw['titulo']!r} uses unknown entries: {', '.join(unknown)}")
    return Section(
        title=raw["titulo"],
        entries=[build_entry(data_dir, entries[key]) for key in raw.get("entradas", [])],
        items=load_items(data_dir, raw.get("items")),
        compact=raw.get("compacto", False),
        side=raw.get("lateral", False),
    )


def load_private(path: Path) -> dict:
    """The address, phone and email live in a file kept out of the repo; it may be missing."""
    return read_json(path) if path.is_file() else {}


def load_address(private: dict, path: Path) -> list[str]:
    if "domicilio" not in private:
        raise DataError(f"profile shows the address but it is not in {path}")
    address = private["domicilio"]
    return [
        address["calle"],
        address["ciudad"],
        f"{address['provincia']}, {address['pais']}",
    ]


def load_contacts(
    keys: list[str], public: dict, private: dict, path: Path
) -> list[tuple[str, str]]:
    """Public contacts come from cv.json; the phone and email, from the private file."""
    values = {**public, **private.get("contactos", {})}
    contacts = []
    for key in keys:
        if key not in CONTACT_LABELS:
            raise DataError(f"unknown contact {key!r}")
        if key not in values:
            raise DataError(
                f"profile shows the {key} contact but it is in neither cv.json nor {path}"
            )
        contacts.append((CONTACT_LABELS[key], values[key]))
    return contacts


def build_cv(data_dir: Path, profile_name: str, private_path: Path | None = None) -> Cv:
    base = read_json(data_dir / "cv.json")
    profile = read_json(data_dir / "perfiles" / f"{profile_name}.json")
    private_path = private_path or data_dir / PRIVATE
    private = load_private(private_path)
    skills = base["habilidades"]
    rows = [[row] if isinstance(row, str) else row for row in profile.get("habilidades", [])]
    if any(len(row) not in (1, 2) for row in rows):
        raise DataError("a row of skill groups holds one or two groups")
    missing = [group for row in rows for group in row if group not in skills]
    if missing:
        raise DataError(f"profile uses unknown skill groups: {', '.join(missing)}")

    return Cv(
        name=" ".join(base["nombres"] + base["apellidos"]),
        subtitle=profile["subtitulo"],
        application=profile.get("postulacion", ""),
        profile=read_text(data_dir / profile["perfil"]),
        photo=data_dir / base["foto"],
        address=load_address(private, private_path) if profile.get("domicilio") else [],
        contacts=load_contacts(profile["contactos"], base["contactos"], private, private_path),
        skills=[[(group, skills[group]) for group in row] for row in rows],
        sections=[
            build_section(data_dir, section, base["entradas"]) for section in profile["secciones"]
        ],
    )
