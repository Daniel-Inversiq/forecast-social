#!/usr/bin/env python3
"""Sync core agent JSON bibles from frontend markdown sources."""

from __future__ import annotations

import sys
from pathlib import Path

_BACKEND = Path(__file__).resolve().parents[1]
if str(_BACKEND) not in sys.path:
    sys.path.insert(0, str(_BACKEND))

from app.forecasting.character_bibles.markdown_sync import sync_all_core_bibles, validate_core_bibles


def main() -> int:
    sync_all_core_bibles(write=True)
    errors = validate_core_bibles()
    if errors:
        for err in errors:
            print(f"ERROR: {err}", file=sys.stderr)
        return 1
    print("Synced and validated all core character bibles.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
