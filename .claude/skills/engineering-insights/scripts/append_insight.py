#!/usr/bin/env python3
"""Append one validated entry to a module INSIGHTS.md without rewriting it."""

from __future__ import annotations

import argparse
import hashlib
import os
import sys
from datetime import date, datetime
from pathlib import Path

import fcntl


MODULES = ("client", "server", "reviewer-core", "e2e")
CATEGORIES = (
    "architecture",
    "boundary",
    "invariant",
    "debugging",
    "testing",
    "migration",
    "security",
    "performance",
    "operations",
    "decision",
)


def compact(value: str, field: str) -> str:
    normalized = " ".join(value.split())
    if not normalized:
        raise ValueError(f"{field} must not be empty")
    return normalized


def parse_day(value: str) -> str:
    try:
        return datetime.strptime(value, "%Y-%m-%d").date().isoformat()
    except ValueError as error:
        raise argparse.ArgumentTypeError("date must use YYYY-MM-DD") from error


def entry_id(module: str, category: str, title: str, insight: str) -> str:
    canonical = "\n".join((module, category, title.casefold(), insight.casefold()))
    digest = hashlib.sha256(canonical.encode("utf-8")).hexdigest()[:12]
    return f"eng-{module}-{digest}"


def render_entry(
    identifier: str,
    recorded_on: str,
    category: str,
    title: str,
    evidence: str,
    implication: str,
    insight: str,
) -> str:
    return (
        f"<!-- insight-id: {identifier} -->\n"
        f"## {identifier} — {title}\n\n"
        f"- Date: {recorded_on}\n"
        f"- Category: {category}\n"
        f"- Evidence: {evidence}\n"
        f"- Implication: {implication}\n\n"
        f"{insight}\n"
    )


def write_all(fd: int, payload: bytes) -> None:
    offset = 0
    while offset < len(payload):
        offset += os.write(fd, payload[offset:])


def append_entry(path: Path, identifier: str, entry: str) -> bool:
    if not path.is_file():
        raise FileNotFoundError(f"required insights file does not exist: {path}")

    fd = os.open(path, os.O_RDWR | os.O_APPEND)
    try:
        fcntl.flock(fd, fcntl.LOCK_EX)
        os.lseek(fd, 0, os.SEEK_SET)
        existing = os.read(fd, os.fstat(fd).st_size)
        marker = f"<!-- insight-id: {identifier} -->".encode("utf-8")
        if marker in existing:
            return False

        separator = b"" if not existing or existing.endswith(b"\n\n") else b"\n"
        write_all(fd, separator + entry.encode("utf-8"))
        os.fsync(fd)
        return True
    finally:
        try:
            fcntl.flock(fd, fcntl.LOCK_UN)
        finally:
            os.close(fd)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--project-root", required=True, type=Path)
    parser.add_argument("--module", required=True, choices=MODULES)
    parser.add_argument("--category", required=True, choices=CATEGORIES)
    parser.add_argument("--title", required=True)
    parser.add_argument("--evidence", required=True)
    parser.add_argument("--implication", required=True)
    parser.add_argument("--insight", required=True)
    parser.add_argument("--date", dest="recorded_on", type=parse_day, default=date.today().isoformat())
    return parser


def main() -> int:
    args = build_parser().parse_args()
    try:
        title = compact(args.title, "title")
        evidence = compact(args.evidence, "evidence")
        implication = compact(args.implication, "implication")
        insight = compact(args.insight, "insight")
        identifier = entry_id(args.module, args.category, title, insight)
        target = args.project_root.resolve() / args.module / "INSIGHTS.md"
        entry = render_entry(
            identifier,
            args.recorded_on,
            args.category,
            title,
            evidence,
            implication,
            insight,
        )
        appended = append_entry(target, identifier, entry)
    except (OSError, ValueError) as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 2

    action = "APPENDED" if appended else "SKIP duplicate"
    print(f"{action} {identifier} in {target}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
