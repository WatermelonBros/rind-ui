## Why

Meter (a measurement within a known range: storage, battery, strength, coverage) ships in
four libraries and is easy to confuse with Progress. Its bugs are the value-model bugs
Progress already fixes (percent in `aria-valuenow`, unclamped text, NaN ranges, NVDA name
loss) plus two of its own: role fallbacks that fail axe, and no way to express native
`<meter>`'s low/high/optimum regions. With `range-value` from `add-progress`, Meter is a
small component.

Research: [meter](../../../docs/research/meter.md) ·
[progress — Shared with Meter](../../../docs/research/progress.md#shared-with-meter) ·
[accessibility](../../../docs/research/accessibility.md) §2, §7.4, §8 ·
[assistive-tech-and-a11y-testing](../../../docs/research/assistive-tech-and-a11y-testing.md)
§1.2 I

Depends on: `add-foundations` (archived), `add-a11y-foundations`, `add-theme-system`, and
`add-progress` (`range-value`, the `valued` extension, the `nvda-progressbar-name` quirk
entry). The theme-family request is listed in design.md.

## What Changes

- A public **Meter** in `@rind-ui/core` and `@rind-ui/react`: parts `Root`
  (`role="meter"`), `Label`, `ValueText`, `Track`, `Indicator`.
- `value` (required), `min`, `max`, `low`, `high`, `optimum`, `formatOptions`, `locale`,
  `messages`.
- Regions computed with the HTML `<meter>` algorithm, exposed as `data-zone` and passed
  to the value text, never as colour alone.
- `getMeter` driver, model tests over prop steps, `meter.css`, stories, docs.

## Capabilities

### New Capabilities

- `meter`: the Meter component.

### Modified Capabilities

None. `range-value` and `model-based-testing` are used as `add-progress` specifies them.

## Non-goals

- An indeterminate meter (ARIA/APG: a meter always has a value).
- A circular gauge (open question in the research note).
- Native `<meter>` as the rendered element; a `"meter progressbar"` role fallback.
- Announcing value changes or threshold crossings.
- Framework adapters other than React; fx.

## Impact

- New: `packages/core/src/components/meter/`, `packages/react/src/meter/`, `getMeter`,
  `packages/theme/src/meter.css`, stories, docs page.
- Reado: `organisms/CoveragePanel.tsx`'s unlabelled bar becomes a Meter.
- No new dependency.
