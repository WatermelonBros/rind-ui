# Slider

Selects one value, or several (a range), on a continuous axis (APG Slider and Multi-Thumb Slider). Every thumb is backed by a real `<input type="range">`, the only focusable element of the thumb: browsers, screen readers and forms treat it as a native slider ([hidden-form-input](../guides/hidden-form-input.md)).

## When to use

- **Use it for** choosing a number, or a range with two thumbs, on a continuous axis: volume, price range, zoom.
- **Over a native `<input type="range">`**: it adds multiple thumbs with collision rules, a styled track and indicator, markers, value text from one formatted source, and drag cancel with Escape and a single commit event. Each thumb still is a native range input, so forms and screen readers work as usual. A plain `<input type="range">` is enough for one thumb with default styling.
- **Don't use it for** an exact number the user must type: use a [Number Input](number-input.md). Don't use it to show progress or a measurement that the user cannot change: use a [Progress](progress.md) or [Meter](meter.md).

```tsx
import { Slider } from "@rind-ui/react"

<Slider.Root defaultValue={40} onValueCommit={(value) => save(value)}>
  <Slider.Label>Volume</Slider.Label>
  <Slider.ValueText />
  <Slider.Control>
    <Slider.Track>
      <Slider.Indicator />
    </Slider.Track>
    <Slider.Thumb index={0} />
  </Slider.Control>
</Slider.Root>
```

A range passes an array: `defaultValue={[20, 80]}` renders two `Slider.Thumb` (`index` 0 and 1).

## API

<!-- api:slider -->

## Anatomy

| Part | `data-part` | Element |
|---|---|---|
| `Slider.Root` | `root` | `<div role="group">`, named by the Label. |
| `Slider.Label` | `label` | `<label>` (no `for`: it would override the thumbs' own names on iOS). |
| `Slider.ValueText` | `value-text` | `<div>`; the same text as `aria-valuetext`. Not a live region (an `<output>` would be one). |
| `Slider.Control` | `control` | `<div>`; the pointer target. |
| `Slider.Track` | `track` | `<div>`; the full range. |
| `Slider.Indicator` | `indicator` | `<div>`; the filled span. Exposes `--rind-slider-start` and `--rind-slider-end`. |
| `Slider.Thumb` | `thumb` | `<div>` with the native range input inside (`data-part="hidden-input"`). |
| `Slider.MarkerGroup` | `marker-group` | `<div aria-hidden>`. |
| `Slider.Marker` | `marker` | `<div>` at `value`; `data-state` is `under-value`, `at-value` or `over-value`. |
| `Slider.Description` | `description` | `<div>`; in each thumb's `aria-describedby`. |

`data-orientation`, `data-disabled`, `data-readonly`, `data-required`, `data-invalid`, `data-dragging`, `data-focus` and `data-focus-visible` are on every part; a Thumb adds `data-index` and `data-active` (the thumb used last, stacked on top). Positions are inline styles computed from the values, so server and client render the same markup.

## Keyboard

| Key | Behaviour |
|---|---|
| Arrow Right / Left | Increase / decrease by `step`. Mirrored in right-to-left (horizontal only). |
| Arrow Up / Down | Increase / decrease by `step`. Arrow Up always increases, in any direction. |
| Shift + arrow | Moves by `largeStep`. |
| Page Up / Page Down | Moves by `largeStep`. |
| Home / End | Moves the thumb to its lower / upper bound (its neighbour's, in a range). |
| Escape | Cancels a drag in progress and restores the start values. Does nothing otherwise. |
| Enter | Does nothing here: inside a form it submits it (implicit submission). |

## Commit semantics

- `onValueChange` runs on every change, including each move of a drag. `details.cancel()` refuses it.
- `onValueCommit` runs **once** at the end of an interaction: each key step, the pointer release, or an assistive-technology adjustment. Save to a server here.
- `onValueCommit` never runs for a cancelled drag, a refused change, a programmatic (prop) change or a form reset. A cancelled drag (Escape, `pointercancel`, lost capture) restores the values from the press with `onValueChange(…, { reason: "DRAG.CANCEL" })`; a form reset reports `reason: "RESET"`. A parent's prop change reports nothing.

## Thumb collision

With several thumbs, `thumbCollision` decides what happens when one meets its neighbour:

- `stop` (default): the thumb stops at the neighbour.
- `push`: the neighbour is pushed along, keeping the gap.
- `swap`: the thumb passes through; the thumbs trade indexes so values stay sorted.

`minStepsBetweenThumbs` sets the minimum gap in steps. Values are always sorted.

## Thumb alignment

`thumbAlignment="center"` (default) centres a thumb on its value, so it overhangs the track at the ends. `thumbAlignment="contain"` keeps it inside the track; the library cannot measure your thumb, so set `--rind-slider-thumb-size` to its size (for example `style={{ "--rind-slider-thumb-size": "1.25rem" }}` on the Root). Without it, `contain` behaves like `center`.

## Form participation

There is one native range input per thumb, so a range submits several fields. `name` on the Root names every thumb; `Slider.Thumb name` overrides it for one. `form` associates the inputs with a form elsewhere. A form reset restores the **current** `defaultValue` prop, not the value at mount. A disabled thumb is not submitted. `required` only sets `data-required` (a range input always has a value).

## Accessibility notes

- **Roles.** Each thumb is a native `slider` (`aria-valuenow`, `aria-valuemin`, `aria-valuemax` and `aria-valuetext` from the formatted value). In a range, a thumb's min and max are its neighbours'. The Root is a `group` named by the Label; thumbs are named "Minimum" / "Maximum" (two) or "Value N of M" (more) after the Label, customisable through `messages.thumbLabel`.
- **Vertical** sliders set `aria-orientation="vertical"`.
- **Value text.** `formatOptions` and `locale` format `aria-valuetext` and ValueText from one source, so they never disagree.
- **Known AT quirk.** VoiceOver in interaction mode may read the previous value (same on the APG example).
- **Touch AT.** TalkBack and iOS VoiceOver adjust the native input directly with no key or pointer event; this is adopted as `INPUT.CHANGE` and committed once.
- **Pointer targets.** Give the Control enough height (and thumbs enough size) for touch: the Control, not the thin Track, receives the press.

## Styling

Style the `data-*` attributes above, or import `@rind-ui/theme/slider.css`: structural defaults for the Control, Track, Indicator, Thumb and Markers, for both orientations and RTL, with forced-colors support. Set `--rind-slider-thumb-size` when using `thumbAlignment="contain"`.

## Testing

Contract actions: `focusThumb`, `step`, `toEdge`, `setValue`, `pressTrack`, `pointerDown`, `pointerMove`, `pointerUp`, `cancelDrag`, `adjustNative`, `resetForm` (clicks a button named "Reset"). Queries: `values`, `valueText`, `bounds`, `focusedThumb`, `isDragging`, `orientation`, `formValues`.

```tsx
import { getSlider } from "@rind-ui/testing"

render(<VolumeControl />)
const volume = getSlider(screen, { name: "Volume" })
await volume.step(0, "increase")
expect(await volume.values()).toEqual([41])
await volume.pressTrack(75) // pointer steps need layout (a real browser)
await volume.adjustNative(0, 35) // what TalkBack / iOS VoiceOver do
expect(await volume.valueText(0)).toBe("35")
```

Keyboard actions work in jsdom (`volume.via("keyboard").setValue(0, 30)` steps there); `pressTrack` and the pointer-drag actions need a layout engine and throw a clear error without one. The same test runs with a Playwright `page`.

## Tested with

<!-- tested-with:slider -->
_No manual screen-reader pass recorded yet._
<!-- /tested-with -->
