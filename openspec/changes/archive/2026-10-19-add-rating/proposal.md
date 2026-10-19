## Why

Rating ("Rating Group") ships in four libraries and its bug history repeats: hover and the
no-value state leaking into `aria-checked`, an extra "Empty" radio that breaks the count
("2 of 6" for five stars), half stars built from clipped overlapping radios, a click that
commits something other than what the hover showed, Up that decreases, clearing that is
pointer-only, and RTL half stars drawn in the wrong star. One native range input avoids the
whole class: one tab stop, one value, half steps and "no rating" on the same axis, and the
TalkBack / iOS VoiceOver adjustment the cross-cutting notes already require for sliders.

Research: [rating](../../../docs/research/rating.md) ·
[accessibility](../../../docs/research/accessibility.md) §5, §6, §9 ·
[assistive-tech-and-a11y-testing](../../../docs/research/assistive-tech-and-a11y-testing.md)
causes G, J, K ·
[native-platform](../../../docs/research/native-platform.md) §8

Depends on: `add-foundations`, `add-a11y-foundations` (keys with `value` context, modality,
`focusSafely`, visually hidden input style, `format.number`), `add-checkbox`
(`hidden-form-input`), `add-field` (`field-control`), `add-theme-system`, `add-slider`
(test adapters `box`, `pointer`, `fill`; the `valued` trait).

## What Changes

- A public **Rating** in `@rind-ui/core` (machine, connect, contract, messages, meta) and
  `@rind-ui/react` (parts `Root`, `Label`, `Control`, `Item`; the Control renders the range
  input and the form input).
- Value 0 (no rating) to `count` (default 5) in steps of 1, or 0.5 with `allowHalf`;
  `allowClear`; `disabled`, `readOnly`, `required`, `invalid`; `name`, `form`; `locale`,
  `dir`, `messages`; controllable `value` / `defaultValue` / `onValueChange`.
- Keyboard on the range input (arrows, Page keys, Home/End, RTL mirrored, no wrap); a press
  on a star sets the value at its position; a hover preview that changes nothing but the
  stars; assistive-technology adjustment of the native input.
- `getRating` driver, model-based tests, `rating.css` (stars drawn by the stylesheet),
  site example and skin, docs page.

## Capabilities

### New Capabilities

- `rating`: the Rating component — anatomy, value and grid, keyboard, pointer and preview,
  assistive-technology adjustment, ARIA, form participation, data attributes, contract,
  invariants, theme.

### Modified Capabilities

None.

## Non-goals

- A display-only score (`role="img"` with a label): consumers render it; `readOnly` covers
  the focusable case.
- Steps finer than 0.5, drag-to-rate on touch, typing digits.
- Custom icons in the theme: an Item's children are the consumer's; the theme draws a star.
- `onPreviewChange` (hover text such as "Good"): the render state carries `preview`.
- Framework adapters other than React; fx.

## Impact

- New: `packages/core/src/components/rating/`, `packages/react/src/rating/`, `getRating` in
  `@rind-ui/testing`, `packages/theme/src/rating.css` (family `range`), site example and skin,
  `docs/components/rating.md`.
- No new dependency.
