# JSON Tree View

Shows a JSON (or any JavaScript) value as an expandable tree: an API response, a log entry, a config, a tool call's arguments. It is a [Tree View](tree-view.md): the same keyboard, focus, typeahead, virtualisation and driver. Children are built only when their container opens, so a huge value opens instantly; keys are JSON Pointers; big arrays split into ranges; and Ctrl+C / ⌘C copies the focused node.

## When to use

- **Use it for** reading structured data: payloads in a dev tool or an admin panel, AI tool calls and results, settings dumps.
- **Over a JSON viewer library**: nothing is converted up front (no freeze on a large payload), keys never collide (`"a.b"` vs `a › b`), shared values are not reported as circular, the visible text is the accessible name, and a failed copy is reported as failed.
- **Don't use it for** editing data (a form), or for showing JSON as code with line numbers ([Code Block](code-block.md)).

```tsx
import { JsonTreeView } from "@rind-ui/react"

<JsonTreeView.Root data={response} aria-label="Response" defaultExpandedDepth={1} />
```

The Root renders the tree, its items and their text. For your own markup, render Tree View's parts and the JSON parts (`Key`, `Separator`, `Value`, `Summary`, `SummaryText`, `Preview`) yourself.

## API

<!-- api:json-tree-view -->

## Values

JSON types plus what JavaScript hands you: `undefined`, `bigint` (all digits), `NaN`, `±Infinity`, `-0`, `Date` (ISO), `Map`, `Set`, `RegExp`, `Error` (`name`, `message`, `stack`), sparse arrays (defined indexes), functions and class instances (one line). Only own enumerable keys are shown. A value that contains itself shows "circular reference" where it loops; a value used twice shows twice.

### Big integers from JSON text

`JSON.parse` rounds integers above 2^53. Where the engine passes the source text to the reviver, keep them as `bigint`:

```ts
const data = JSON.parse(text, (_key, value, context) =>
  typeof value === "number" && !Number.isSafeInteger(value) && context?.source
    ? BigInt(context.source)
    : value,
)
```

## Keys and expansion

Each item's key is the JSON Pointer of its value (`/address/street`, `/tags/0`, `/a~1b` for `"a/b"`), so `expandedValue` survives a new `data` of the same shape. `defaultExpandedDepth` (1) applies to the first value only. More than `groupSize` (100) children are grouped in ranges ("0 … 99"). `expandAll()` opens one level deeper than now and never shows more than 5000 rows.

## Copy

Ctrl+C / ⌘C on the focused item, or the optional `CopyTrigger`, copies it as `copyFormat`: `"json"` (the subtree; BigInt as digits, Map and Set as entry arrays), `"value"` (a leaf's raw text) or `"pointer"`. The result is announced ("Copied", "Copy failed": a subtree with a cycle cannot be JSON).

## Keyboard

Tree View's keys (arrows, Home, End, `*`, typing a key name), plus Ctrl+C / ⌘C to copy.

## Accessibility notes

- **The visible text is the name.** "address object, 4 entries": the key, then the spoken summary in a visually hidden span; the `{4}` glyph and the preview are hidden from assistive technology.
- **Typeahead** jumps to a visible key by typing its name.
- **Ranges** read as "0 … 99", collapsed or expanded, like any branch.

## Testing

```tsx
import { getJsonTreeView } from "@rind-ui/testing"

const view = getJsonTreeView(screen, { name: "Response" })
await view.expand("address")
expect(await view.valueText("/address/street")).toBe("Main St")
expect(await view.summaryOf("/tags")).toBe("array, 3 entries")
```

Tree View's actions and queries, plus `nodeAt(pointer)`, `valueText(pointer)`, `summaryOf(pointer)`, `copy()` and `copyState()`.

## Tested with

<!-- tested-with:json-tree-view -->
_No manual screen-reader pass recorded yet._
<!-- /tested-with -->
