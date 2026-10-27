## Why

Chat UIs show how much of the model's context window a thread uses. The AI kits draw it as a
ring with a constant name and no value (AI Elements), a progress bar (wrong role: it is not a
task), or colour alone (assistant-ui); none announces crossing a limit once, and they tie the
API to one SDK's types. rind-ui has Meter; a Context Meter is a Meter with AI semantics.

Research: [context-meter](../../../docs/research/context-meter.md) ·
[accessibility](../../../docs/research/accessibility.md) §7

Depends on: `add-meter` (value model), `add-a11y-foundations` (Announcer), `add-theme-system`.

## What Changes

- A public **Context Meter** in `@rind-ui/core` and every framework package: parts `Root`
  (`role="meter"`), `Label`, `ValueText`, `Track`, `Indicator`, `Breakdown`, `BreakdownItem`.
- States `ok`, `warning`, `full`, `over`, `unknown` from `used`, `max`, `warnAt` (0.75),
  `fullAt` (0.95); a rising crossing into `warning`, `full` or `over` announced once
  (`resetKey` re-arms); the stream itself silent.
- The value in words (`aria-valuetext`: "21,400 of 128,000 tokens, 17%") with `Intl`
  compact formatting; an unknown `max` renders text and no meter role.
- `getContextMeter` driver, `context-meter.css`, site example, docs page.

## Capabilities

### New Capabilities

- `context-meter`: anatomy, states and thresholds, announcements, value text, unknown max,
  breakdown, data attributes, messages, contract, theme.

### Modified Capabilities

None.

## Non-goals

- Counting tokens, prices, compaction, a model table, a chart; a built-in breakdown popover
  (compose Popover around the Breakdown).

## Impact

- New: `packages/core/src/components/context-meter/`, framework parts, driver, theme file,
  site example and skin, `docs/components/context-meter.md`.
- Modified: `families.ts` (`context-meter` in `range`).
