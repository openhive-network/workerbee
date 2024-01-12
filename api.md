
<a name="_modulesmd"></a>

# @hive-staging/workerbee

## Interfaces

- [IBlockData](#interfacesiblockdatamd)
- [IBroadcastOptions](#interfacesibroadcastoptionsmd)
- [IOperationData](#interfacesioperationdatamd)
- [IQueenBee](#interfacesiqueenbeemd)
- [IStartConfiguration](#interfacesistartconfigurationmd)
- [ITransactionData](#interfacesitransactiondatamd)
- [IWorkerBee](#interfacesiworkerbeemd)
- [IWorkerBeeConstructor](#interfacesiworkerbeeconstructormd)

## Variables

### default

• **default**: [`IWorkerBeeConstructor`](#interfacesiworkerbeeconstructormd)

#### Defined in

src/web.ts:8


<a name="interfacesiblockdatamd"></a>

# Interface: IBlockData

## Properties

### block

• **block**: `ApiBlock`

#### Defined in

src/interfaces.ts:9

___

### number

• **number**: `number`

#### Defined in

src/interfaces.ts:8


<a name="interfacesibroadcastoptionsmd"></a>

# Interface: IBroadcastOptions

## Properties

### throwAfter

• `Optional` **throwAfter**: `string` \| `number` \| `Date`

Can be either absolute time that will be passed to the Date constructor
or relative time, like: "+10s", "+2m", "+1h"

**`Default`**

```ts
undefined
```

#### Defined in

src/interfaces.ts:73


<a name="interfacesioperationdatamd"></a>

# Interface: IOperationData

## Properties

### op

• **op**: `operation`

#### Defined in

src/interfaces.ts:19

___

### transaction

• **transaction**: [`ITransactionData`](#interfacesitransactiondatamd)

#### Defined in

src/interfaces.ts:20


<a name="interfacesiqueenbeemd"></a>

# Interface: IQueenBee

## Methods

### accountFullManabar

▸ **accountFullManabar**(`name`): `Subscribable`\<`ApiAccount`\>

Observes given account and notifies when its manabar is 98 percent loaded
Note: This function will be called on every new block detected if manabar is full on every new block

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `name` | `string` | account name to observe |

#### Returns

`Subscribable`\<`ApiAccount`\>

subscribable object that will call `next` each time time its manabar is 98 percent loaded

#### Defined in

src/interfaces.ts:62

___

### accountOperations

▸ **accountOperations**(`name`): `Subscribable`\<[`IOperationData`](#interfacesioperationdatamd)\>

Observes given account and notifies when new operation in blockchain related to the given account is detected (no virtual operations for now)

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `name` | `string` | account name to observe |

#### Returns

`Subscribable`\<[`IOperationData`](#interfacesioperationdatamd)\>

subscribable object that will call `next` on every operation related to the given account

#### Defined in

src/interfaces.ts:53

___

### block

▸ **block**(`blockId`): `Subscribable`\<[`IBlockData`](#interfacesiblockdatamd)\>

Observes block with given id and notifies on its detection

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `blockId` | `string` | block id to observe |

#### Returns

`Subscribable`\<[`IBlockData`](#interfacesiblockdatamd)\>

subscribable object that will call `next` only once and completes

#### Defined in

src/interfaces.ts:30

▸ **block**(`blockNumber`): `Subscribable`\<[`IBlockData`](#interfacesiblockdatamd)\>

Observes block with given number and notifies on its detection

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `blockNumber` | `number` | block number to observe |

#### Returns

`Subscribable`\<[`IBlockData`](#interfacesiblockdatamd)\>

subscribable object that will call `next` only once and completes

#### Defined in

src/interfaces.ts:37

___

### transaction

▸ **transaction**(`transactionId`): `Subscribable`\<[`ITransactionData`](#interfacesitransactiondatamd)\>

Observes transaction with given id and notifies on its detection

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `transactionId` | `string` | transaction id to observe |

#### Returns

`Subscribable`\<[`ITransactionData`](#interfacesitransactiondatamd)\>

subscribable object that will call `next` only once and completes

#### Defined in

src/interfaces.ts:45


<a name="interfacesistartconfigurationmd"></a>

# Interface: IStartConfiguration

## Properties

### beekeeperOptions

• `Optional` **beekeeperOptions**: `Partial`\<`IBeekeeperOptions`\>

Beekeeper wallet options

**`Default`**

```ts
{}
```

#### Defined in

src/bot.ts:28

___

### chainOptions

• `Optional` **chainOptions**: `Partial`\<`IWaxOptionsChain`\>

Wax chain options

**`Default`**

```ts
{}
```

#### Defined in

src/bot.ts:20


<a name="interfacesitransactiondatamd"></a>

# Interface: ITransactionData

## Properties

### block

• **block**: [`IBlockData`](#interfacesiblockdatamd)

#### Defined in

src/interfaces.ts:15

___

### id

• **id**: `string`

#### Defined in

src/interfaces.ts:13

___

### transaction

• **transaction**: `ApiTransaction`

#### Defined in

src/interfaces.ts:14


<a name="interfacesiworkerbeemd"></a>

# Interface: IWorkerBee

## Hierarchy

- `EventEmitter`

  ↳ **`IWorkerBee`**

## Properties

### chain

• `Optional` `Readonly` **chain**: `Readonly`\<`IHiveChainInterface`\>

Exposed hive chain interface we are using.
May be undefined if you have not already started our bot.

Remember that chain property will be initialized during [start](#start) call and uninitialized durin [delete](#delete)

#### Defined in

src/interfaces.ts:86

___

### configuration

• `Readonly` **configuration**: `Readonly`\<[`IStartConfiguration`](#interfacesistartconfigurationmd)\>

#### Defined in

src/interfaces.ts:78

___

### observe

• `Readonly` **observe**: [`IQueenBee`](#interfacesiqueenbeemd)

#### Defined in

src/interfaces.ts:105

___

### running

• `Readonly` **running**: `boolean`

#### Defined in

src/interfaces.ts:77

## Methods

### [asyncIterator]

▸ **[asyncIterator]**(): `AsyncIterator`\<[`IBlockData`](#interfacesiblockdatamd), `any`, `undefined`\>

Allows you to iterate over blocks indefinitely

#### Returns

`AsyncIterator`\<[`IBlockData`](#interfacesiblockdatamd), `any`, `undefined`\>

#### Defined in

src/interfaces.ts:123

___

### addListener

▸ **addListener**(`eventName`, `listener`): [`IWorkerBee`](#interfacesiworkerbeemd)

Alias for `emitter.on(eventName, listener)`.

#### Parameters

| Name | Type |
| :------ | :------ |
| `eventName` | `string` \| `symbol` |
| `listener` | (...`args`: `any`[]) => `void` |

#### Returns

[`IWorkerBee`](#interfacesiworkerbeemd)

**`Since`**

v0.1.26

#### Inherited from

EventEmitter.addListener

#### Defined in

node_modules/.pnpm/@types+node@20.7.1/node_modules/@types/node/events.d.ts:462

___

### broadcast

▸ **broadcast**(`tx`, `options?`): `Promise`\<`Subscribable`\<[`ITransactionData`](#interfacesitransactiondatamd)\>\>

Broadcast given transaction to the remote and returns a subscribable object
that calls error after [throwAfter](#interfacesibroadcastoptionsmd) time (if given)
If [throwAfter](#interfacesibroadcastoptionsmd) has not been specified, it is automatically
set to the transaction expiration time plus one minute

Requires signed transaction

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `tx` | `transaction` | Protobuf transactoin to broadcast |
| `options?` | [`IBroadcastOptions`](#interfacesibroadcastoptionsmd) | Options for broadcasting |

#### Returns

`Promise`\<`Subscribable`\<[`ITransactionData`](#interfacesitransactiondatamd)\>\>

#### Defined in

src/interfaces.ts:118

___

### delete

▸ **delete**(): `Promise`\<`void`\>

Deletes the current bot instance and underlying wax and beekepeer objects

#### Returns

`Promise`\<`void`\>

#### Defined in

src/interfaces.ts:103

___

### emit

▸ **emit**(`eventName`, `...args`): `boolean`

Synchronously calls each of the listeners registered for the event named`eventName`, in the order they were registered, passing the supplied arguments
to each.

Returns `true` if the event had listeners, `false` otherwise.

```js
import { EventEmitter } from 'node:events';
const myEmitter = new EventEmitter();

// First listener
myEmitter.on('event', function firstListener() {
  console.log('Helloooo! first listener');
});
// Second listener
myEmitter.on('event', function secondListener(arg1, arg2) {
  console.log(`event with parameters ${arg1}, ${arg2} in second listener`);
});
// Third listener
myEmitter.on('event', function thirdListener(...args) {
  const parameters = args.join(', ');
  console.log(`event with parameters ${parameters} in third listener`);
});

console.log(myEmitter.listeners('event'));

myEmitter.emit('event', 1, 2, 3, 4, 5);

// Prints:
// [
//   [Function: firstListener],
//   [Function: secondListener],
//   [Function: thirdListener]
// ]
// Helloooo! first listener
// event with parameters 1, 2 in second listener
// event with parameters 1, 2, 3, 4, 5 in third listener
```

#### Parameters

| Name | Type |
| :------ | :------ |
| `eventName` | `string` \| `symbol` |
| `...args` | `any`[] |

#### Returns

`boolean`

**`Since`**

v0.1.26

#### Inherited from

EventEmitter.emit

#### Defined in

node_modules/.pnpm/@types+node@20.7.1/node_modules/@types/node/events.d.ts:724

___

### eventNames

▸ **eventNames**(): (`string` \| `symbol`)[]

Returns an array listing the events for which the emitter has registered
listeners. The values in the array are strings or `Symbol`s.

```js
import { EventEmitter } from 'node:events';

const myEE = new EventEmitter();
myEE.on('foo', () => {});
myEE.on('bar', () => {});

const sym = Symbol('symbol');
myEE.on(sym, () => {});

console.log(myEE.eventNames());
// Prints: [ 'foo', 'bar', Symbol(symbol) ]
```

#### Returns

(`string` \| `symbol`)[]

**`Since`**

v6.0.0

#### Inherited from

EventEmitter.eventNames

#### Defined in

node_modules/.pnpm/@types+node@20.7.1/node_modules/@types/node/events.d.ts:787

___

### getMaxListeners

▸ **getMaxListeners**(): `number`

Returns the current max listener value for the `EventEmitter` which is either
set by `emitter.setMaxListeners(n)` or defaults to defaultMaxListeners.

#### Returns

`number`

**`Since`**

v1.0.0

#### Inherited from

EventEmitter.getMaxListeners

#### Defined in

node_modules/.pnpm/@types+node@20.7.1/node_modules/@types/node/events.d.ts:639

___

### listenerCount

▸ **listenerCount**(`eventName`, `listener?`): `number`

Returns the number of listeners listening for the event named `eventName`.
If `listener` is provided, it will return how many times the listener is found
in the list of the listeners of the event.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `eventName` | `string` \| `symbol` | The name of the event being listened for |
| `listener?` | `Function` | The event handler function |

#### Returns

`number`

**`Since`**

v3.2.0

#### Inherited from

EventEmitter.listenerCount

#### Defined in

node_modules/.pnpm/@types+node@20.7.1/node_modules/@types/node/events.d.ts:733

___

### listeners

▸ **listeners**(`eventName`): `Function`[]

Returns a copy of the array of listeners for the event named `eventName`.

```js
server.on('connection', (stream) => {
  console.log('someone connected!');
});
console.log(util.inspect(server.listeners('connection')));
// Prints: [ [Function] ]
```

#### Parameters

| Name | Type |
| :------ | :------ |
| `eventName` | `string` \| `symbol` |

#### Returns

`Function`[]

**`Since`**

v0.1.26

#### Inherited from

EventEmitter.listeners

#### Defined in

node_modules/.pnpm/@types+node@20.7.1/node_modules/@types/node/events.d.ts:652

___

### off

▸ **off**(`eventName`, `listener`): [`IWorkerBee`](#interfacesiworkerbeemd)

Alias for `emitter.removeListener()`.

#### Parameters

| Name | Type |
| :------ | :------ |
| `eventName` | `string` \| `symbol` |
| `listener` | (...`args`: `any`[]) => `void` |

#### Returns

[`IWorkerBee`](#interfacesiworkerbeemd)

**`Since`**

v10.0.0

#### Inherited from

EventEmitter.off

#### Defined in

node_modules/.pnpm/@types+node@20.7.1/node_modules/@types/node/events.d.ts:612

___

### on

▸ **on**(`event`, `handler`): [`IWorkerBee`](#interfacesiworkerbeemd)

Triggers on any bot start

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `event` | ``"start"`` | event name |
| `handler` | () => `void` | handler to be called before automation start |

#### Returns

[`IWorkerBee`](#interfacesiworkerbeemd)

#### Overrides

EventEmitter.on

#### Defined in

src/interfaces.ts:131

▸ **on**(`event`, `handler`): [`IWorkerBee`](#interfacesiworkerbeemd)

Triggers on any bot stop

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `event` | ``"stop"`` | event name |
| `handler` | () => `void` | handler to be called after complete stop of the automation |

#### Returns

[`IWorkerBee`](#interfacesiworkerbeemd)

#### Overrides

EventEmitter.on

#### Defined in

src/interfaces.ts:138

▸ **on**(`event`, `handler`): [`IWorkerBee`](#interfacesiworkerbeemd)

Triggers on any bot-related error

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `event` | ``"error"`` | event name |
| `handler` | (`error`: `Error`) => `void` | handler to be called on error event |

#### Returns

[`IWorkerBee`](#interfacesiworkerbeemd)

#### Overrides

EventEmitter.on

#### Defined in

src/interfaces.ts:145

▸ **on**(`event`, `handler`): [`IWorkerBee`](#interfacesiworkerbeemd)

Triggers on new block detected

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `event` | ``"block"`` | event name |
| `handler` | (`data`: [`IBlockData`](#interfacesiblockdatamd)) => `void` | handler to be called on new block event |

#### Returns

[`IWorkerBee`](#interfacesiworkerbeemd)

#### Overrides

EventEmitter.on

#### Defined in

src/interfaces.ts:152

▸ **on**(`event`, `handler`): [`IWorkerBee`](#interfacesiworkerbeemd)

Triggers on new transaction detected

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `event` | ``"transaction"`` | event name |
| `handler` | (`data`: [`ITransactionData`](#interfacesitransactiondatamd)) => `void` | handler to be called on new block event |

#### Returns

[`IWorkerBee`](#interfacesiworkerbeemd)

#### Overrides

EventEmitter.on

#### Defined in

src/interfaces.ts:159

___

### once

▸ **once**(`eventName`, `listener`): [`IWorkerBee`](#interfacesiworkerbeemd)

Adds a **one-time**`listener` function for the event named `eventName`. The
next time `eventName` is triggered, this listener is removed and then invoked.

```js
server.once('connection', (stream) => {
  console.log('Ah, we have our first user!');
});
```

Returns a reference to the `EventEmitter`, so that calls can be chained.

By default, event listeners are invoked in the order they are added. The`emitter.prependOnceListener()` method can be used as an alternative to add the
event listener to the beginning of the listeners array.

```js
import { EventEmitter } from 'node:events';
const myEE = new EventEmitter();
myEE.once('foo', () => console.log('a'));
myEE.prependOnceListener('foo', () => console.log('b'));
myEE.emit('foo');
// Prints:
//   b
//   a
```

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `eventName` | `string` \| `symbol` | The name of the event. |
| `listener` | (...`args`: `any`[]) => `void` | The callback function |

#### Returns

[`IWorkerBee`](#interfacesiworkerbeemd)

**`Since`**

v0.3.0

#### Inherited from

EventEmitter.once

#### Defined in

node_modules/.pnpm/@types+node@20.7.1/node_modules/@types/node/events.d.ts:524

___

### prependListener

▸ **prependListener**(`eventName`, `listener`): [`IWorkerBee`](#interfacesiworkerbeemd)

Adds the `listener` function to the _beginning_ of the listeners array for the
event named `eventName`. No checks are made to see if the `listener` has
already been added. Multiple calls passing the same combination of `eventName`and `listener` will result in the `listener` being added, and called, multiple
times.

```js
server.prependListener('connection', (stream) => {
  console.log('someone connected!');
});
```

Returns a reference to the `EventEmitter`, so that calls can be chained.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `eventName` | `string` \| `symbol` | The name of the event. |
| `listener` | (...`args`: `any`[]) => `void` | The callback function |

#### Returns

[`IWorkerBee`](#interfacesiworkerbeemd)

**`Since`**

v6.0.0

#### Inherited from

EventEmitter.prependListener

#### Defined in

node_modules/.pnpm/@types+node@20.7.1/node_modules/@types/node/events.d.ts:751

___

### prependOnceListener

▸ **prependOnceListener**(`eventName`, `listener`): [`IWorkerBee`](#interfacesiworkerbeemd)

Adds a **one-time**`listener` function for the event named `eventName` to the _beginning_ of the listeners array. The next time `eventName` is triggered, this
listener is removed, and then invoked.

```js
server.prependOnceListener('connection', (stream) => {
  console.log('Ah, we have our first user!');
});
```

Returns a reference to the `EventEmitter`, so that calls can be chained.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `eventName` | `string` \| `symbol` | The name of the event. |
| `listener` | (...`args`: `any`[]) => `void` | The callback function |

#### Returns

[`IWorkerBee`](#interfacesiworkerbeemd)

**`Since`**

v6.0.0

#### Inherited from

EventEmitter.prependOnceListener

#### Defined in

node_modules/.pnpm/@types+node@20.7.1/node_modules/@types/node/events.d.ts:767

___

### rawListeners

▸ **rawListeners**(`eventName`): `Function`[]

Returns a copy of the array of listeners for the event named `eventName`,
including any wrappers (such as those created by `.once()`).

```js
import { EventEmitter } from 'node:events';
const emitter = new EventEmitter();
emitter.once('log', () => console.log('log once'));

// Returns a new Array with a function `onceWrapper` which has a property
// `listener` which contains the original listener bound above
const listeners = emitter.rawListeners('log');
const logFnWrapper = listeners[0];

// Logs "log once" to the console and does not unbind the `once` event
logFnWrapper.listener();

// Logs "log once" to the console and removes the listener
logFnWrapper();

emitter.on('log', () => console.log('log persistently'));
// Will return a new Array with a single function bound by `.on()` above
const newListeners = emitter.rawListeners('log');

// Logs "log persistently" twice
newListeners[0]();
emitter.emit('log');
```

#### Parameters

| Name | Type |
| :------ | :------ |
| `eventName` | `string` \| `symbol` |

#### Returns

`Function`[]

**`Since`**

v9.4.0

#### Inherited from

EventEmitter.rawListeners

#### Defined in

node_modules/.pnpm/@types+node@20.7.1/node_modules/@types/node/events.d.ts:683

___

### removeAllListeners

▸ **removeAllListeners**(`event?`): [`IWorkerBee`](#interfacesiworkerbeemd)

Removes all listeners, or those of the specified `eventName`.

It is bad practice to remove listeners added elsewhere in the code,
particularly when the `EventEmitter` instance was created by some other
component or module (e.g. sockets or file streams).

Returns a reference to the `EventEmitter`, so that calls can be chained.

#### Parameters

| Name | Type |
| :------ | :------ |
| `event?` | `string` \| `symbol` |

#### Returns

[`IWorkerBee`](#interfacesiworkerbeemd)

**`Since`**

v0.1.26

#### Inherited from

EventEmitter.removeAllListeners

#### Defined in

node_modules/.pnpm/@types+node@20.7.1/node_modules/@types/node/events.d.ts:623

___

### removeListener

▸ **removeListener**(`eventName`, `listener`): [`IWorkerBee`](#interfacesiworkerbeemd)

Removes the specified `listener` from the listener array for the event named`eventName`.

```js
const callback = (stream) => {
  console.log('someone connected!');
};
server.on('connection', callback);
// ...
server.removeListener('connection', callback);
```

`removeListener()` will remove, at most, one instance of a listener from the
listener array. If any single listener has been added multiple times to the
listener array for the specified `eventName`, then `removeListener()` must be
called multiple times to remove each instance.

Once an event is emitted, all listeners attached to it at the
time of emitting are called in order. This implies that any`removeListener()` or `removeAllListeners()` calls _after_ emitting and _before_ the last listener finishes execution
will not remove them from`emit()` in progress. Subsequent events behave as expected.

```js
import { EventEmitter } from 'node:events';
class MyEmitter extends EventEmitter {}
const myEmitter = new MyEmitter();

const callbackA = () => {
  console.log('A');
  myEmitter.removeListener('event', callbackB);
};

const callbackB = () => {
  console.log('B');
};

myEmitter.on('event', callbackA);

myEmitter.on('event', callbackB);

// callbackA removes listener callbackB but it will still be called.
// Internal listener array at time of emit [callbackA, callbackB]
myEmitter.emit('event');
// Prints:
//   A
//   B

// callbackB is now removed.
// Internal listener array [callbackA]
myEmitter.emit('event');
// Prints:
//   A
```

Because listeners are managed using an internal array, calling this will
change the position indices of any listener registered _after_ the listener
being removed. This will not impact the order in which listeners are called,
but it means that any copies of the listener array as returned by
the `emitter.listeners()` method will need to be recreated.

When a single function has been added as a handler multiple times for a single
event (as in the example below), `removeListener()` will remove the most
recently added instance. In the example the `once('ping')`listener is removed:

```js
import { EventEmitter } from 'node:events';
const ee = new EventEmitter();

function pong() {
  console.log('pong');
}

ee.on('ping', pong);
ee.once('ping', pong);
ee.removeListener('ping', pong);

ee.emit('ping');
ee.emit('ping');
```

Returns a reference to the `EventEmitter`, so that calls can be chained.

#### Parameters

| Name | Type |
| :------ | :------ |
| `eventName` | `string` \| `symbol` |
| `listener` | (...`args`: `any`[]) => `void` |

#### Returns

[`IWorkerBee`](#interfacesiworkerbeemd)

**`Since`**

v0.1.26

#### Inherited from

EventEmitter.removeListener

#### Defined in

node_modules/.pnpm/@types+node@20.7.1/node_modules/@types/node/events.d.ts:607

___

### setMaxListeners

▸ **setMaxListeners**(`n`): [`IWorkerBee`](#interfacesiworkerbeemd)

By default `EventEmitter`s will print a warning if more than `10` listeners are
added for a particular event. This is a useful default that helps finding
memory leaks. The `emitter.setMaxListeners()` method allows the limit to be
modified for this specific `EventEmitter` instance. The value can be set to`Infinity` (or `0`) to indicate an unlimited number of listeners.

Returns a reference to the `EventEmitter`, so that calls can be chained.

#### Parameters

| Name | Type |
| :------ | :------ |
| `n` | `number` |

#### Returns

[`IWorkerBee`](#interfacesiworkerbeemd)

**`Since`**

v0.3.5

#### Inherited from

EventEmitter.setMaxListeners

#### Defined in

node_modules/.pnpm/@types+node@20.7.1/node_modules/@types/node/events.d.ts:633

___

### start

▸ **start**(`wallet?`): `Promise`\<`void`\>

Starts the automation with given configuration

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `wallet?` | `IBeekeeperUnlockedWallet` | optional unlocked beekeper wallet for bot operations |

#### Returns

`Promise`\<`void`\>

#### Defined in

src/interfaces.ts:93

___

### stop

▸ **stop**(): `Promise`\<`void`\>

Request automation stop

#### Returns

`Promise`\<`void`\>

#### Defined in

src/interfaces.ts:98


<a name="interfacesiworkerbeeconstructormd"></a>

# Interface: IWorkerBeeConstructor

## Constructors

### constructor

• **new IWorkerBeeConstructor**(`configuration?`): [`IWorkerBee`](#interfacesiworkerbeemd)

Constructs new WorkerBee bot object

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `configuration?` | `Partial`\<[`IStartConfiguration`](#interfacesistartconfigurationmd)\> | Configuration for the automation |

#### Returns

[`IWorkerBee`](#interfacesiworkerbeemd)

#### Defined in

src/interfaces.ts:168
