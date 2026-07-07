#!/usr/bin/env bash
set -euo pipefail

SCRIPTPATH="$(cd -- "$(dirname "$0")" >/dev/null 2>&1 && pwd -P)"
PROJECT_DIR="$(cd -- "${SCRIPTPATH}/.." >/dev/null 2>&1 && pwd -P)"
OUTPUT_DIR="${1:-"${PROJECT_DIR}/dist/docs"}"
SOURCE_REPO_URL="${CI_PROJECT_URL:-https://gitlab.syncad.com/hive/workerbee}"
SOURCE_REVISION="${CI_COMMIT_SHA:-$(git -C "${PROJECT_DIR}/.." rev-parse HEAD 2>/dev/null || printf "HEAD")}"

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
    "myst_parser",
    "sphinx.ext.autodoc",
    "sphinx.ext.napoleon",
    "sphinx.ext.viewcode",
]

source_suffix = {
    ".rst": "restructuredtext",
    ".md": "markdown",
}
master_doc = "index"
html_theme = "furo"
html_title = "WorkerBee Python API"
myst_heading_anchors = 3

autoapi_type = "python"
autoapi_dirs = [str(Path("${PROJECT_DIR}") / "workerbee")]
autoapi_root = "api"
autoapi_template_dir = "_autoapi_templates"
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

_CURATED_API_USAGE_EXAMPLES = {
    "workerbee.chain_observers.collectors.bucket_aggregate_queue": """
from workerbee.chain_observers.collectors.bucket_aggregate_queue import BucketAggregateQueue

queue: BucketAggregateQueue[str] = BucketAggregateQueue(bucket_size=10)
queue.enqueue(3, "early")
queue.enqueue(14, "later")

ready = list(queue.dequeue_until(10))
print(ready)  # ['early']
print(queue.size)  # 1
""".strip(),
}

_CURATED_CLASS_USAGE_EXAMPLES = {
    "workerbee.chain_observers.bot.WorkerBee": """
import asyncio

from wax import WaxChainOptions, create_hive_chain

from workerbee import ObserverNotification, WorkerBee


async def main() -> None:
    first_block = asyncio.Event()

    def handle(event: ObserverNotification) -> None:
        print(event["block"]["number"])
        first_block.set()

    async with (
        create_hive_chain(WaxChainOptions(endpoint_url="https://api.hive.blog/")) as chain,
        WorkerBee(chain) as bot,
    ):
        subscription = bot.observe.on_block().subscribe(on_next=handle)
        await bot.start()
        try:
            async with asyncio.timeout(30):
                await first_block.wait()
        finally:
            subscription.close()


asyncio.run(main())
""".strip(),
    "workerbee.chain_observers.collectors.bucket_aggregate_queue.BucketAggregateQueue": """
from workerbee.chain_observers.collectors.bucket_aggregate_queue import BucketAggregateQueue

queue: BucketAggregateQueue[str] = BucketAggregateQueue(bucket_size=10)
queue.enqueue(3, "early")
queue.enqueue(14, "later")

ready = list(queue.dequeue_until(10))
print(ready)  # ['early']
print(queue.size)  # 1
""".strip(),
    "workerbee.chain_observers.interfaces.Observer": """
from workerbee import ObserverNotification
from workerbee.chain_observers.interfaces import Observer


def handle(event: ObserverNotification) -> None:
    print(sorted(event))


observer = Observer(next=handle)
assert observer.next is handle
""".strip(),
    "workerbee.chain_observers.errors.WorkerBeeError": """
from workerbee.chain_observers.errors import WorkerBeeError

try:
    raise WorkerBeeError("invalid observer configuration")
except WorkerBeeError as error:
    print(str(error))
""".strip(),
    "workerbee.chain_observers.errors.BlockNotAvailableError": """
from workerbee.chain_observers.errors import BlockNotAvailableError

error = BlockNotAvailableError(123_456)
print(str(error))
""".strip(),
    "workerbee.chain_observers._ordered_set.OrderedSet": """
from workerbee.chain_observers._ordered_set import OrderedSet

names = OrderedSet(["alice", "bob", "alice"])
names.add("carol")
print(list(names))  # ['alice', 'bob', 'carol']
""".strip(),
    "workerbee.chain_observers.enums.ManabarType": """
from workerbee import ManabarType

print(ManabarType.RC.value)
""".strip(),
    "workerbee.chain_observers.enums.AlarmType": """
from workerbee.chain_observers.enums import AlarmType

print(AlarmType.GOVERNANCE_VOTE_EXPIRED.name)
""".strip(),
    "workerbee.chain_observers.enums.Exchange": """
from workerbee import Exchange

print(Exchange.BINANCE == "Binance")
""".strip(),
    "workerbee.chain_observers.factories.factory_base.EClassifierOrigin": """
from workerbee.chain_observers.factories.factory_base import EClassifierOrigin

print(EClassifierOrigin.FILTER)
""".strip(),
    "workerbee.chain_observers.queen.Subscription": """
from workerbee.chain_observers.queen import Subscription

# Applications receive Subscription from QueenBee.subscribe(...), then close it
# when the observer is no longer needed.
print(Subscription.__name__)
""".strip(),
    "workerbee.chain_observers.queen.QueenBee": """
from typing import Self

from workerbee import ObserverNotification, WorkerBee
from workerbee.chain_observers.wax_api import WorkerBeeApiCollection


class DryRunChain:
    def extends(self, api_collection: type[WorkerBeeApiCollection]) -> Self:
        return self


def handle(event: ObserverNotification) -> None:
    print(sorted(event))


bot = WorkerBee(DryRunChain())
subscription = bot.observe.on_block().subscribe(on_next=handle)
subscription.close()
""".strip(),
    "workerbee.chain_observers.past_queen.PastQueen": """
from typing import Self

from workerbee import WorkerBee
from workerbee.chain_observers.wax_api import WorkerBeeApiCollection


class DryRunChain:
    def extends(self, api_collection: type[WorkerBeeApiCollection]) -> Self:
        return self


bot = WorkerBee(DryRunChain())
past = bot.provide_past_operations(96_549_390, 96_549_391)
print(type(past).__name__)
""".strip(),
    "workerbee.chain_observers.wax_api.WorkerBeeApiCollection": """
from workerbee.chain_observers.wax_api import WorkerBeeApiCollection

# WorkerBee passes this collection class to chain.extends(...).
print(WorkerBeeApiCollection.__name__)
""".strip(),
}

_FILTER_SAMPLE_IMPORTS = {
    "AccountFullManabarFilter": "from workerbee import ManabarType",
    "CompositeFilter": "from workerbee.chain_observers.filters.blank_filter import BlankFilter",
    "LogicalAndFilter": "from workerbee.chain_observers.filters.blank_filter import BlankFilter",
    "LogicalOrFilter": "from workerbee.chain_observers.filters.blank_filter import BlankFilter",
}

_SIMPLE_CONSTRUCTOR_ARG_VALUES = {
    "accounts": '["alice"]',
    "authors": '["alice"]',
    "voters": '["alice"]',
    "witnesses": '["initminer"]',
    "ids": '["follow"]',
    "transaction_ids": '["0000000000000000000000000000000000000000"]',
    "number": "123_456",
    "feed_price_change_percent_min": "5.0",
    "feed_price_no_change_intervals": "24",
    "asset": '{"amount": 100_000, "nai": "@@000000021", "precision": 3}',
    "manabar_type": "ManabarType.RC",
    "manabar_load_percent": "98",
    "include_internal_transfers": "False",
    "report_after_ms_before_payout": "60_000",
    "is_post": "True",
    "missed_blocks_count_min": "3",
    "bucket_size": "10",
    "operands": "[BlankFilter()]",
}

exclude_patterns = [
    "_build",
    "_autoapi_templates",
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


def _api_usage_example(obj):
    """Return a compact, valid usage example for an AutoAPI page."""
    curated = _CURATED_API_USAGE_EXAMPLES.get(obj.id)
    if curated is not None:
        return curated

    import_names = []
    for child in getattr(obj, "children", []):
        if not child.display or child.type not in {"class", "exception", "function", "data"}:
            continue
        if child.short_name.startswith("_"):
            continue
        import_names.append(child.short_name)

    if import_names:
        selected = import_names[:8]
        if len(selected) == 1:
            import_line = f"from {obj.name} import {selected[0]}"
        else:
            imports = "\n".join(f"    {name}," for name in selected)
            import_line = f"from {obj.name} import (\n{imports}\n)"

        if len(import_names) > len(selected):
            import_line += f"\n# {len(import_names) - len(selected)} more public names are documented below."

        return f"{import_line}\n\n# See the entries below for constructor arguments, return values, and payload shapes."

    return (
        f"import {obj.name}\n\n"
        "# This namespace groups related WorkerBee internals. Prefer the public "
        "WorkerBee observer API for application code."
    )


def _split_signature_args(args):
    if not args:
        return []

    parts = []
    current = []
    depth = 0
    for char in args:
        if char in "([{":
            depth += 1
        elif char in ")]}":
            depth -= 1
        elif char == "," and depth == 0:
            part = "".join(current).strip()
            if part:
                parts.append(part)
            current = []
            continue
        current.append(char)

    part = "".join(current).strip()
    if part:
        parts.append(part)
    return parts


def _constructor_arg_name(part):
    name = part.split(":", 1)[0].split("=", 1)[0].strip()
    if name.startswith("*"):
        return None
    return name or None


def _simple_constructor_example(obj, module_name, class_name):
    if "worker" in (obj.args or "") or "factory" in (obj.args or "") or "mediator" in (obj.args or "") or "observer" in (obj.args or ""):
        return None

    args = []
    for part in _split_signature_args(obj.args or ""):
        name = _constructor_arg_name(part)
        if name is None:
            return None
        value = _SIMPLE_CONSTRUCTOR_ARG_VALUES.get(name)
        if value is None:
            return None
        args.append(f"{name}={value}")

    imports = [f"from {module_name} import {class_name}"]
    extra_import = _FILTER_SAMPLE_IMPORTS.get(class_name)
    if extra_import is not None:
        imports.insert(0, extra_import)

    call = f"{class_name}({', '.join(args)})"
    return "\n".join(imports) + f"\n\ninstance = {call}\nprint(type(instance).__name__)"


def _class_module_and_name(obj):
    module_name, class_name = obj.id.rsplit(".", 1)
    return module_name, class_name


def _is_typed_dict_like(obj):
    if ".payloads." in obj.id or ".classifier_results." in obj.id:
        return True
    bases = " ".join(str(base) for base in getattr(obj, "bases", []))
    return "TypedDict" in bases or "PayloadBase" in bases


def _api_class_usage_example(obj):
    """Return a working usage example for a class/constructor entry."""
    curated = _CURATED_CLASS_USAGE_EXAMPLES.get(obj.id)
    if curated is not None:
        return curated

    module_name, class_name = _class_module_and_name(obj)
    bases = " ".join(str(base) for base in getattr(obj, "bases", []))

    if _is_typed_dict_like(obj):
        return (
            "from typing import cast\n\n"
            f"from {module_name} import {class_name}\n\n"
            f"value = cast({class_name}, {{}})\n"
            "print(type(value).__name__)  # dict"
        )

    if "Protocol" in bases or class_name.startswith("I"):
        return (
            "from typing import cast\n\n"
            f"from {module_name} import {class_name}\n\n"
            f"value = cast({class_name}, object())\n"
            f"print({class_name}.__name__)"
        )

    if class_name.endswith("Classifier"):
        return (
            f"from {module_name} import {class_name}\n\n"
            f"classifier_key = {class_name}\n"
            "print(classifier_key.__name__)"
        )

    simple = _simple_constructor_example(obj, module_name, class_name)
    if simple is not None:
        return simple

    return (
        f"from {module_name} import {class_name}\n\n"
        f"# This class is normally created by WorkerBee internals.\n"
        f"print({class_name}.__name__)"
    )


def _prepare_autoapi_jinja_env(jinja_env):
    jinja_env.globals["api_usage_example"] = _api_usage_example
    jinja_env.globals["api_class_usage_example"] = _api_class_usage_example


autoapi_prepare_jinja_env = _prepare_autoapi_jinja_env


def setup(app):
    app.connect("autodoc-process-docstring", _strip_inherited_builtin_docstrings)
PY

mkdir -p "${SOURCE_DIR}/_autoapi_templates/python"
cat >"${SOURCE_DIR}/_autoapi_templates/index.rst" <<'RST'
API Reference
=============

This page contains auto-generated API reference documentation [#f1]_.

Usage Example
-------------

.. code-block:: python

   import asyncio

   from wax import WaxChainOptions, create_hive_chain
   from workerbee import ObserverNotification, WorkerBee

   async def main() -> None:
       first_block = asyncio.Event()

       def handle(event: ObserverNotification) -> None:
           print(event["block"]["number"])
           first_block.set()

       async with (
           create_hive_chain(WaxChainOptions(endpoint_url="https://api.hive.blog/")) as chain,
           WorkerBee(chain) as bot,
       ):
           subscription = bot.observe.on_block().subscribe(on_next=handle)
           await bot.start()
           try:
               async with asyncio.timeout(30):
                   await first_block.wait()
           finally:
               subscription.close()

   asyncio.run(main())

.. toctree::
   :titlesonly:

   {% for page in pages|selectattr("is_top_level_object") %}
   {{ page.include_path }}
   {% endfor %}

.. [#f1] Created with `sphinx-autoapi <https://github.com/readthedocs/sphinx-autoapi>`_
RST
cat >"${SOURCE_DIR}/_autoapi_templates/python/package.rst" <<'RST'
{% extends "python/module.rst" %}
RST
cat >"${SOURCE_DIR}/_autoapi_templates/python/exception.rst" <<'RST'
{% extends "python/class.rst" %}
RST
cat >"${SOURCE_DIR}/_autoapi_templates/python/class.rst" <<'RST'
{% if obj.display %}
   {% if is_own_page %}
{{ obj.id }}
{{ "=" * obj.id | length }}

   {% endif %}
   {% set visible_children = obj.children|selectattr("display")|list %}
   {% set own_page_children = visible_children|selectattr("type", "in", own_page_types)|list %}
   {% if is_own_page and own_page_children %}
.. toctree::
   :hidden:

      {% for child in own_page_children %}
   {{ child.include_path }}
      {% endfor %}

   {% endif %}
.. py:{{ obj.type }}:: {% if is_own_page %}{{ obj.id }}{% else %}{{ obj.short_name }}{% endif %}{% if obj.type_params %}[{{ obj.type_params }}]{% endif %}{% if obj.args %}({{ obj.args }}){% endif %}

   {% for (args, return_annotation) in obj.overloads %}
      {{ " " * (obj.type | length) }}   {{ obj.short_name }}{% if args %}({{ args }}){% endif %}

   {% endfor %}
   {% if obj.bases %}
      {% if "show-inheritance" in autoapi_options %}

   Bases: {% for base in obj.bases %}{{ base|link_objs }}{% if not loop.last %}, {% endif %}{% endfor %}
      {% endif %}


      {% if "show-inheritance-diagram" in autoapi_options and obj.bases != ["object"] %}
   .. autoapi-inheritance-diagram:: {{ obj.obj["full_name"] }}
      :parts: 1
         {% if "private-members" in autoapi_options %}
      :private-bases:
         {% endif %}

      {% endif %}
   {% endif %}
   {% if obj.docstring %}

   {{ obj.docstring|indent(3) }}
   {% endif %}
   {% set class_usage = api_class_usage_example(obj) %}
   {% if class_usage %}

   .. rubric:: Usage Example

   .. code-block:: python

{{ class_usage|indent(6, true) }}
   {% endif %}
   {% for obj_item in visible_children %}
      {% if obj_item.type not in own_page_types %}

   {{ obj_item.render()|indent(3) }}
      {% endif %}
   {% endfor %}
   {% if is_own_page and own_page_children %}
      {% set visible_attributes = own_page_children|selectattr("type", "equalto", "attribute")|list %}
      {% if visible_attributes %}
Attributes
----------

.. autoapisummary::

         {% for attribute in visible_attributes %}
   {{ attribute.id }}
         {% endfor %}


      {% endif %}
      {% set visible_exceptions = own_page_children|selectattr("type", "equalto", "exception")|list %}
      {% if visible_exceptions %}
Exceptions
----------

.. autoapisummary::

         {% for exception in visible_exceptions %}
   {{ exception.id }}
         {% endfor %}


      {% endif %}
      {% set visible_classes = own_page_children|selectattr("type", "equalto", "class")|list %}
      {% if visible_classes %}
Classes
-------

.. autoapisummary::

         {% for klass in visible_classes %}
   {{ klass.id }}
         {% endfor %}


      {% endif %}
      {% set visible_methods = own_page_children|selectattr("type", "equalto", "method")|list %}
      {% if visible_methods %}
Methods
-------

.. autoapisummary::

            {% for method in visible_methods %}
   {{ method.id }}
            {% endfor %}


      {% endif %}
   {% endif %}
{% endif %}
RST
cat >"${SOURCE_DIR}/_autoapi_templates/python/module.rst" <<'RST'
{% if obj.display %}
   {% if is_own_page %}
{{ obj.id }}
{{ "=" * obj.id|length }}

.. py:module:: {{ obj.name }}

      {% if obj.docstring %}
.. autoapi-nested-parse::

   {{ obj.docstring|indent(3) }}

      {% endif %}

Usage Example
-------------

.. code-block:: python

{{ api_usage_example(obj)|indent(3, true) }}

      {% block submodules %}
         {% set visible_subpackages = obj.subpackages|selectattr("display")|list %}
         {% set visible_submodules = obj.submodules|selectattr("display")|list %}
         {% set visible_submodules = (visible_subpackages + visible_submodules)|sort %}
         {% if visible_submodules %}
Submodules
----------

.. toctree::
   :maxdepth: 1

            {% for submodule in visible_submodules %}
   {{ submodule.include_path }}
            {% endfor %}


         {% endif %}
      {% endblock %}
      {% block content %}
         {% set visible_children = obj.children|selectattr("display")|list %}
         {% if visible_children %}
            {% set visible_attributes = visible_children|selectattr("type", "equalto", "data")|list %}
            {% if visible_attributes %}
               {% if "attribute" in own_page_types or "show-module-summary" in autoapi_options %}
Attributes
----------

                  {% if "attribute" in own_page_types %}
.. toctree::
   :hidden:

                     {% for attribute in visible_attributes %}
   {{ attribute.include_path }}
                     {% endfor %}

                  {% endif %}
.. autoapisummary::

                  {% for attribute in visible_attributes %}
   {{ attribute.id }}
                  {% endfor %}
               {% endif %}


            {% endif %}
            {% set visible_exceptions = visible_children|selectattr("type", "equalto", "exception")|list %}
            {% if visible_exceptions %}
               {% if "exception" in own_page_types or "show-module-summary" in autoapi_options %}
Exceptions
----------

                  {% if "exception" in own_page_types %}
.. toctree::
   :hidden:

                     {% for exception in visible_exceptions %}
   {{ exception.include_path }}
                     {% endfor %}

                  {% endif %}
.. autoapisummary::

                  {% for exception in visible_exceptions %}
   {{ exception.id }}
                  {% endfor %}
               {% endif %}


            {% endif %}
            {% set visible_classes = visible_children|selectattr("type", "equalto", "class")|list %}
            {% if visible_classes %}
               {% if "class" in own_page_types or "show-module-summary" in autoapi_options %}
Classes
-------

                  {% if "class" in own_page_types %}
.. toctree::
   :hidden:

                     {% for klass in visible_classes %}
   {{ klass.include_path }}
                     {% endfor %}

                  {% endif %}
.. autoapisummary::

                  {% for klass in visible_classes %}
   {{ klass.id }}
                  {% endfor %}
               {% endif %}


            {% endif %}
            {% set visible_functions = visible_children|selectattr("type", "equalto", "function")|list %}
            {% if visible_functions %}
               {% if "function" in own_page_types or "show-module-summary" in autoapi_options %}
Functions
---------

                  {% if "function" in own_page_types %}
.. toctree::
   :hidden:

                     {% for function in visible_functions %}
   {{ function.include_path }}
                     {% endfor %}

                  {% endif %}
.. autoapisummary::

                  {% for function in visible_functions %}
   {{ function.id }}
                  {% endfor %}
               {% endif %}


            {% endif %}
            {% set this_page_children = visible_children|rejectattr("type", "in", own_page_types)|list %}
            {% if this_page_children %}
{{ obj.type|title }} Contents
{{ "-" * obj.type|length }}---------

               {% for obj_item in this_page_children %}
{{ obj_item.render()|indent(0) }}
               {% endfor %}
            {% endif %}
         {% endif %}
      {% endblock %}
   {% else %}
.. py:module:: {{ obj.name }}

      {% if obj.docstring %}
   .. autoapi-nested-parse::

      {{ obj.docstring|indent(6) }}

      {% endif %}
      {% for obj_item in visible_children %}
   {{ obj_item.render()|indent(3) }}
      {% endfor %}
   {% endif %}
{% endif %}
RST

cp "${PROJECT_DIR}/README.md" "${SOURCE_DIR}/index.md"
if [[ -d "${PROJECT_DIR}/docs" ]]; then
  mkdir -p "${SOURCE_DIR}/docs"
  cp "${PROJECT_DIR}"/docs/*.md "${SOURCE_DIR}/docs/"
fi
sed -i \
  -e "s|](examples/)|](${SOURCE_REPO_URL}/-/tree/${SOURCE_REVISION}/python/examples/)|g" \
  -e "s|](AGENTS.md)|](${SOURCE_REPO_URL}/-/blob/${SOURCE_REVISION}/python/AGENTS.md)|g" \
  "${SOURCE_DIR}/index.md"
cat >>"${SOURCE_DIR}/index.md" <<'MD'

```{toctree}
:maxdepth: 2
:caption: User Guide

docs/user-guide
docs/application-integration
docs/observer-composition
docs/historical-replay
docs/filter-categories
docs/examples
```

```{toctree}
:maxdepth: 2
:caption: API Reference

api/index
```
MD

rm -rf "${OUTPUT_DIR}"
mkdir -p "${OUTPUT_DIR}"

"${SPHINX_BUILD[@]}" -q -W --keep-going -b html "${SOURCE_DIR}" "${OUTPUT_DIR}"

echo "Python documentation generated in: ${OUTPUT_DIR}"
