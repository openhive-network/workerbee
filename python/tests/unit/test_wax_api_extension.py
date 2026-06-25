"""Regression tests for the WorkerBee wax api extension (block_api binding).

wax's ``api_collection_factory`` instantiates each api in ``_API_MAP``
(class -> bound instance). It consumes ``_API_MAP`` *wholesale* — it does not
merge with the base collection's map. ``chain.extends(WorkerBeeApiCollection)``
builds ``class NewApi(WorkerBeeApiCollection, WaxApiCollection)``, so the
effective ``_API_MAP`` is resolved via the MRO: if ``WorkerBeeApiCollection``
only set ``block_api`` as an instance attribute (and relied on the inherited
``WaxApiCollection._API_MAP``), ``block_api`` would never be bound and would
stay the bare ``BlockApi`` class — making ``block_api.get_block()`` fail with
``missing 1 required positional argument: 'this'``.

These tests drive the real wax factory through the public chain API (offline —
constructing the chain and reading ``.api`` does not open a connection).
"""

from __future__ import annotations

import inspect

from hiveio_api.block_api import BlockApi
from hiveio_api.database_api import DatabaseApi
from wax import WaxChainOptions, create_hive_chain
from wax.api.collection import WaxApiCollection

from workerbee.chain_observers.wax_api import WorkerBeeApiCollection


def test_api_map_registers_block_api_alongside_standard_apis() -> None:
    api_map = WorkerBeeApiCollection._API_MAP
    # block_api must be in the map so the factory binds it to an instance.
    assert api_map["block_api"] is BlockApi
    # The map is consumed wholesale, so the standard wax apis must be preserved.
    assert set(api_map) >= set(WaxApiCollection._API_MAP)


def test_extends_binds_block_api_to_instance() -> None:
    chain = create_hive_chain(WaxChainOptions(endpoint_url="http://localhost:8090"))
    api = chain.extends(WorkerBeeApiCollection).api

    # block_api must be a bound instance, NOT the bare class.
    assert isinstance(api.block_api, BlockApi)
    assert api.block_api is not BlockApi
    assert inspect.ismethod(api.block_api.get_block)

    # The standard apis from the base collection must still be bound.
    assert isinstance(api.database_api, DatabaseApi)
