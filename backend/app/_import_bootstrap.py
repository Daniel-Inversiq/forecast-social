"""Import-time guards — must load before sqlalchemy and other heavy deps."""

from __future__ import annotations

import os
import sys

# Some Windows/Python builds hang loading sqlalchemy.cyextension DLLs at import.
os.environ.setdefault("DISABLE_SQLALCHEMY_CEXT_RUNTIME", "1")

# Editable installs (e.g. levelai_saas) on sys.path can stall imports.
sys.path[:] = [
    entry
    for entry in sys.path
    if entry and "__editable__" not in entry and "levelai_saas" not in entry
]
