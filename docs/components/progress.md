# Progress

Shows how far a task has advanced, as a bar or a ring, determinate or indeterminate. It is `role="progressbar"` named by its Label, with the value in `aria-valuenow` and the same formatted text in `aria-valuetext` and the visible ValueText. It is never a live region; it can announce completion once.

```tsx
import { Progress } from "@rind-ui/react"

<Progress.Root value={uploaded} max={total}>
  <Progress.Label>Uploading</Progress.Label>
  <Progress.ValueText />
  <Progress.Track>
    <Progress.Indicator />
  </Progress.Track>
</Progress.Root>
```

`value={null}` (or leaving it out) is indeterminate; `0` is a value. Every output comes from one normalised value (clamped to `min`–`max`, never `NaN`), so the fill, the ring, `aria-valuenow` and the text cannot disagree.

## API

<!-- api:progress -->

## Value text

By default the value text is a percent of the range: `value={2} max={8}` reads "25%" while `aria-valuenow` stays 2. Pass `formatOptions` for another format (`{ style: "unit", unit: "gigabyte" }` formats the value itself), and `messages.valueText` to wrap it: it receives `{ value, percent, formatted }`. The locale is the provider's, so server and client render the same text.

## Progress or Meter

Progress is for a task that moves towards an end (an upload, an install). A measurement within a known range that is not a task (disk usage, battery, password strength) is a [Meter](meter.md).

## Completion announcement

`announceCompletion` announces `messages.complete` ("Complete") politely through the Announcer when the value reaches `max`, from below or from indeterminate. It is silent on mount (a bar rendered complete says nothing) and for every other change: intermediate values are never announced, so a fast upload does not flood the screen reader.

## The ring

`Progress.Circle` is an `aria-hidden` `svg` (`viewBox="0 0 100 100"`) holding `CircleTrack` and `CircleIndicator`. Both use `pathLength="100"`, so the arc is `stroke-dasharray="100"` with `stroke-dashoffset` = 100 − percent: no radius maths, any `r` works. Indeterminate, the theme draws a quarter arc that spins (still under reduced motion).

```tsx
<Progress.Root value={25} aria-label="Sync">
  <Progress.Circle>
    <Progress.CircleTrack />
    <Progress.CircleIndicator />
  </Progress.Circle>
</Progress.Root>
```

## Accessibility notes

- The name comes from the Label (or your `aria-label`), never from the value text. An unnamed Progress logs a development error unless Root is `aria-hidden` (a decorative bar).
- NVDA drops the name of a progressbar with no text content (BU#4184, nvda#13904), so Root ends with one visually hidden, presentational character (quirk `nvda-progressbar-name`). JAWS still reads only the value in some versions (FreedomScientific standards-support#354).
- `orientation="vertical"` only changes which size the fill takes; a progressbar has no `aria-orientation`.

## Styling

Style the `data-*` attributes above, or import `@rind-ui/theme/progress.css`: the fill reads `--rind-progress-percent`, the indeterminate segment and ring animate only under `prefers-reduced-motion: no-preference` (a still, striped segment otherwise), `data-variant` (`solid`, `soft`), `data-size` (`sm`, `md`, `lg`) and `data-tone` apply, and forced colors draw a `Highlight` fill on a `CanvasText` track edge.

## Testing

Queries: `value` (`null` when indeterminate), `valueText`, `percent`, `state`, `name`; no actions (the value is a prop). `announcements()` lists what the Progress announced since the driver was created.

```tsx
import { getProgress } from "@rind-ui/testing"

const { rerender } = render(<Upload value={40} announceCompletion />)
const upload = getProgress(screen, { name: "Uploading" })
expect(await upload.valueText()).toBe("40%")
rerender(<Upload value={100} announceCompletion />)
expect((await upload.announcements()).map((a) => a.message)).toEqual(["Complete"])
```

The same test runs with a Playwright `page`.

## Tested with

<!-- tested-with:progress -->
_No manual screen-reader pass recorded yet._
<!-- /tested-with -->
