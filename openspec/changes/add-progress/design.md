## Context

See proposal.md and [progress.md](../../../docs/research/progress.md). Builds on
`add-foundations` (machine runtime with `onProps`, contracts, `testMachine` with prop
steps), `add-a11y-foundations` (`Announcer`, `format.number`, `resolveMessages`, quirks
registry, `visually-hidden`), `add-theme-system`. `add-meter` and `add-slider` build on
this change (`range-value`). The `valued` extension moved to `add-slider`, which ships first.

## Goals / Non-Goals

**Goals:** every attribute a pure function of props (SSR-trivial, Node-testable); one
normalised value per render; the ring without geometry in JS.

**Non-Goals:** a reusable "announce on threshold" utility (only completion is needed).

## Decisions

### 1. Layout

```
packages/core/src/components/shared/range-value.ts   resolveRangeValue, rangeValueText, rangeValueAttributes
packages/core/src/components/progress/
├─ progress.machine.ts     one state, completion announcement
├─ progress.connect.ts     parts from range-value
├─ progress.contract.ts
└─ progress.messages.ts    valueText, complete
packages/core/src/dom/quirks.ts                       + nvda-progressbar-name
packages/react/src/progress/                          Root, Label, ValueText, Track, Indicator, Circle, CircleTrack, CircleIndicator
packages/theme/src/progress.css
```

### 2. The machine-less model

```ts
type Resolved = { value: number | null; min: number; max: number; fraction: number; percent: number }
function resolveRangeValue(p: { value?: number | null; min?: number; max?: number }, warn: Logger): Resolved
function rangeValueText(r: Resolved, o: { locale: string; formatOptions?: Intl.NumberFormatOptions },
  valueText: (a: { value: number; percent: number; formatted: string }) => string): string | undefined
function rangeValueAttributes(r: Resolved, text: string | undefined): {
  "aria-valuemin": number; "aria-valuemax": number; "aria-valuenow"?: number; "aria-valuetext"?: string }
```

Connect calls these per render; nothing is stored. Percent formatting formats the
fraction (`Intl` percent of 0.25 = "25%"); other styles format the value. The formatter
is the cached `format.number(locale, options)`, and the locale is the environment's, so
a provider locale makes server and client agree (BU#4616).

Alternatives: Zag's machine with states `indeterminate | loading | complete` — rejected:
the state is fully determined by props, a machine adds an initial-state problem on the
server (a numeric prop cannot be state-bound by `bindProp`) and nothing to model.

### 3. Why a one-state service anyway

Contracts, drivers and `testMachine` are keyed by a machine, and the completion
announcement is behaviour that belongs in a machine (Announcer injected, testable in
Node). So:

```ts
progressMachine = setup({ types, guards: { reachedMax }, actions: { announceCompletion, remember } })
  .machine({ id: "progress", initial: "idle", onProps: { value: "VALUE.CHANGE" },
    context: (p) => ({ previous: p.value ?? null }),
    states: { idle: { on: { "VALUE.CHANGE": [
      { guard: "reachedMax", actions: ["announceCompletion", "remember"] },
      { actions: ["remember"] } ] } } } })
```

`reachedMax`: `announceCompletion` prop, new value equals `max`, previous below `max` or
`null`. `onProps` does not fire on creation, so mounting at `max` is silent. The
service has no effects beyond `announcer.prepare()` when `announceCompletion` is set.
Meter uses the same pattern with no events.

### 4. Connect output

| Part | Attributes |
|---|---|
| Root | `role="progressbar"`, value attributes, `aria-labelledby` (Label, while mounted), `data-state`, `data-orientation`, `data-value`, `data-min`, `data-max`; filler `span` appended by the React Root |
| Label | `id`, state `data-*` |
| ValueText | `aria-hidden="true"`, default children = value text |
| Track | state `data-*` |
| Indicator | `--rind-progress-percent`, inline `inline-size`/`block-size` percent |
| Circle | `aria-hidden`, `viewBox="0 0 100 100"` default, `--rind-progress-percent` |
| CircleTrack / CircleIndicator | `pathLength="100"`; indicator `stroke-dasharray="100"`, `stroke-dashoffset` |

Circle geometry (`cx`, `cy`, `r`) defaults to a 100×100 viewBox with `r` inset by the
stroke width token in CSS (`r: calc(50px - var(--rind-progress-ring-thickness) / 2)` is
not portable, so the default `r` is 45 and the theme's stroke width fits it; consumers
can pass their own). This avoids ZG#1361's radius bug without measuring.

### 5. Quirk entry

`nvda-progressbar-name`: `when: () => true` (cannot detect NVDA; markup must match on the
server), links BU#4184, nvda#13904, nvda#16204, FreedomScientific standards-support#354;
`removeWhen`: "NVDA reads progressbar/meter names without text content
(nvda#16204 fixed) in the two latest NVDA releases"; test: a Guidepup NVDA golden flow
plus a unit test that the span exists and is `role="presentation"`. Shared by Meter.

### 6. `valued` extension (`model-based-testing`, shipped by `add-slider`)

`ContractDef.valued?: { values(view): readonly (number | null)[]; valueText?(view, i) }`;
the invariant matches elements with a valued role or `aria-valuenow` in DOM order. Fixes
the locale-grouping false failure of the current implementation (`/^-?\d+(\.\d+)?$/`
compared with `Number(text)`), which would misread German "1.200".

### 7. Contract and model

No actions; the model walks prop steps: `"$props:value"` mapped to a sequence of values
(`null`, 0, 40, `max`, 40, `max`) so `reachedMax` is exercised both ways; configurations
with and without `announceCompletion`, custom range, `min === max` (dev warning
expected), vertical. Announcement count checked through the contract's announcements.

### 8. Theme

`progress.css`: track (`--rind-progress-track-bg`, border for forced colors), indicator
(`--rind-progress-indicator-bg` → accent solid; width from the inline size); indeterminate
`@keyframes` (translate a 40 % segment) inside `@media (prefers-reduced-motion:
no-preference)`, static striped 40 % segment otherwise; ring: `stroke` tokens, rotation
−90°, indeterminate partial arc (`stroke-dashoffset: 75`) spinning only without reduced
motion; `stroke-linecap: round` hidden at 0 (Zag's `opacity: 0` trick); forced colors
`Highlight` stroke/fill, `CanvasText` track border.

### Requests to other changes (ALL APPLIED by the coordinator, 2026-10-14)

- **add-theme-system** (`theme-variants` → Family Matrix): add the **range** family
  (Slider, Progress, Meter): `data-variant` **solid**, soft; `data-size` sm, **md**, lg.
  Same request as `add-slider` and `add-meter`.

## Risks / Trade-offs

- [The filler span is visible to some AT as stray content] → `role="presentation"`,
  one character, visually hidden; re-tested yearly; JAWS still drops the name
  (documented).
- [A service per progress bar in long lists] → one-state machine, no effects unless
  `announceCompletion`; measured in the docs' list story.
- [`announceCompletion` is a boolean prop] → it selects a message, not a code path: the
  machine always has the transition; the guard reads the prop.

## Migration Plan

None for rind-ui. Reado's `SessionProgress.tsx` bar becomes `<Progress value={reviewed}
max={total}>` with a Label carrying today's `aria-label` text.
