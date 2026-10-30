"""Layer 2: the CV as plain data, already resolved for one profile."""

from dataclasses import dataclass, field
from pathlib import Path


@dataclass(frozen=True)
class Item:
    text: str
    heading: str | None = None


@dataclass(frozen=True)
class Entry:
    title: str
    place: str = ""
    period: str = ""
    note: str = ""
    tasks: list[Item] = field(default_factory=list)


@dataclass(frozen=True)
class Section:
    title: str
    entries: list[Entry] = field(default_factory=list)
    items: list[Item] = field(default_factory=list)
    compact: bool = False
    side: bool = False  # rendered in the sidebar instead of the main column


@dataclass(frozen=True)
class Cv:
    name: str
    subtitle: str
    profile: str
    photo: Path
    address: list[str]
    contacts: list[tuple[str, str]]
    skills: list[tuple[str, list[str]]]
    sections: list[Section]
    application: str = ""
