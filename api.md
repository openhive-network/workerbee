
<a name="_modulesmd"></a>

# @hive-staging/autobee

## Interfaces

- [IAutoBee](#interfacesiautobeemd)
- [IStartConfiguration](#interfacesistartconfigurationmd)

## Variables

### default

• **default**: `IAutoBeeConstructor`

#### Defined in

src/index.ts:8


<a name="interfacesiautobeemd"></a>

# Interface: IAutoBee

## Properties

### configuration

• `Readonly` **configuration**: `Readonly`\<[`IStartConfiguration`](#interfacesistartconfigurationmd)\>

#### Defined in

src/interfaces.ts:11

___

### running

• `Readonly` **running**: `boolean`

#### Defined in

src/interfaces.ts:10

## Methods

### delete

▸ **delete**(): `Promise`\<`void`\>

Deletes the current bot instance and underlying wax and beekepeer objects

#### Returns

`Promise`\<`void`\>

#### Defined in

src/interfaces.ts:26

___

### on

▸ **on**(`event`, `handler`): [`IAutoBee`](#interfacesiautobeemd)

Triggers on any bot start

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `event` | ``"start"`` | event name |
| `handler` | () => `void` | handler to be called on error event |

#### Returns

[`IAutoBee`](#interfacesiautobeemd)

#### Defined in

src/interfaces.ts:34

▸ **on**(`event`, `handler`): [`IAutoBee`](#interfacesiautobeemd)

Triggers on any bot stop

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `event` | ``"stop"`` | event name |
| `handler` | () => `void` | handler to be called on error event |

#### Returns

[`IAutoBee`](#interfacesiautobeemd)

#### Defined in

src/interfaces.ts:41

▸ **on**(`event`, `handler`): [`IAutoBee`](#interfacesiautobeemd)

Triggers on any bot-related error

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `event` | ``"error"`` | event name |
| `handler` | (`error`: `Error`) => `void` | handler to be called on error event |

#### Returns

[`IAutoBee`](#interfacesiautobeemd)

#### Defined in

src/interfaces.ts:48

▸ **on**(`event`, `handler`): [`IAutoBee`](#interfacesiautobeemd)

Triggers on new block detected

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `event` | ``"block"`` | event name |
| `handler` | (`data`: `IBlockData`) => `void` | handler to be called on error event |

#### Returns

[`IAutoBee`](#interfacesiautobeemd)

#### Defined in

src/interfaces.ts:55

___

### start

▸ **start**(): `Promise`\<`void`\>

Starts the automation with given configuration

#### Returns

`Promise`\<`void`\>

#### Defined in

src/interfaces.ts:16

___

### stop

▸ **stop**(): `Promise`\<`void`\>

Request automation stop

#### Returns

`Promise`\<`void`\>

#### Defined in

src/interfaces.ts:21


<a name="interfacesistartconfigurationmd"></a>

# Interface: IStartConfiguration

## Properties

### chainOptions

• `Optional` **chainOptions**: `Partial`\<`IWaxOptionsChain`\>

Wax chain options

**`Default`**

```ts
{}
```

#### Defined in

src/bot.ts:21

___

### postingKey

• **postingKey**: `string`

Posting private key in WIF format

#### Defined in

src/bot.ts:13
