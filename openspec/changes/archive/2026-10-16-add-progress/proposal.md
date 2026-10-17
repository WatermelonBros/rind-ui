## Why

Progress (linear and circular) ships in seven libraries and has no interaction, yet its
bug history is full of the same mistakes: 0 treated as indeterminate, the value used as
the accessible name, NaN for an empty range, value text and fill computed separately and
drifting, NVDA dropping the label, SSR locale mismatches, and visuals (fill, ring,
indeterminate animation) left to every consumer. Meter needs the same value model, so it
is specified once here.

Research: [progress](../../../docs/research/progress.md) (incl. "Shared with Meter") ·
[accessibility](../../../docs/research/accessibility.md) §2, §7.4, §8, §9 ·
[assistive-tech-and-a11y-testing](../../../docs/research/assistive-tech-and-a11y-testing.md)
§1.2 I · [native-platform](../../../docs/research/native-platform.md)

Depends on: `add-foundations` (archived), `add-a11y-foundations` (announcer, i18n
`format.number` and messages, quirks registry, visually hidden style), `add-theme-system`.
A request to `add-theme-system` is listed in design.md.

## What Changes

- A public **Progress** in `@rind-ui/core` and `@rind-ui/react`: parts `Root`, `Label`,
  `ValueText`, `Track`, `Indicator`, and `Circle`, `CircleTrack`, `CircleIndicator` for the
  ring.
- `value: number | null` (null/undefined = indeterminate), `min`, `max`, `orientation`,
  `formatOptions`, `locale`, `messages`, `announceCompletion`.
- A shared, machine-less **range-value** model (clamp, empty-range guard, percent, value
  text, ARIA value attributes) used by Progress and Meter.
- An opt-in completion announcement through the Announcer — Progress is never a live
  region.
- The NVDA name workaround as a registered quirk entry.
- `getProgress` driver, model tests over prop steps, `progress.css` (bar, ring,
  indeterminate and reduced-motion visuals, forced colors), stories, docs.

## Capabilities

### New Capabilities

- `progress`: the Progress component.
- `range-value`: the shared value model for value displays (Progress, Meter).

### Modified Capabilities

None. The `valued` extension (lists, `null`, contract value text) moved to `add-slider`,
which ships first.

## Non-goals

- Native `<progress>` as the rendered element.
- Buffer / secondary values (video buffering), segmented step progress (Steps
  component), a progress inside a button's pending state.
- Live announcements of intermediate values.
- Framework adapters other than React; fx.

## Impact

- New: `packages/core/src/components/progress/`,
  `packages/core/src/components/shared/range-value.ts`, `packages/react/src/progress/`,
  `getProgress` in `@rind-ui/testing`,
  `packages/theme/src/progress.css`, stories, docs page; one quirk entry.
- Reado: `guided/SessionProgress.tsx` migrates to Progress.
- No new dependency.
