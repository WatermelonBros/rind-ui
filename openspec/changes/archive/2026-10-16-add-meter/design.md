## Context

See proposal.md and [meter.md](../../../docs/research/meter.md). Everything Meter shares
with Progress — `range-value`, the `valued` extension, the `nvda-progressbar-name` quirk
and the one-state-service pattern — is specified in `add-progress` and reused unchanged.

## Goals / Non-Goals

**Goals:** a thin Meter over `range-value`; regions that follow the HTML algorithm and
never rely on colour.

**Non-Goals:** a gauge/ring variant; threshold announcements.

## Decisions

### 1. Layout

```
packages/core/src/components/meter/
├─ meter.machine.ts      one state, no events
├─ meter.connect.ts      range-value + meterZone
├─ meter.zone.ts         meterZone (pure)
├─ meter.contract.ts
└─ meter.messages.ts     valueText
packages/react/src/meter/   Root, Label, ValueText, Track, Indicator
packages/theme/src/meter.css
```

### 2. Machine

`meterMachine`: `initial: "idle"`, `states: { idle: {} }`, no events. It exists so the
contract, driver and `testMachine` (prop steps through `rerender`) apply; it costs one
service with no effects. Alternative: a contract without a machine — would need a change
to `component-contract`; not worth it for one component (revisit if Separator-like
components multiply).

### 3. Zones

```ts
type MeterZone = "optimum" | "suboptimum" | "even-less-good"
function meterZone(r: Resolved, t: { low?: number; high?: number; optimum?: number }): MeterZone | undefined
```

Returns `undefined` when no threshold is set. Clamping and ordering follow the HTML
standard's meter algorithm (low ≥ min, high ≥ low, optimum within range); the result
depends only on which of the three regions (below `low`, between, above `high`) holds the
value and which holds `optimum`. Node tests cover each optimum position × each value
region plus the boundary values (`value === low`, `value === high`).

Alternative: Spectrum's consumer-picked variants (PR#6282) — kept possible anyway through
`data-tone`, which passes through.

### 4. Connect output

| Part | Attributes |
|---|---|
| Root | `role="meter"`, value attributes, `aria-labelledby`, `data-orientation`, `data-zone?`, `data-value`, `data-min`, `data-max`; filler span appended by the React Root |
| Label | `id`, `data-*` |
| ValueText | `aria-hidden`, default children = value text |
| Track | `data-*` |
| Indicator | `--rind-meter-percent`, inline size |

### 5. Contract and model

No actions. Prop steps move the value across `low` and `high` in configurations with
optimum below, between and above; one configuration without thresholds checks the absence
of `data-zone`; `valued` from the normalised value.

### 6. Theme

`meter.css`: track and indicator tokens (`--rind-meter-track-bg`,
`--rind-meter-indicator-bg` → accent solid); `[data-zone=suboptimum]` re-points the
indicator to the warning palette and adds a diagonal-stripe `background-image` plus an
edge; `[data-zone=even-less-good]` → danger palette with a denser pattern and a thicker
edge; forced colors: `Highlight` fill, `CanvasText` edge, zones distinguished by border
style (solid/dashed/double), since background patterns may be dropped.

### Requests to other changes (ALL APPLIED by the coordinator, 2026-10-14)

- **add-theme-system** (`theme-variants` → Family Matrix): the **range** family (Slider,
  Progress, Meter), `data-variant` **solid**, soft; `data-size` sm, **md**, lg — same
  request as `add-slider` and `add-progress`.

## Risks / Trade-offs

- [NVDA may still say "progress bar" for `meter`] → AT behaviour, not markup; manual
  protocol entry.
- [Zone semantics are not exposed to AT by ARIA] → the zone is passed to
  `messages.valueText`; the docs recommend including it.

## Migration Plan

None for rind-ui. Reado's `CoveragePanel.tsx` `Bar` becomes a labelled `Meter`; its
mount "grow" animation moves to the theme's transition on `--rind-meter-percent`.
