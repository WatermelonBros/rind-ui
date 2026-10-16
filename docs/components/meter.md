# Meter

Shows a measurement within a known range: storage used, battery level, password strength. It is `role="meter"` (exactly, with no fallback role) named by its Label, with the value in `aria-valuenow` and the same formatted text in `aria-valuetext` and the visible ValueText. Optional `low`, `high` and `optimum` split the range into regions the way HTML `<meter>` does.

```tsx
import { Meter } from "@rind-ui/react"

<Meter.Root value={used} max={capacity} formatOptions={{ style: "unit", unit: "gigabyte" }}>
  <Meter.Label>Storage</Meter.Label>
  <Meter.ValueText />
  <Meter.Track>
    <Meter.Indicator />
  </Meter.Track>
</Meter.Root>
```

`value` is required: a meter is never indeterminate (a missing value logs a development error and renders `min`). It is clamped to `min`–`max`, so the text never shows 130 of 100.

## API

<!-- api:meter -->

## Regions

When any of `low`, `high` or `optimum` is set, every part carries `data-zone`, computed with the HTML `<meter>` algorithm:

- `low` is clamped to `min`–`max` (default `min`), `high` to `low`–`max` (default `max`), `optimum` to `min`–`max` (default the midpoint).
- The range has three regions: below `low`, between (inclusive), above `high`.
- The region that holds `optimum` is `optimum`; a region next to it is `suboptimum`; the region on the far side is `even-less-good`.

A battery is `low={20} high={80} optimum={100}`: 90 is `optimum`, 50 `suboptimum`, 10 `even-less-good`. A disk where lower is better sets `optimum={0}`.

ARIA has no way to expose a region, so say it: `messages.valueText` receives `{ value, percent, formatted, zone }`.

```tsx
<Meter.Root
  value={10}
  low={20}
  high={80}
  optimum={100}
  messages={{ valueText: ({ formatted, zone }) => (zone === "even-less-good" ? `${formatted}, low` : formatted) }}
>
  <Meter.Label>Battery</Meter.Label>
</Meter.Root>
// aria-valuetext: "10%, low"
```

## Meter or Progress

A Meter measures something that is not a task. A task moving towards an end (an upload, an install), or an amount that may be unknown, is a [Progress](progress.md).

## Accessibility notes

- The name comes from the Label (or your `aria-label`), never from the value text. An unnamed Meter logs a development error unless Root is `aria-hidden`.
- The role is exactly `meter`. A `"meter progressbar"` fallback makes axe report `aria-allowed-attr` (RS#6627, RS#10737); NVDA may still say "progress bar" for a meter, which is the screen reader's choice.
- NVDA drops the name of a meter with no text content, so Root ends with one visually hidden, presentational character (quirk `nvda-progressbar-name`, shared with Progress).
- A Meter is never a live region and never announces: a value that changes every second stays silent.

## Styling

Style the `data-*` attributes above, or import `@rind-ui/theme/meter.css`: the fill reads `--rind-meter-percent`; `suboptimum` and `even-less-good` move to the warning and danger palettes and add stripes and an end edge, so a zone is never shown by colour alone; forced colors keep the zones apart by border style (solid, dashed, double). `data-variant` (`solid`, `soft`), `data-size` (`sm`, `md`, `lg`) and `data-tone` apply.

## Testing

Queries: `value`, `valueText`, `percent`, `zone` (`undefined` without thresholds), `name`; no actions (the value is a prop).

```tsx
import { getMeter } from "@rind-ui/testing"

render(<Meter.Root value={10} low={20} high={80} optimum={100}>…</Meter.Root>)
const battery = getMeter(screen, { name: "Battery" })
expect(await battery.zone()).toBe("even-less-good")
expect(await battery.valueText()).toBe("10%")
```

The same test runs with a Playwright `page`.

## Tested with

<!-- tested-with:meter -->
_No manual screen-reader pass recorded yet._
<!-- /tested-with -->
