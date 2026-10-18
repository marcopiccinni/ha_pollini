"""Pytest bootstrap for the integration's pure modules.

Importing the integration as a package would execute ``__init__.py``, which
pulls in Home Assistant. Instead we register a synthetic package whose
``__path__`` points at the component directory: the submodules used by the
tests (``const``, ``models``, ``parser``, ``stats``) have no Home Assistant
imports, so they load without a Home Assistant installation.
"""

from __future__ import annotations

import sys
import types
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
COMPONENT = ROOT / "custom_components" / "ha_pollini"

if "ha_pollini" not in sys.modules:
    package = types.ModuleType("ha_pollini")
    package.__path__ = [str(COMPONENT)]
    sys.modules["ha_pollini"] = package
