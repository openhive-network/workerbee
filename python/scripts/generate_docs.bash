#!/usr/bin/env bash
set -euo pipefail

SCRIPTPATH="$(cd -- "$(dirname "$0")" >/dev/null 2>&1 && pwd -P)"
PROJECT_DIR="$(cd -- "${SCRIPTPATH}/.." >/dev/null 2>&1 && pwd -P)"
OUTPUT_DIR="${1:-"${PROJECT_DIR}/dist/docs"}"

if [[ $# -gt 1 ]]; then
  echo "Usage: $0 [output-dir]" >&2
  exit 2
fi

if [[ "${OUTPUT_DIR}" != /* ]]; then
  OUTPUT_DIR="$(pwd)/${OUTPUT_DIR}"
fi

if [[ -x "${PROJECT_DIR}/.venv/bin/sphinx-build" ]]; then
  SPHINX_BUILD=("${PROJECT_DIR}/.venv/bin/sphinx-build")
elif command -v sphinx-build >/dev/null 2>&1; then
  SPHINX_BUILD=("sphinx-build")
elif command -v poetry >/dev/null 2>&1; then
  SPHINX_BUILD=("poetry" "-C" "${PROJECT_DIR}" "run" "sphinx-build")
else
  echo "sphinx-build is not available. Install docs dependencies with:" >&2
  echo "  poetry -C ${PROJECT_DIR} install --with docs" >&2
  exit 127
fi

WORK_DIR="$(mktemp -d)"
trap 'rm -rf "${WORK_DIR}"' EXIT

SOURCE_DIR="${WORK_DIR}/source"
mkdir -p "${SOURCE_DIR}"

cat >"${SOURCE_DIR}/conf.py" <<PY
from __future__ import annotations

from datetime import UTC, datetime
from importlib import metadata
from pathlib import Path

project = "WorkerBee Python"
author = "Hive Community"
copyright = f"{datetime.now(UTC).year}, {author}"

try:
    release = metadata.version("hiveio-workerbee")
except metadata.PackageNotFoundError:
    release = "0.0.0"

extensions = [
    "autoapi.extension",
    "sphinx.ext.autodoc",
    "sphinx.ext.napoleon",
    "sphinx.ext.viewcode",
]

source_suffix = ".rst"
master_doc = "index"
html_theme = "furo"
html_title = "WorkerBee Python API"

autoapi_type = "python"
autoapi_dirs = [str(Path("${PROJECT_DIR}") / "workerbee")]
autoapi_root = "api"
autoapi_keep_files = False
autoapi_member_order = "groupwise"
autoapi_options = [
    "members",
    "undoc-members",
    "show-inheritance",
    "show-module-summary",
]
autoapi_ignore = [
    "*/__pycache__/*",
]

napoleon_google_docstring = True
napoleon_numpy_docstring = True
napoleon_attr_annotations = True

exclude_patterns = [
    "_build",
    "Thumbs.db",
    ".DS_Store",
]


def _strip_inherited_builtin_docstrings(_app, what, _name, _obj, _options, lines):
    """Remove docstrings inherited from runtime base classes.

    ``TypedDict`` classes are dictionaries at runtime. AutoAPI therefore inherits
    ``dict``'s docstring for undocumented payload shapes, which produces noisy
    reStructuredText warnings and hides the useful attribute list.
    """
    if what != "class":
        return

    first_line = next((line.strip() for line in lines if line.strip()), "")
    if first_line == "dict() -> new empty dictionary":
        lines.clear()


def setup(app):
    app.connect("autodoc-process-docstring", _strip_inherited_builtin_docstrings)
PY

cat >"${SOURCE_DIR}/index.rst" <<'RST'
WorkerBee Python API
====================

This documentation is generated from the Python source code with Sphinx and
Sphinx AutoAPI.

.. toctree::
   :maxdepth: 2
   :caption: API Reference

   api/index
RST

rm -rf "${OUTPUT_DIR}"
mkdir -p "${OUTPUT_DIR}"

"${SPHINX_BUILD[@]}" -q -W --keep-going -b html "${SOURCE_DIR}" "${OUTPUT_DIR}"

echo "Python documentation generated in: ${OUTPUT_DIR}"
