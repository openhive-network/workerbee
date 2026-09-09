# Expressing WorkerBee's `and` / `or` in an n8n node

Design note, 2026-08-31. Written while replacing the And-Group numbers in the
Hive Trigger. Records what n8n actually offers, so the next person weighing this
does not have to re-read the type definitions.

Sources checked: `n8n-workflow@2.36.3` type definitions, the compiled sources of
the core If V2 / Switch V3 / Filter V2 nodes taken out of a running
`n8nio/n8n:2.36.5` image, the n8n docs, and n8n issue #35534.

## The constraint: what WorkerBee can express at all

`QueenBee.applyAnd()` (`src/queen.ts`) settles it:

```ts
private applyAnd(): void {
  if (this.operands.length > 0) {
    this.filterContainers.push(
      this.operands.length === 1 ? this.operands[0] : new LogicalOrFilter(this.operands));
    this.operands = [];
  }
}
```

Operands accumulate into a buffer; `.and` closes the buffer as an OR group;
`subscribe()` ANDs every closed group. That is **conjunctive normal form, built
sequentially**: `a.or.b.and.c.or.d` is `(a OR b) AND (c OR d)`. There is no
nesting, so `a AND (b OR (c AND d))` cannot be expressed at all.

The method's own docstring says "AND takes precedence over OR", which is loose
wording — what actually decides the grouping is the order of the calls.

**Consequence:** the node does not need a boolean tree editor. It needs a list
read top to bottom, which is exactly the shape of the fluent chain in
TypeScript.

## What n8n offers

Every parameter type a node may declare (`NodePropertyTypes`):

> `boolean, button, collection, color, dateTime, fixedCollection, hidden, icon,
> json, callout, notice, multiOptions, number, options, string,
> credentialsSelect, resourceLocator, curlImport, resourceMapper, filter,
> assignmentCollection, credentials, workflowSelector, agentSelector`

Three matter here.

### `type: "filter"`

The native condition builder behind If, Filter and Switch.

```ts
type FilterValue = { options: FilterOptionsValue; conditions: FilterConditionValue[]; combinator: 'and' | 'or' };
type FilterConditionValue = { id; leftValue; operator: { type; operation }; rightValue };
type FilterTypeOptions = { version; caseSensitive?; leftValue?; allowedCombinators?; maxConditions?; typeValidation? };
```

Rejected, for two independent reasons:

- `combinator` is **one value for the whole set**. Flat all-AND or all-OR; there
  is no way to express groups, which is the only thing WorkerBee needs.
- Its semantics are value comparison (`leftValue operator rightValue`). We are
  choosing *observers*, not comparing values, so the operator dropdown would
  offer "is equal to / contains / is empty" — a lie about what the node does.

`allowedCombinators` and `maxConditions` exist in the type but **no core node
uses either**, so they are untested in practice.

### `fixedCollection`

What this package uses. `INodePropertyCollection.values` is
`INodeProperties[]`, so nesting is type-legal, and two levels (events →
parameters) demonstrably render. Switch V3 nests a `filter` inside a
`fixedCollection` (`rules.values[].conditions`), which is the deepest precedent
in core. **Three levels appear nowhere in core and are undocumented.**

Two `typeOptions` worth knowing, both found in core rather than in the docs:

- `typeOptions.fixedCollection.itemTitle` accepts an expression with access to
  `$collection.item.value` and `$collection.item.properties`, so each entry can
  carry a real title instead of a generic label. The Form node uses it to render
  `"<type>: <name>"`.
- `parameterPane: 'wide'` on the node description widens the panel. Eleven core
  nodes set it, If among them.

### `assignmentCollection`, `resourceMapper`, `multiOptions`

None fit: the first two are for mapping data onto a schema, and `multiOptions`
cannot carry per-selection parameters, which every event here needs.

## Options considered

| | Idea | Verdict |
|---|---|---|
| **A** | Flat list, each entry carries `and`/`or` describing how it joins the previous one | **Chosen** |
| B | Nested groups: outer "all of these groups", inner "any of these events" | Needs a third nesting level with no precedent in core; would have to be proven in the editor first |
| C | Expression mode: `posts(alice,bob) or votes(alice) and impacted_accounts(alice)` | Good third Spec Mode for power users; not a replacement for the form |
| D | Flat list plus one ALL/ANY combinator | Simplest, but drops AND-of-ORs entirely |
| E | Reuse `type: "filter"` | Wrong semantics, flat combinator |
| F | Several trigger nodes joined by Merge | Expresses OR only, and loses WorkerBee's deduplication and same-cycle grouping |

### Why A

```
Posts              authors = alice,bob
  or   Votes       voters  = alice
  and  Impacted    accounts = alice
```

compiles to `(posts OR votes) AND impacted`, which is literally
`.onPosts(...).or.onVotes(...).and.onImpactedAccounts(...)`. The UI reads like
the library call it produces.

It also costs nothing structurally: no numbers to invent, **no extra nesting
level**, and the change is confined to `properties.ts` and `spec.ts`. The
`match` wire format, the JSON Schema, the catalog and every compiler test stay
exactly as they were, so saved Raw JSON specs keep working.

The one wart: the first entry's join is meaningless, and it cannot be hidden
(see below). It is defused with the field name ("Join With Previous"), an
explicit note in the description, and an `itemTitle` that shows the join.

## Two traps that constrain any redesign

**No `displayOptions` on a child of a `collection` or `fixedCollection`.** n8n
says so itself:

> Could not resolve parameter dependencies. Max iterations reached! Hint: If
> displayOptions are specified in any child parameter of a parent `collection`
> or `fixedCollection`, remove the `displayOptions` from the child parameter.

A regression since 2.33.3 ([issue #35534](https://github.com/n8n-io/n8n/issues/35534)); an
affected workflow can neither be activated nor opened in the editor. This
package is safe today — its `displayOptions` sit on top-level properties, not
inside collections — but the rule is what forbids hiding "Join With Previous" on
the first row, and it rules out any field shown conditionally on a sibling
inside the same entry.

**`&` in `getCurrentNodeParameter` reaches one collection level, no further.**
`LoadOptionsContext` rewrites the name as

```js
parameterPath = `${this.path.split('.').slice(1, -1).join('.')}.${parameterPath.slice(1)}`;
```

so from `events.event[0].parameters.parameter[0].name` a `&event` asks for
`events.event[0].parameters.parameter[0].event`, which does not exist. It returns
`undefined` silently, and the dropdown then offered every parameter of every
event -- including ones the chosen event rejects at activation.

The fix rebuilds the entry path from the context's own `path` field and asks for
`events.event[0].event` outright. `path` is not part of `ILoadOptionsFunctions`,
so `load-options.ts` guards for it and falls back to the unnarrowed list if it
ever disappears. `loadOptionsDependsOn` was moved off `&event` too, onto
`events.event`, which is a path that exists and therefore actually invalidates
the cached options when the event changes.

This is the concrete cost of one extra nesting level, and it is worth weighing
before adding another for option B.

## If option B is ever revisited

The open question is purely empirical: does the editor render a fixedCollection
three levels deep (group → event → parameters) in a usable way? The type
definitions permit it and the docs are silent. Build both variants behind the
image and look at them in a browser; nothing short of that settles it.
