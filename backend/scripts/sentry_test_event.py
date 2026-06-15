#!/usr/bin/env python3
"""Send a Sentry test event from the CLI (requires SENTRY_DSN and SENTRY_ENABLED=true in dev)."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.observability.sentry import init_sentry, send_test_event
from app.settings import sentry_enabled


def main() -> None:
    if not sentry_enabled():
        print("Sentry is disabled. Set SENTRY_DSN and SENTRY_ENABLED=true (or ENV=production).")
        raise SystemExit(1)
    init_sentry()
    event_id = send_test_event()
    print(f"Test event sent (event_id={event_id}). Check your Sentry project Issues feed.")


if __name__ == "__main__":
    main()
