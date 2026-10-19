# Rating

A row of stars to give a score from 1 to `count`, optionally in half stars. The one focusable element is a visually hidden native `<input type="range">` (role `slider`), so screen readers announce "3 of 5 stars" and touch screen readers adjust it with a swipe. The stars are decoration (`aria-hidden`), drawn from each Item's `data-state`. A hidden input carries the form value, `required` and reset ([hidden-form-input](../guides/hidden-form-input.md)).

## When to use

- **Use it for** a score the user gives on a short fixed scale: a review, a satisfaction survey, a favourite level.
- **Over a native `<input type="range">`**: it draws the scale as stars with a hover preview, half stars by pointer position, and a clear gesture, while a native range input still gives keyboard, screen-reader and touch adjustment. Over a [Radio Group](radio-group.md) of stars: half stars and "no rating" fit one value, and arrows never wrap from five stars to one.
- **Don't use it for** a long or continuous range: use a [Slider](slider.md). Don't use it for a few named choices ("Poor", "Good", "Great"): use a [Radio Group](radio-group.md) or a [Segmented Control](segmented-control.md).
- **Don't use it for** showing a score nobody changes (an average under a product): render the stars yourself with an `aria-label` such as "4.5 out of 5", or use `readOnly` when the score must stay focusable in a form.

```tsx
import { Rating } from "@rind-ui/react"

<Rating.Root name="stay" defaultValue={0} allowHalf onValueChange={(value) => save(value)}>
  <Rating.Label>Your stay</Rating.Label>
  <Rating.Control>
    {[1, 2, 3, 4, 5].map((i) => (
      <Rating.Item key={i} index={i} />
    ))}
  </Rating.Control>
</Rating.Root>
```

## API

<!-- api:rating -->

## Anatomy

| Part | `data-part` | Element |
|---|---|---|
| `Rating.Root` | `root` | `<div>`; `data-value` carries the value. |
| `Rating.Label` | `label` | `<label>` (no `for`: it would override the input's own name on iOS); a press focuses the Rating. |
| `Rating.Control` | `control` | `<div>`; the row of stars and the pointer surface. It renders the range input (`data-part="input"`) and the form input (`data-part="hidden-input"`) after its children, and carries the keyboard ring. |
| `Rating.Item` | `item` | `<span aria-hidden="true">`; one star, `index` 1 to `count`. |

`data-state` on an Item is `full`, `half` or `empty`. It follows the hover preview while a pointer is over the stars (`data-previewing` on every part, `data-previewed` on the stars inside the preview), else the value. `data-disabled`, `data-readonly`, `data-required` and `data-invalid` mirror the state on every part.

## Keyboard

| Key | Action |
|---|---|
| Tab | The Rating is one tab stop (the range input). |
| Arrow Right / Arrow Up | One step more: a star, or half a star with `allowHalf`. Arrow Left increases in RTL. |
| Arrow Left / Arrow Down | One step less. Below one step (to 0, no rating) only with `allowClear`. |
| Page Up / Page Down | A whole star more or less. |
| Home / End | The lowest value (0 with `allowClear`, else one step) / `count`. |
| Enter | Does nothing here; inside a form it submits it. |

Arrows never wrap from the last star to the first.

## Pointer and touch

- A press sets the value **where it lands**: with `allowHalf` the first half of a star (the right half in RTL) is half a star. The preview is never what a press commits.
- Hovering previews the value under the pointer: the stars change, the value, `aria-valuenow` and the form value do not. Leaving the stars, a key or a form reset ends the preview. A touch never previews; a tap sets the value.
- With `allowClear`, pressing the star of the current value clears it (0). Home and the arrows do the same from the keyboard.
- A press focuses the range input without a focus ring, so the keys work next.

## Value text

`aria-valuetext` reads "3 of 5 stars", "3.5 of 5 stars" in the locale's digits, and "No rating" for 0. Replace it with `messages={{ valueText: ({ value, formatted, count }) => … }}` (or per scope through `RindProvider messages`).

## Form participation

`name` submits the value as a string, `""` while unrated. `required` makes the form invalid while unrated, with the browser's own message; focus then goes to the range input. A form reset restores the current `defaultValue`. A disabled Rating, or one in a disabled fieldset, submits nothing. Inside a [Field](field.md) the Field's Label names it and its Description and ErrorMessage describe it.

## Read-only and disabled

- **`readOnly`**: focusable and announced (`aria-readonly="true"`), presses focus it, keys, presses and assistive-technology adjustments change nothing, no hover preview.
- **`disabled`**: the range input is disabled, out of the tab order and not submitted.

## Accessibility notes

- **Slider, not radios.** One native range input is one tab stop with one value, so half stars, no rating and the count ("of 5") need no extra radios. `aria-required` is not allowed on a slider: say "required" in the Label or a Field Description.
- **Name.** The Label, or the Label of the [Field](field.md) around it, names the slider: render one (it may be visually hidden).
- **Stars by shape.** Every star draws its outline, the filled ones also their fill, so a state does not rely on colour. Under forced colors the outline is `CanvasText` and the fill `Highlight`.
- **Half-star targets.** With `allowHalf` each half is half a star wide; the keys are the full-size alternative.

## Testing

```tsx
import { getRating } from "@rind-ui/testing"

render(<Review />)
const stay = getRating(screen, { name: "Your stay" })
await stay.rate(4) // presses star 4 (or steps there with the keyboard)
expect(await stay.valueText()).toBe("4 of 5 stars")
await stay.via("keyboard").rate(2)
await stay.hover(5) // a pointer preview: needs layout (a real browser)
expect(await stay.value()).toBe(2)
```

Contract actions: `focus`, `rate`, `pressStar`, `step`, `toEdge`, `hover`, `leave`, `adjustNative` (what TalkBack and iOS VoiceOver do), `resetForm` (clicks a button named "Reset"). Queries: `value`, `valueText`, `stars`, `isPreviewing`, `isDisabled`, `isReadOnly`, `formValue`. Half-star presses and the hover preview need a layout engine; in jsdom a press is a whole star.

## Tested with

<!-- tested-with:rating -->
_No manual screen-reader pass recorded yet._
<!-- /tested-with -->
