"""QueenBee — fluent observer builder for live blockchain data.

Mirrors src/queen.ts. Each on*() method pushes a filter operand and
(usually) a corresponding provider. subscribe() commits the filter
chain via LogicalAnd/Or composites and registers with the mediator.
"""

from __future__ import annotations

import asyncio
import inspect
from collections.abc import Mapping
from datetime import UTC, datetime
from typing import TYPE_CHECKING, Any, cast

from .filters.blank_filter import BlankFilter
from .filters.composite_filter import LogicalAndFilter, LogicalOrFilter
from .filters.filter_base import FilterBase
from .interfaces import IWorkerBee, Observer
from .observer_mediator import ObserverMediator
from .providers.provider_base import ProviderBase
from .utils import _validate_max_queue_size, calculate_relative_time

if TYPE_CHECKING:
    from collections.abc import AsyncIterator, Awaitable, Callable

    from .classifiers.collector_classifier_base import TRegisterEvaluationContext
    from .enums import ManabarType
    from .factories.data_evaluation_context import DataEvaluationContext
    from .interfaces import CompleteCallback, ErrorCallback, NextCallback, ObserverNotification

    # Typed contracts for the custom filter()/provide() escape hatches.
    FilterFn = Callable[[DataEvaluationContext], bool | Awaitable[bool]]
    ProviderFn = Callable[[DataEvaluationContext], Mapping[str, object] | Awaitable[Mapping[str, object]]]


class QueenBee:
    """Fluent builder for one WorkerBee observer subscription chain.

    Access it through :attr:`WorkerBee.observe`, add filters/providers with the
    ``on_*`` and ``provide_*`` methods, then call :meth:`subscribe` or iterate
    it asynchronously. A ``QueenBee`` instance is single-use once subscribed.
    """

    def __init__(self, worker: IWorkerBee, mediator: ObserverMediator | None = None) -> None:
        self.worker = worker
        self.mediator: ObserverMediator = mediator if mediator is not None else worker.mediator

        self._providers: dict[type[ProviderBase], ProviderBase] = {}
        self._operands: list[FilterBase] = []
        self._filter_containers: list[FilterBase] = []
        self._is_observer_locked = False

    def on_subscribe(self) -> None:
        """Lifecycle hook called after this chain is subscribed."""
        pass

    def on_unsubscribe(self) -> None:
        """Lifecycle hook called when this chain's subscription is closed."""
        pass

    def _push_operand(self, operand: FilterBase) -> None:
        operand.worker = self.worker
        self._operands.append(operand)

    def _push_provider(self, provider_class: type[ProviderBase], options: object | None = None) -> None:
        instance = self._providers.get(provider_class)
        if instance is None:
            instance = provider_class()
            self._providers[provider_class] = instance
        if options is not None:
            instance.push_options(options)

    def _apply_and(self) -> None:
        if self._operands:
            if len(self._operands) == 1:
                self._filter_containers.append(self._operands[0])
            else:
                self._filter_containers.append(LogicalOrFilter(self._operands))
            self._operands = []

    def subscribe(
        self,
        on_next: NextCallback | None = None,
        *,
        on_error: ErrorCallback | None = None,
        on_complete: CompleteCallback | None = None,
    ) -> Subscription:
        """Commit the filter chain and start delivering events to callbacks.

        Pass typed callbacks directly instead of a string-keyed dict. Each
        callback may be synchronous or ``async def``::

            sub = bot.observe.on_posts("alice").subscribe(
                on_next=handle, on_error=log,
            )
            ...
            sub.close()  # or: ``with sub: ...``
        """
        if self._is_observer_locked:
            raise RuntimeError("Double subscription not allowed. Each QueenBee instance can only be subscribed to once.")

        self._is_observer_locked = True
        self._apply_and()

        committed = self._filter_containers
        if not committed:
            committed.append(BlankFilter())

        and_filter: FilterBase = committed[0] if len(committed) == 1 else LogicalAndFilter(committed)

        observer = Observer(next=on_next, error=on_error, complete=on_complete)
        self.mediator.register_listener(observer, and_filter, list(self._providers.values()))

        self.on_subscribe()

        self._filter_containers = []
        self._providers = {}

        used_mediator = self.mediator
        queen = self

        return Subscription(observer, used_mediator, queen)

    def __aiter__(self) -> AsyncIterator[ObserverNotification]:
        """Iterate events from this observer chain with ``async for``::

            async for event in bot.observe.on_posts("alice"):
                await handle(event)  # ``await`` works here too

        The chain is subscribed on the first iteration. Pipeline errors
        propagate out of the ``async for``. The subscription is closed when the
        generator is finalized — on normal completion, an exception,
        cancellation, or an explicit ``aclose()``.

        Caveats:

        - A bare ``break`` does not finalize the generator immediately; cleanup
          is deferred to garbage collection / event-loop shutdown. For
          deterministic teardown on early exit, ``await`` the iterator's
          ``aclose()`` or use the callback API (``sub = ...subscribe(...)`` then
          ``sub.close()``), which gives explicit lifecycle control.
        - The default queue is unbounded for compatibility. Use
          :meth:`iterate` with ``max_queue_size > 0`` to bound queued events for
          this iterator when a consumer may be slower than block production.
        """
        return self.iterate()

    def iterate(self, *, max_queue_size: int = 0) -> AsyncIterator[ObserverNotification]:
        """Iterate events with an optional bounded buffer.

        ``max_queue_size=0`` keeps the historical unbounded queue. A positive
        value uses ``asyncio.Queue(maxsize=...)`` and awaits queue writes from
        the observer callbacks. The mediator still schedules listener pipelines
        fire-and-forget like TypeScript; the bound applies to this iterator's
        queued events, not to all mediator background work.
        """
        return self._aiter(max_queue_size=_validate_max_queue_size(max_queue_size))

    async def _aiter(self, *, max_queue_size: int = 0) -> AsyncIterator[ObserverNotification]:
        queue: asyncio.Queue[ObserverNotification | BaseException] = asyncio.Queue(maxsize=max_queue_size)

        async def on_next(data: ObserverNotification) -> None:
            await queue.put(data)

        async def on_error(err: BaseException) -> None:
            await queue.put(err)

        sub = self.subscribe(on_next=on_next, on_error=on_error)
        try:
            while True:
                item = await queue.get()
                if isinstance(item, BaseException):
                    raise item
                yield item
        finally:
            sub.close()

    # ---------------------------------------------------------------- logical

    @property
    def and_(self) -> QueenBee:
        """Start a new AND group in the fluent filter chain."""
        self._apply_and()
        return self

    @property
    def AND(self) -> QueenBee:
        """Uppercase alias for :attr:`and_`."""
        self._apply_and()
        return self

    @property
    def or_(self) -> QueenBee:
        """Continue adding alternatives to the current OR group."""
        return self

    @property
    def OR(self) -> QueenBee:
        """Uppercase alias for :attr:`or_`."""
        return self

    # ---------------------------------------------------------------- filters: blocks

    def on_block(self) -> QueenBee:
        """Match every new block and include block header data."""
        from .filters.new_block_filter import BlockChangedFilter
        from .providers.block_header_provider import BlockHeaderProvider

        self._push_operand(BlockChangedFilter())
        self._push_provider(BlockHeaderProvider)
        return self

    def on_block_number(self, number: int) -> QueenBee:
        """Match only the specified block number."""
        from .filters.block_filter import BlockNumberFilter

        self._push_operand(BlockNumberFilter(number))
        return self

    def on_transaction_ids(self, *transaction_ids: str) -> QueenBee:
        """Match transactions with any of the supplied transaction ids."""
        from .filters.transaction_id_filter import TransactionIdFilter
        from .providers.transaction_provider import TransactionByIdProvider

        self._push_operand(TransactionIdFilter(list(transaction_ids)))
        self._push_provider(TransactionByIdProvider, {"transaction_ids": list(transaction_ids)})
        return self

    # ---------------------------------------------------------------- filters: accounts

    def on_accounts_full_manabar(self, manabar_type: ManabarType | int, *accounts: str) -> QueenBee:
        """Match accounts whose selected manabar is effectively full."""
        return self.on_accounts_manabar_percent(manabar_type, 98, *accounts)

    def on_accounts_manabar_percent(self, manabar_type: ManabarType | int, percent: float, *accounts: str) -> QueenBee:
        """Match accounts whose selected manabar is at or above ``percent``."""
        from .filters.account_full_manabar_filter import AccountFullManabarFilter
        from .providers.manabar_provider import ManabarProvider

        accs = list(accounts)
        self._push_operand(AccountFullManabarFilter(accs, manabar_type, percent))
        self._push_provider(ManabarProvider, {"manabar_data": [{"account": a, "manabar_type": manabar_type} for a in accs]})
        return self

    def on_accounts_balance_change(self, include_internal_transfers: bool, *accounts: str) -> QueenBee:
        """Match when any selected account balance changes."""
        from .filters.balance_change_filter import BalanceChangeFilter
        from .providers.account_provider import AccountProvider

        accs = list(accounts)
        self._push_operand(BalanceChangeFilter(accs, include_internal_transfers))
        self._push_provider(AccountProvider, {"accounts": accs})
        return self

    def on_accounts_metadata_change(self, *accounts: str) -> QueenBee:
        """Match when account JSON or posting metadata changes."""
        from .filters.account_metadata_change_filter import AccountMetadataChangeFilter
        from .providers.account_provider import AccountProvider

        accs = list(accounts)
        self._push_operand(AccountMetadataChangeFilter(accs))
        self._push_provider(AccountProvider, {"accounts": accs})
        return self

    def on_impacted_accounts(self, *accounts: str) -> QueenBee:
        """Match operations that impact any selected account."""
        from .filters.impacted_account_filter import ImpactedAccountFilter
        from .providers.impacted_account_provider import ImpactedAccountProvider

        accs = list(accounts)
        self._push_operand(ImpactedAccountFilter(accs))
        self._push_provider(ImpactedAccountProvider, {"accounts": accs})
        return self

    def on_new_account(self) -> QueenBee:
        """Match account creation operations."""
        from .filters.account_created_filter import AccountCreatedFilter
        from .providers.new_account_provider import NewAccountProvider

        self._push_operand(AccountCreatedFilter())
        self._push_provider(NewAccountProvider)
        return self

    def on_alarm(self, *accounts: str) -> QueenBee:
        """Match recovery-related account alarm conditions."""
        from .filters.alarm_filter import AlarmFilter
        from .providers.alarm_provider import AlarmProvider

        accs = list(accounts)
        self._push_operand(AlarmFilter(accs))
        self._push_provider(AlarmProvider, {"accounts": accs})
        return self

    # ---------------------------------------------------------------- filters: social

    def on_votes(self, *voters: str) -> QueenBee:
        """Match vote operations cast by any selected voter."""
        from .filters.vote_filter import VoteFilter
        from .providers.vote_provider import VoteProvider

        v = list(voters)
        self._push_operand(VoteFilter(v))
        self._push_provider(VoteProvider, {"voters": v})
        return self

    def on_posts(self, *authors: str) -> QueenBee:
        """Match top-level posts by any selected author."""
        from .filters.blog_content_filter import PostFilter
        from .providers.post_provider import PostProvider

        a = list(authors)
        self._push_operand(PostFilter(a))
        self._push_provider(PostProvider, {"authors": a})
        return self

    def on_comments(self, *authors: str) -> QueenBee:
        """Match comments by any selected author."""
        from .filters.blog_content_filter import CommentFilter
        from .providers.comment_provider import CommentProvider

        a = list(authors)
        self._push_operand(CommentFilter(a))
        self._push_provider(CommentProvider, {"authors": [{"account": acc} for acc in a]})
        return self

    @staticmethod
    def _resolve_report_after_ms(relative_time_ms: int | str) -> int:
        # Mirrors src/queen.ts: a number is used as-is (ms before payout); a
        # relative string ("-30m", "-1h") becomes the elapsed offset in ms.
        if isinstance(relative_time_ms, int):
            return relative_time_ms
        now = datetime.now(UTC)
        return int((now - calculate_relative_time(relative_time_ms, now)).total_seconds() * 1000)

    def on_posts_incoming_payout(self, relative_time_ms: int | str, *authors: str) -> QueenBee:
        """Match selected posts whose payout is within the requested window."""
        from .filters.content_metadata_filter import PostMetadataFilter
        from .providers.content_metadata_provider import PostMetadataProvider

        a = list(authors)
        time_val = self._resolve_report_after_ms(relative_time_ms)
        self._push_operand(PostMetadataFilter(time_val, a))
        self._push_provider(PostMetadataProvider, {"authors": a})
        return self

    def on_comments_incoming_payout(self, relative_time_ms: int | str, *authors: str) -> QueenBee:
        """Match selected comments whose payout is within the requested window."""
        from .filters.content_metadata_filter import CommentMetadataFilter
        from .providers.content_metadata_provider import CommentMetadataProvider

        a = list(authors)
        time_val = self._resolve_report_after_ms(relative_time_ms)
        self._push_operand(CommentMetadataFilter(time_val, a))
        self._push_provider(CommentMetadataProvider, {"authors": a})
        return self

    def on_mention(self, *accounts: str) -> QueenBee:
        """Match posts that mention any selected account."""
        from .filters.post_mention_filter import PostMentionFilter
        from .providers.mention_provider import MentionedAccountProvider

        a = list(accounts)
        self._push_operand(PostMentionFilter(a))
        self._push_provider(MentionedAccountProvider, {"accounts": a})
        return self

    def on_reblog(self, *accounts: str) -> QueenBee:
        """Match legacy follow-plugin reblogs by any selected account."""
        from .filters.reblog_filter import ReblogFilter
        from .providers.reblog_provider import ReblogProvider

        a = list(accounts)
        self._push_operand(ReblogFilter(a))
        self._push_provider(ReblogProvider, {"accounts": a})
        return self

    def on_follow(self, *accounts: str) -> QueenBee:
        """Match legacy follow-plugin follows by any selected account."""
        from .filters.follow_filter import FollowFilter
        from .providers.follow_provider import FollowProvider

        a = list(accounts)
        self._push_operand(FollowFilter(a))
        self._push_provider(FollowProvider, {"accounts": a})
        return self

    def on_custom_operation(self, *ids: str | int) -> QueenBee:
        """Match custom_json operations with any selected id."""
        from .filters.custom_operation_filter import CustomOperationFilter
        from .providers.custom_operation_provider import CustomOperationProvider

        id_list: list[str | int] = list(ids)
        self._push_operand(CustomOperationFilter(id_list))
        self._push_provider(CustomOperationProvider, {"ids": id_list})
        return self

    # ---------------------------------------------------------------- filters: financial

    def on_feed_price_change(self, percent: float) -> QueenBee:
        """Match when the median feed price changes by at least ``percent``."""
        from .filters.feed_price_change_percent_filter import FeedPriceChangeFilter

        self._push_operand(FeedPriceChangeFilter(percent))
        return self

    def on_feed_price_no_change(self, last_hours_count: float = 24) -> QueenBee:
        """Match the TS-compatible feed-price unchanged window condition."""
        from .filters.feed_price_no_change_filter import FeedPriceNoChangeFilter

        self._push_operand(FeedPriceNoChangeFilter(last_hours_count))
        return self

    def on_whale_alert(self, asset: Any) -> QueenBee:
        """Match transfers greater than the supplied asset threshold."""
        from .filters.whale_alert_filter import WhaleAlertFilter
        from .providers.whale_alert_provider import WhaleAlertProvider

        self._push_operand(WhaleAlertFilter(asset))
        self._push_provider(WhaleAlertProvider, {"assets": [asset]})
        return self

    def on_exchange_transfer(self) -> QueenBee:
        """Match transfers involving known exchange accounts."""
        from .filters.exchange_transfer_filter import ExchangeTransferFilter
        from .providers.exchange_transfer_provider import ExchangeTransferProvider

        self._push_operand(ExchangeTransferFilter())
        self._push_provider(ExchangeTransferProvider)
        return self

    def on_internal_market_operation(self) -> QueenBee:
        """Match internal market order operations."""
        from .filters.internal_market_filter import InternalMarketFilter
        from .providers.internal_market_provider import InternalMarketProvider

        self._push_operand(InternalMarketFilter())
        self._push_provider(InternalMarketProvider)
        return self

    # ---------------------------------------------------------------- filters: governance

    def on_witnesses_missed_blocks(self, missed_blocks_min_count: int, *witnesses: str) -> QueenBee:
        """Match witnesses whose missed-block count reaches the threshold."""
        from .filters.witness_miss_block_filter import WitnessMissedBlocksFilter

        self._push_operand(WitnessMissedBlocksFilter(list(witnesses), missed_blocks_min_count))
        return self

    # ---------------------------------------------------------------- providers

    def provide_accounts(self, *accounts: str) -> QueenBee:
        """Include account data for selected accounts in notifications."""
        from .providers.account_provider import AccountProvider

        self._push_provider(AccountProvider, {"accounts": list(accounts)})
        return self

    def provide_witnesses(self, *witnesses: str) -> QueenBee:
        """Include witness data for selected witnesses in notifications."""
        from .providers.witness_provider import WitnessProvider

        self._push_provider(WitnessProvider, {"accounts": list(witnesses)})
        return self

    def provide_rc_accounts(self, *accounts: str) -> QueenBee:
        """Include RC account data for selected accounts in notifications."""
        from .providers.rc_account_provider import RcAccountProvider

        self._push_provider(RcAccountProvider, {"accounts": list(accounts)})
        return self

    def provide_block_header_data(self) -> QueenBee:
        """Include current block header data in notifications."""
        from .providers.block_header_provider import BlockHeaderProvider

        self._push_provider(BlockHeaderProvider)
        return self

    def provide_block_data(self) -> QueenBee:
        """Include current block transactions and transaction-id index."""
        from .providers.block_provider import BlockProvider

        self._push_provider(BlockProvider)
        return self

    def provide_feed_price_data(self) -> QueenBee:
        """Include current feed price data in notifications."""
        from .providers.feed_price_provider import FeedPriceProvider

        self._push_provider(FeedPriceProvider)
        return self

    def provide_manabar_data(self, manabar_type: ManabarType | int, *accounts: str) -> QueenBee:
        """Include selected manabar data for selected accounts."""
        from .providers.manabar_provider import ManabarProvider

        self._push_provider(ManabarProvider, {"manabar_data": [{"account": a, "manabar_type": manabar_type} for a in accounts]})
        return self

    # ---------------------------------------------------------------- custom

    def filter(self, predicate: FilterFn | FilterBase | object) -> QueenBee:
        """Add a custom filter from a predicate or filter object.

        Bare callables behave as ``(data) -> bool``. Filter objects mirror the
        TypeScript extension point: ``match(data)`` is called, and an optional
        ``used_contexts()`` declaration is forwarded to the mediator so custom
        classifiers are registered before evaluation.
        """
        if isinstance(predicate, FilterBase):
            self._push_operand(predicate)
            return self

        object_match = getattr(predicate, "match", None)
        if callable(object_match):
            custom_filter = predicate
            object_match_fn = cast("Callable[[DataEvaluationContext], object]", object_match)

            class _ObjectFilter(FilterBase):
                def used_contexts(self) -> list[TRegisterEvaluationContext]:
                    used_contexts = getattr(custom_filter, "used_contexts", None)
                    if callable(used_contexts):
                        contexts = used_contexts()
                        if contexts is not None:
                            return list(contexts)
                    return super().used_contexts()

                async def match(self, data: DataEvaluationContext) -> bool:
                    result = object_match_fn(data)
                    if inspect.isawaitable(result):
                        return bool(await result)
                    return bool(result)

            self._push_operand(_ObjectFilter())
            return self

        if not callable(predicate):
            raise TypeError("filter() expects a callable predicate or an object with match(data)")

        predicate_fn = cast("FilterFn", predicate)

        class _InlineFilter(FilterBase):
            async def match(self, data: DataEvaluationContext) -> bool:
                result = predicate_fn(data)
                if inspect.isawaitable(result):
                    return bool(await result)
                return bool(result)

        self._push_operand(_InlineFilter())
        return self

    def provide(self, provider: ProviderFn | ProviderBase | object, options: object | None = None) -> QueenBee:
        """Add a custom provider from a function or provider object.

        The returned dict is merged into the event payload delivered to
        subscribers. Provider objects mirror the TypeScript extension point:
        ``provide(data)`` is called, optional ``used_contexts()`` declarations
        are forwarded, and ``options`` is passed to ``push_options()`` when
        present.
        """
        object_provide = getattr(provider, "provide", None)
        if callable(object_provide):
            custom_provider = provider
            object_provide_fn = cast("Callable[[DataEvaluationContext], object]", object_provide)

            class _ObjectProvider(ProviderBase):
                def used_contexts(self) -> list[TRegisterEvaluationContext]:
                    used_contexts = getattr(custom_provider, "used_contexts", None)
                    if callable(used_contexts):
                        contexts = used_contexts()
                        if contexts is not None:
                            return list(contexts)
                    return super().used_contexts()

                def push_options(self, options: object) -> None:
                    push_options = getattr(custom_provider, "push_options", None)
                    if callable(push_options):
                        push_options(options)

                async def provide(self, data: DataEvaluationContext) -> Mapping[str, object]:
                    result = object_provide_fn(data)
                    if inspect.isawaitable(result):
                        result = await result
                    return result if isinstance(result, Mapping) else {}

            self._push_provider(_ObjectProvider, options)
            return self

        if not callable(provider):
            raise TypeError("provide() expects a callable or an object with provide(data)")
        if options is not None:
            raise TypeError("provide() options require a provider object with push_options(options)")

        provider_fn = cast("Callable[[DataEvaluationContext], object]", provider)

        class _InlineProvider(ProviderBase):
            async def provide(self, data: DataEvaluationContext) -> Mapping[str, object]:
                result = provider_fn(data)
                if inspect.isawaitable(result):
                    result = await result
                return result if isinstance(result, Mapping) else {}

        self._push_provider(_InlineProvider)
        return self

    def filter_piped(
        self,
        provider_fn: Callable[..., object | Awaitable[object]],
        filter_fn: Callable[..., bool | Awaitable[bool]],
    ) -> QueenBee:
        """Run ``provider_fn`` before ``filter_fn`` and expose its data if matched."""
        from .classifiers.collector_classifier_base import CollectorClassifierBase

        class _InlineClassifier(CollectorClassifierBase[object]):
            pass

        class _PipedFilter(FilterBase):
            async def match(self, data: DataEvaluationContext) -> bool:
                provided = provider_fn(data)
                if inspect.isawaitable(provided):
                    provided = await provided
                store = data.access_store(_InlineClassifier)
                store["piped_data"] = provided
                result = filter_fn(provided, data)
                if inspect.isawaitable(result):
                    return bool(await result)
                return bool(result)

        class _PipedProvider(ProviderBase):
            async def provide(self, data: DataEvaluationContext) -> dict[str, object]:
                store = data.access_store(_InlineClassifier)
                result: dict[str, object] = store.get("piped_data", {})
                return result

        self._push_operand(_PipedFilter())
        self._push_provider(_PipedProvider)
        return self


class Subscription:
    """Handle to an active subscription.

    Close it explicitly with :meth:`close`, or use it as a context manager so
    it is torn down on block exit::

        with bot.observe.on_block().subscribe(on_next=handle):
            ...  # auto-closed here
    """

    def __init__(self, observer: Observer, mediator: ObserverMediator, queen: QueenBee) -> None:
        self._observer = observer
        self._mediator = mediator
        self._queen = queen
        self._closed = False

    @property
    def timings(self) -> dict[str, float]:
        """Latest pipeline timing data for this subscription's mediator."""
        return self._mediator.timings

    def close(self) -> None:
        """Stop delivering events and unregister this subscription.

        Idempotent: closing an already-closed subscription is a no-op.
        """
        if self._closed:
            return
        self._closed = True
        self._mediator.unregister_listener(self._observer)
        self._queen.on_unsubscribe()

    def __enter__(self) -> Subscription:
        return self

    def __exit__(self, *args: object) -> None:
        self.close()
