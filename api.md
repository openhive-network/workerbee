
<a name="_modulesmd"></a>

# @hive-staging/autobee

## Enumerations

- [EBotStatus](#enumsebotstatusmd)

## Interfaces

- [IAutoBee](#interfacesiautobeemd)
- [IStartConfiguration](#interfacesistartconfigurationmd)

## Variables

### default

• **default**: `IAutoBeeConstructor`

#### Defined in

src/index.ts:8


<a name="enumsebotstatusmd"></a>

# Enumeration: EBotStatus

## Enumeration Members

### RUNNING

• **RUNNING** = ``3``

#### Defined in

src/bot.ts:9

___

### STALE

• **STALE** = ``0``

#### Defined in

src/bot.ts:6

___

### STOPPED

• **STOPPED** = ``2``

#### Defined in

src/bot.ts:8

___

### WAIT\_STOP

• **WAIT\_STOP** = ``1``

#### Defined in

src/bot.ts:7


<a name="interfacesiautobeemd"></a>

# Interface: IAutoBee

## Properties

### status

• `Readonly` **status**: [`EBotStatus`](#enumsebotstatusmd)

#### Defined in

src/interfaces.ts:4

## Methods

### addListener

▸ **addListener**(`event`, `handler`): [`IAutoBee`](#interfacesiautobeemd)

Triggers on any bot start

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `event` | ``"start"`` | event name |
| `handler` | () => `void` | handler to be called on error event |

#### Returns

[`IAutoBee`](#interfacesiautobeemd)

#### Defined in

src/interfaces.ts:29

▸ **addListener**(`event`, `handler`): [`IAutoBee`](#interfacesiautobeemd)

Triggers on any bot stop

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `event` | ``"stop"`` | event name |
| `handler` | () => `void` | handler to be called on error event |

#### Returns

[`IAutoBee`](#interfacesiautobeemd)

#### Defined in

src/interfaces.ts:36

▸ **addListener**(`event`, `handler`): [`IAutoBee`](#interfacesiautobeemd)

Triggers on any bot-related error

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `event` | ``"error"`` | event name |
| `handler` | (`error`: `Error`) => `void` | handler to be called on error event |

#### Returns

[`IAutoBee`](#interfacesiautobeemd)

#### Defined in

src/interfaces.ts:43

___

### start

▸ **start**(`configuration`): `Promise`\<`void`\>

Starts the automation with given configuration

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `configuration` | [`IStartConfiguration`](#interfacesistartconfigurationmd) | Configuration for the automation |

#### Returns

`Promise`\<`void`\>

#### Defined in

src/interfaces.ts:11

▸ **start**(): `Promise`\<`void`\>

Resumes the configuration with the previously saved configuration

#### Returns

`Promise`\<`void`\>

#### Defined in

src/interfaces.ts:16

___

### stop

▸ **stop**(): `Promise`\<`void`\>

Request configuration stop

#### Returns

`Promise`\<`void`\>

#### Defined in

src/interfaces.ts:21


<a name="interfacesistartconfigurationmd"></a>

# Interface: IStartConfiguration

## Properties

### postingKey

• **postingKey**: `string`

Posting private key in WIF format

#### Defined in

src/bot.ts:18
