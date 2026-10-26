## Context

Research: [docs/research/context-meter.md](../../../docs/research/context-meter.md)
("Decisions"); this v1 leaves the breakdown's popover to composition.

## Decisions

### 1. State

A pure function of the props: `unknown` when `max` is null, non-finite or ≤ 0; else with
`f = used / max`: `over` when `f > 1`, `full` when `f ≥ fullAt`, `warning` when `f ≥ warnAt`,
else `ok`. The machine holds it (events `SYNC` from `onProps`, `RESET` from `resetKey`) plus
the set of announced levels.

### 2. Announcements

Levels rank `ok < warning < full < over`. On `SYNC`, entering a level above the previous one
that has not been announced since the last re-arm announces `messages[level]` politely
(`announce="polite"`, the default) and calls `onThreshold(level)`. Falling back does not
announce; it re-arms the levels above the new one. `resetKey` change re-arms all and records
the current level silently. Mount records silently.

### 3. Value text

`messages.valueText({ used, max, percent })` with numbers through
`Intl.NumberFormat(locale, formatOptions ?? { notation: "compact" })` and the percent through
`Intl.NumberFormat(locale, { style: "percent" })`: "21K of 128K tokens, 17%". Unknown max:
`messages.unknown({ used })` ("21K tokens used").

### 4. Parts and roles

Root: `role="meter"` with `aria-valuemin=0`, `aria-valuemax=max`, `aria-valuenow=min(used,
max)`, `aria-valuetext`, named by the Label (`aria-labelledby`) or `messages.label` ("Context
used"); unknown max: no role, the text visible. ValueText: the short percent ("17%"),
`aria-hidden`. Track / Indicator: `aria-hidden`, `--rind-context-meter-percent` (0–100) on the
Root. Breakdown: `<dl>`; BreakdownItem: a `dt`/`dd` pair, `data-key`.

### 5. Attributes

Every part: `data-scope="context-meter"`, `data-part`, `data-instance`, `data-state`; Root and
Indicator: `data-zone` (`ok`, `warning`, `full`; `over` is `full`); Root: `data-percent`.

### 6. Contract

Locate by role `meter` and name. Queries `state`, `percent`, `valueText`. No actions (the value
is a prop).
