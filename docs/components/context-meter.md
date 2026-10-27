# Context Meter

How much of a model's context window a thread uses: "21K of 128K tokens, 17%". A [Meter](meter.md) with AI semantics: the usage in words in the accessible name, zones that never rely on colour alone, and a single announcement when a threshold is crossed ("Context almost full"), never on every streamed token.

## When to use

- **Use it for** a chat's context usage, a prompt's token budget, a document's share of the window.
- **Over a ring or a progress bar**: `role="meter"` (usage is a gauge, not a task), the number in the name (AI Elements' ring has a constant name), thresholds announced once and re-armed for a new thread (`resetKey`), the locale's compact numbers, no SDK types.
- **Don't use it for** a task's progress ([Progress](progress.md)).

```tsx
import { ContextMeter } from "@rind-ui/react"

<ContextMeter.Root used={usage.totalTokens} max={128_000} resetKey={threadId} onThreshold={compact}>
  <ContextMeter.Label>Context</ContextMeter.Label>
  <ContextMeter.Track>
    <ContextMeter.Indicator />
  </ContextMeter.Track>
  <ContextMeter.ValueText />
</ContextMeter.Root>
```

## API

<!-- api:context-meter -->

## States and thresholds

| State | When |
|---|---|
| `ok` | below `warnAt` (0.75) |
| `warning` | from `warnAt` |
| `full` | from `fullAt` (0.95) |
| `over` | above `max` |
| `unknown` | no `max`: the usage as text, no meter role |

A rising crossing into `warning`, `full` or `over` is announced once and calls `onThreshold(level)`; falling back re-arms the levels above, and a new `resetKey` re-arms everything. Mount is silent.

## Breakdown

`Breakdown` is a `dl` of `BreakdownItem`s (system prompt, messages, tools…). Put it in a [Popover](popover.md) opened by a button next to the meter, so it opens on press and on focus, not on hover only.

## Accessibility notes

- **A meter named in words**: "Context used: 21K of 128K tokens, 17%"; the short "17%" on screen is `aria-hidden`.
- **The stream is silent.** Only a threshold crossing speaks, once.
- **Never colour alone.** `data-zone` lets the theme add stripes and an end mark.

## Testing

```tsx
import { getContextMeter } from "@rind-ui/testing"

const meter = getContextMeter(screen)
expect(await meter.percent()).toBe(17)
expect(await meter.state()).toBe("ok")
```

Queries: `state`, `percent`, `valueText`.

## Tested with

<!-- tested-with:context-meter -->
_No manual screen-reader pass recorded yet._
<!-- /tested-with -->
