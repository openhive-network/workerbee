# Observer Composition

`QueenBee` composes the filters you add before subscription. A filter is any
`on_*` method or custom `filter(...)` call. Provider methods such as
`provide_accounts(...)` add data to the notification payload after a composed
filter matches; they do not create another matching condition.

Use composition when one callback should handle a combined condition instead of
several independent subscriptions.

## Composition Rules

- Adjacent filters are combined with implicit OR.
- `or_` is the explicit OR operator. It is optional because OR is already the
  default between adjacent filters.
- `and_` ends the current OR group and starts the next OR group.
- At `subscribe(...)`, the final filter is an AND of all committed OR groups.
- Python uses `and_` and `or_` because `and` and `or` are Python keywords. The
  uppercase aliases `AND` and `OR` also exist, but the snake-case names are the
  preferred spelling.
- One `bot.observe` access returns one fresh builder. A builder can be subscribed
  once.

In concrete terms:

```text
A.or_.B.and_.C.or_.D
```

is evaluated as:

```text
(A OR B) AND (C OR D)
```

and:

```text
A.B.and_.C
```

is evaluated as:

```text
(A OR B) AND C
```

## Implicit OR

This registers one observer that matches activity impacting any selected account
or posts by either selected author. The snippet constructs and closes the chain;
it does not start a live bot.

```python
from typing import Self

from workerbee import ObserverNotification, WorkerBee
from workerbee.chain_observers.wax_api import WorkerBeeApiCollection


class DummyChain:
    def extends(self, api_collection: type[WorkerBeeApiCollection]) -> Self:
        return self


def handle(event: ObserverNotification) -> None:
    print(event)


bot = WorkerBee(DummyChain())
sub = (
    bot.observe
    .on_impacted_accounts("alice", "bob", "charlie")
    .on_posts("gtg", "blocktrades")
    .subscribe(on_next=handle, on_error=print)
)
sub.close()
print("implicit-or chain registered")
```

## Explicit `or_`

`or_` makes the same OR relationship visible in the chain.

```python
from typing import Self

from workerbee import ObserverNotification, WorkerBee
from workerbee.chain_observers.wax_api import WorkerBeeApiCollection


class DummyChain:
    def extends(self, api_collection: type[WorkerBeeApiCollection]) -> Self:
        return self


def handle(event: ObserverNotification) -> None:
    print(event)


bot = WorkerBee(DummyChain())
sub = (
    bot.observe
    .on_impacted_accounts("alice", "bob", "charlie")
    .or_
    .on_posts("gtg", "blocktrades")
    .subscribe(on_next=handle, on_error=print)
)
sub.close()
print("explicit-or chain registered")
```

## `and_`

`and_` requires the current OR group and the next OR group to both match in the
same notification cycle.

```python
from typing import Self

from workerbee import ManabarType, ObserverNotification, WorkerBee
from workerbee.chain_observers.wax_api import WorkerBeeApiCollection


class DummyChain:
    def extends(self, api_collection: type[WorkerBeeApiCollection]) -> Self:
        return self


def handle(event: ObserverNotification) -> None:
    print(event.get("new_accounts", []))


bot = WorkerBee(DummyChain())
sub = (
    bot.observe
    .on_accounts_full_manabar(ManabarType.RC, "initminer")
    .and_
    .on_new_account()
    .subscribe(on_next=handle, on_error=print)
)
sub.close()
print("and chain registered")
```

## Mixed OR and AND Groups

The next chain means:

```text
(initminer's RC manabar is full OR initminer's balance changed)
AND
(a new account was created)
```

```python
from typing import Self

from workerbee import ManabarType, ObserverNotification, WorkerBee
from workerbee.chain_observers.wax_api import WorkerBeeApiCollection


class DummyChain:
    def extends(self, api_collection: type[WorkerBeeApiCollection]) -> Self:
        return self


def handle(event: ObserverNotification) -> None:
    print(event)


bot = WorkerBee(DummyChain())
sub = (
    bot.observe
    .on_accounts_full_manabar(ManabarType.RC, "initminer")
    .or_
    .on_accounts_balance_change(False, "initminer")
    .and_
    .on_new_account()
    .subscribe(on_next=handle, on_error=print)
)
sub.close()
print("grouped chain registered")
```

## Providers Do Not Change Matching

Providers are payload enrichers. In this example, `provide_accounts("alice")`
does not make the observer match account data by itself; the observer still
matches on `on_impacted_accounts("alice")`.

```python
from typing import Self

from workerbee import ObserverNotification, WorkerBee
from workerbee.chain_observers.wax_api import WorkerBeeApiCollection


class DummyChain:
    def extends(self, api_collection: type[WorkerBeeApiCollection]) -> Self:
        return self


def handle(event: ObserverNotification) -> None:
    print(event.get("accounts", {}))


bot = WorkerBee(DummyChain())
sub = (
    bot.observe
    .on_impacted_accounts("alice")
    .provide_accounts("alice")
    .subscribe(on_next=handle, on_error=print)
)
sub.close()
print("provider chain registered")
```

## One Notification Per Cycle

A composed observer is registered as one listener. During one mediator
notification cycle, that listener's callback runs at most once. If two filters
inside the same OR group both match, the callback still receives one
notification for that subscription.

The next bounded example uses custom filters and a tiny local factory so it can
finish without a live Hive block stream.

```python
import asyncio

from workerbee.chain_observers import ObserverMediator, QueenBee
from workerbee.chain_observers.factories.factory_base import FactoryBase


class DemoFactory(FactoryBase):
    async def pre_notify(self, context, mediator):
        return True


class DemoWorker:
    chain = None

    def __init__(self):
        self.mediator = ObserverMediator(DemoFactory(self))


async def main():
    worker = DemoWorker()
    events = []

    sub = (
        QueenBee(worker)
        .filter(lambda data: True)
        .or_
        .filter(lambda data: True)
        .provide(lambda data: {"message": "both OR filters matched"})
        .subscribe(on_next=events.append)
    )

    await worker.mediator.notify()
    await worker.mediator.drain()
    sub.close()

    print(len(events))
    print(events[0])


asyncio.run(main())
```

Expected output:

```text
1
{'message': 'both OR filters matched'}
```

Separate subscriptions are separate listeners. If two independent subscriptions
match in the same cycle, each subscription can receive its own callback.

## Grouping Demonstration

This bounded example demonstrates the implemented grouping rule. The first
filter is true, but the second OR group is false, so the whole expression is
false:

```text
(True OR False) AND (False OR False)
```

```python
import asyncio

from workerbee.chain_observers import ObserverMediator, QueenBee
from workerbee.chain_observers.factories.factory_base import FactoryBase


class DemoFactory(FactoryBase):
    async def pre_notify(self, context, mediator):
        return True


class DemoWorker:
    chain = None

    def __init__(self):
        self.mediator = ObserverMediator(DemoFactory(self))


def returns(value):
    return lambda data: value


async def main():
    worker = DemoWorker()
    events = []

    sub = (
        QueenBee(worker)
        .filter(returns(True))
        .or_
        .filter(returns(False))
        .and_
        .filter(returns(False))
        .or_
        .filter(returns(False))
        .subscribe(on_next=events.append)
    )

    await worker.mediator.notify()
    await worker.mediator.drain()
    sub.close()

    print(len(events))


asyncio.run(main())
```

Expected output:

```text
0
```

## Open Questions

- The TypeScript README says "AND takes precedence over OR", but the TS and
  Python `QueenBee` implementations commit OR groups at `and_` and then AND
  those groups. This page documents the implementation as `(A OR B) AND
  (C OR D)` for `A.or_.B.and_.C.or_.D`; the public wording may need to be
  clarified if standard boolean precedence was intended.
- The TypeScript README says that multiple events in the same notification cycle
  are processed together. Python clearly delivers at most one callback per
  subscribed composed observer per mediator cycle, and providers read from the
  cycle's evaluation context. The exact provider-independent meaning of
  "processed together" is not specified beyond that.
