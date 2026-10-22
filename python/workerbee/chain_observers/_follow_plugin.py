"""Parsing of ``custom_json`` operations of the follow plugin, shared by the follow/reblog filters and providers.

The filter of an action matches exactly when its provider has something to deliver for a tracked account, so both
parse the operation with the same rules.
"""

from __future__ import annotations

import json
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from collections.abc import Mapping

    from .payloads import FollowOperation, ReblogOperation


def parse_follow_operation(operation: Mapping[str, object]) -> FollowOperation | None:
    """The follow of a ``custom_json`` body (``["follow", {"follower", "following", "what"}]``), None for others."""
    payload = _follow_plugin_payload(operation, "follow")
    if payload is None:
        return None
    follower, following, what = payload.get("follower"), payload.get("following"), payload.get("what")
    if not isinstance(follower, str) or not isinstance(following, str) or not isinstance(what, list):
        return None
    return {"follower": follower, "following": following, "what": what}


def parse_reblog_operation(operation: Mapping[str, object]) -> ReblogOperation | None:
    """The reblog of a ``custom_json`` body (``["reblog", {"account", "author", "permlink"}]``), None for others."""
    payload = _follow_plugin_payload(operation, "reblog")
    if payload is None:
        return None
    account, author, permlink = payload.get("account"), payload.get("author"), payload.get("permlink")
    if not isinstance(account, str) or not isinstance(author, str) or not isinstance(permlink, str):
        return None
    return {"account": account, "author": author, "permlink": permlink}


def _follow_plugin_payload(operation: Mapping[str, object], action: str) -> dict[str, object] | None:
    """The payload of a ``custom_json`` of the follow plugin with the given action (e.g. ``reblog``) - None of others."""
    if operation.get("id") != "follow":
        return None
    json_payload = operation.get("json")
    if not isinstance(json_payload, str):
        return None
    try:
        parsed = json.loads(json_payload)
    except json.JSONDecodeError:
        return None
    if not isinstance(parsed, list) or len(parsed) < 2 or parsed[0] != action or not isinstance(parsed[1], dict):
        return None
    return parsed[1]
