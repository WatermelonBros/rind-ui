# Color Wheel — research

Status: done · Wave: 3

A Color Wheel picks a **hue** by dragging a thumb around a ring painted with the hue spectrum, or with
the keyboard. It is the round counterpart of a Color Slider on the hue channel; it is usually paired
with a Color Area (saturation and brightness) to make a full picker. Of the nine libraries, React Aria
ships it (`useColorWheel`, `ColorWheel` in React Aria Components), and Kobalte ports it to Solid.
Ark/Zag has no wheel (its ColorPicker uses a hue strip; `docs/components.md` lists it as "Missing in
Ark"), and Reka UI ships Color Area and Color Slider but no wheel. Radix, Base UI, Headless UI,
Ariakit and Bits UI ship no colour components (searches "color wheel", "hue", 2026-10-26).
Outside the nine, Adobe's Spectrum Web Components has `sp-color-wheel`. rind-ui already owns the
colour model and the hue channel (Color Slider, Color Area, archived `add-color-*`), and the
circular geometry arrives with [Angle Slider](angle-slider.md) in the same wave, so this component
is mostly a binding, as Color Slider is to Slider.

Builds on [color-picker.md](color-picker.md) (the colour family note: model, colour names,
`aria-valuetext`, forced colours, the Kobalte and React Aria review), [angle-slider.md](angle-slider.md)
(geometry, wrap, keys), [slider.md](slider.md), [accessibility.md](accessibility.md) §6, §9,
[assistive-tech-and-a11y-testing.md](assistive-tech-and-a11y-testing.md) causes G, J.

Sources read (raw files from GitHub main and a local shallow clone, 2026-10-26):

| Library | Files |
|---|---|
| React Aria | `packages/react-aria/src/color/useColorWheel.ts`, `packages/react-stately/src/color/useColorWheelState.ts` |
| Kobalte | `packages/core/src/color-wheel/{color-wheel-root,color-wheel-track,color-wheel-thumb,color-wheel-input,color-wheel-value-label,color-wheel-context,create-color-wheel-state}.tsx/.ts` |
| rind-ui | `core/src/components/color-slider/color-slider.connect.ts`, `color-area/color-area.machine.ts`, `shared/color/*`, `core/src/dom/pointer-drag.ts` |
| Trackers | adobe/react-spectrum, adobe/spectrum-web-components, kobaltedev/kobalte (search "color wheel"); "title only" marks issues not opened |
| Platform | CSS `conic-gradient`, `mask` / `clip-path`, `forced-color-adjust`, `touch-action`, `Intl` |

## Pattern

- WAI-ARIA APG: **none** for a wheel. It is the [Slider](https://www.w3.org/WAI/ARIA/apg/patterns/slider/)
  pattern on one channel (hue), with circular geometry (see [angle-slider.md](angle-slider.md)): a
  `slider` with `aria-valuemin=0`, `aria-valuemax=360`, `aria-valuenow`, a name, and an
  `aria-valuetext` that says more than the number.
- A hue number alone ("240") means little. React Aria sets `aria-valuetext` to the formatted hue
  and the hue's name ("240°, blue"). The default name is the channel's localised name ("Hue") when
  there is no label.
- WCAG 2.5.7: pressing the ring at a point sets the hue. WCAG 1.4.1: the hue is also available as a
  value (hex or channel text), supplied by sibling components, not by the wheel itself.
- WCAG 1.4.11 and forced colors: the ring is a gradient the user cannot recolour; React Aria sets
  `forced-color-adjust: none` on the track so Windows High Contrast does not flatten it
  (the library's own list of High Contrast issues is still open, react-spectrum#2949, title only).

## How the others built it

### React Aria (`useColorWheel`, `useColorWheelState`)

- **Hooks and parts**: `useColorWheel(props, state, inputRef)` returns `trackProps`, `thumbProps`
  and `inputProps`; the component has `ColorWheel`, `ColorWheelTrack` and `ColorThumb`. It takes
  **`outerRadius` and `innerRadius` as numbers**: the caller tells the hook the geometry.
- **Value**: a `Color` in `hsl` or `hsb` (other spaces are converted); `onChange` and
  `onChangeEnd(Color)`. `step` and `pageStep` come from the hue channel's range.
- **Track**: a `div` sized `outerRadius * 2` with a 13-stop `conic-gradient` (from 90deg) and a
  `clip-path: path(evenodd, ...)` ring, `forced-color-adjust: none`, `touch-action: none`.
- **Pointer**: `onTrackDown` accepts a press only if `innerRadius < radius < outerRadius` (the ring,
  not the hole or the square's corners), sets the hue from the point, and starts a drag by
  window `pointerup` listener tracked by `pointerId`. The thumb drags with `useMove`. A drag
  continues until `pointerup`; mouse needs the primary button without Alt, Ctrl or Meta.
  Fallbacks for no `PointerEvent` use mouse and touch listeners.
- **Hue maths**: `cartesianToAngle`, `roundToStep`, `mod`; `increment` past the maximum wraps to 0;
  `decrement` from 0 goes to the largest step multiple below 360 ("always get back to 0").
  `setHue` ignores `v > 360` by setting 0.
- **Input**: a visually hidden `<input type=range min max step>` with `aria-valuetext`
  (`"<hue>, <hue name>"`), `name`, `form`, `disabled`, `onChange` → `setHue`, and the labelling props.
  The thumb is a decoration; focus goes to the input (`focusInput` after every press and drag end).
- **Keys**: arrows through `useMove` (Shift = page), Page Up/Down through `useKeyboard`; Home/End are
  left to the native input (nothing in the hook handles them).
- **Events**: `onChangeEnd` is fired from `setDragging(false)` when it was dragging; a key press
  brackets itself in `setDragging(true/false)` so it also fires.
- **Default labelling**: with no `aria-label` and no `aria-labelledby`, the hue channel's
  localised name.
- **Display colour**: `getDisplayColor()` is the hue at full saturation and 50% lightness, for the
  thumb's fill.

### Kobalte

- A port: `ColorWheel.{Root,Track,Thumb,Input,ValueLabel}` (the files read; form-control parts such as Label come
  from the shared form-control module);
  `Root` is `role="group"` with `thickness` (default 30) instead of two radii, `getValueLabel`,
  `translations`, `validationState`, `required`, `disabled`, `readOnly`, `name`.
- **Thumb is `div role="slider"`** with `aria-valuenow`, `aria-valuetext`, min/max, labelling,
  its own `onKeyDown`; a separate hidden **Input** carries the same ARIA attributes (the
  thumb element and the input both expose slider semantics, see the colour note).
- **Pointer**: Track and Thumb each use Pointer Events with `setPointerCapture` and
  `hasPointerCapture` checks; the value comes from the pointer's position relative to the track's
  rect centre.

### Spectrum Web Components

`sp-color-wheel` (title-level only): issues about a press selecting a colour outside the ring
([SWC#6261](https://github.com/adobe/spectrum-web-components/issues/6261)), focus ring not shown on
first focus ([#3278](https://github.com/adobe/spectrum-web-components/issues/3278)), tab order
trapped in colour elements ([#1692](https://github.com/adobe/spectrum-web-components/issues/1692)).

## Bug history

| Bug | Where | Cause | Decision |
|---|---|---|---|
| `onChangeEnd` fires twice for one click | [react-spectrum#2247](https://github.com/adobe/react-spectrum/issues/2247) (read), [#2250](https://github.com/adobe/react-spectrum/issues/2250) (read, "in StrictMode"), closed 2021 | Not established; a comment on #2247 ties it to the warning "Cannot update a component while rendering a different component" | Commit is a machine event (`POINTER.UP`, key press) that fires `onValueCommit` once; machine tests count calls. |
| Thumb stays "open" after a double tap on the indicator | [react-spectrum#2814](https://github.com/adobe/react-spectrum/issues/2814) (read), closed 2024 | Not established (closed as a state issue) | A drag has one owner pointer; a second press while dragging is ignored; `pointercancel` and lost capture end it. A test with a double tap. |
| Escape does not close a Dialog while the wheel thumb is focused | [react-spectrum#2252](https://github.com/adobe/react-spectrum/issues/2252) (title only here; color-picker.md records it) | Not established | Escape on the wheel's input bubbles unless a drag is active (Slider's rule). |
| Labelling not useful for a screen reader; wheel announces degrees only | [react-spectrum#4111](https://github.com/adobe/react-spectrum/issues/4111) (title only), [#4101](https://github.com/adobe/react-spectrum/issues/4101) (title only, iOS VoiceOver adjust is tedious) | Value text without the name | `aria-valuetext` carries the hue and its colour name; a native range input gives VoiceOver its adjustable gesture. |
| ColorWheel stretched inside a Form | [react-spectrum#1605](https://github.com/adobe/react-spectrum/issues/1605) (read), closed 2022 | A CSS rule `> * { width: 100% }` for field labels applied to the wheel (from a comment) | The size is a CSS variable the theme owns; the geometry is measured from the rendered Track, never from props. |
| Press selects a hue outside the ring | [SWC#6261](https://github.com/adobe/spectrum-web-components/issues/6261) (title only) | Not read | A press counts only between the inner and outer radius (React Aria's rule), plus a hit-test against the circle, not the square. |
| Focus style missing on first focus; tab order trapped | [SWC#3278](https://github.com/adobe/spectrum-web-components/issues/3278), [#1692](https://github.com/adobe/spectrum-web-components/issues/1692) (titles only) | Not read | One tab stop, the input; `data-focus-visible` from the modality tracker. |
| Windows High Contrast list | [react-spectrum#2949](https://github.com/adobe/react-spectrum/issues/2949) (read, open) | Several components | `forced-color-adjust: none` on the ring in the theme; the thumb keeps a system-colour border. |
| `onChange` runs twice per click in the Area | [kobalte#592](https://github.com/kobaltedev/kobalte/issues/592) (recorded in color-picker.md) | x and y were set separately | One event per press, one commit per interaction. |
| Hue management differs from the slider; hue controls pass the colour to their thumb unexpectedly | [SWC#1257](https://github.com/adobe/spectrum-web-components/issues/1257), [#1256](https://github.com/adobe/spectrum-web-components/issues/1256) (titles only) | Not read | The wheel and the Color Slider read the same hue through the same binding (`colorWithChannel`, `colorMemory`), so they cannot disagree. |

## Accessibility decisions

- **One slider**: the visually hidden native `<input type="range" min="0" max step>` is the only
  `slider` in the tree; the visible thumb is `aria-hidden` decoration (React Aria's shape, not
  Kobalte's duplicate).
- **Name**: Label, else `aria-label` / `aria-labelledby`, else the localised channel name ("Hue")
  from the colour messages.
- **`aria-valuetext`**: `valueText({ channel, value, colorName })`, the Color Slider's string
  ("Hue 240°, blue") by the same function, so the wheel and a hue Color Slider announce alike.
- **Keys**: as [angle-slider.md](angle-slider.md): arrows step (Right/Up increase), Page Up/Down and
  Shift+arrow a larger step, Home → 0, End → the last grid hue, wrap at the ends (React Aria's
  rule, "always get back to 0").
- **Pointer**: a press on the ring sets the hue and starts a drag; a press in the hole or outside the
  circle does nothing. A touch drag is not interrupted by page scroll (`touch-action: none` on the
  Track).
- **Forced colors and contrast**: the ring is not recoloured (`forced-color-adjust: none`); the thumb
  uses `CanvasText` and `Canvas` borders; the thumb's fill is the hue at full saturation (shown, not
  the only cue).
- **No announcements** beyond the native range's value change.
- **Escape**: a drag in progress is cancelled and the value restored; otherwise Escape bubbles.

## Decisions for `add-color-wheel`

1. **Binding, not a machine** (design §5 of Color Slider): `color-wheel.connect.ts` maps the
   Angle Slider machine's value (0..360) to a `Color` and back. The colour binding is the Color
   Slider's own (`colorSliderSpace`, `colorWithChannel`, `colorMemory`, `hueName`,
   `formatChannel`); no hue rule is copied.
2. **Parts**: `Root` (`role="group"`), `Label`, `Track` (the ring and the pointer surface), `Thumb`
   (wraps the hidden `input`), `Value` (`<output>` with the hue text), optional `Description` and
   `ErrorMessage` through Field.
3. **Props**: `value` / `defaultValue` (a colour string or `Color`) / `onValueChange(Color, details)`,
   `onValueCommit`, `colorSpace` (`hsl` | `hsb`, as Color Area), `step`, `largeStep`, `disabled`,
   `readOnly`, `invalid`, `name`, `form`, `locale`, `colorName`, `messages`, `dir`.
4. **Geometry in CSS**: the ring is a `conic-gradient` masked by the theme with a ring thickness
   variable `--rind-color-wheel-thickness` (default 30px, Kobalte's default) and sized by
   `--rind-color-wheel-size`; the machine measures the Track at press time (outer radius from the
   box, inner from the variable via the computed style) so there are no `outerRadius` /
   `innerRadius` props (React Aria's burden, #1605). The thumb is placed with
   `--rind-color-wheel-angle` and CSS `rotate` / `translate`, no per-move inline `left` / `top`.
5. **Hit test**: a press is accepted only between the inner and outer radius, measured with the
   shared `dom/pointer-angle.ts` (angle and radius) from angle-slider; a drag then continues
   anywhere, with the radius ignored (the thumb follows the angle).
6. **`data-*`**: `data-scope="color-wheel"`, `data-part`, `data-dragging`, `data-disabled`,
   `data-readonly`, `data-invalid`, `data-focus` / `data-focus-visible` (Thumb), `data-space`.
   `--rind-color-wheel-thumb-color` carries `hsl(hue 100% 50%)` for the thumb fill.
7. **Contract**: actions `setHue(deg)`, `step`, `toEdge`, `drag(fromHue, toHue)`, `cancelDrag`,
   pointer actions; queries `hue`, `value` (colour string), `isDragging`, `valueText`. Traits
   `valued`, `directional` as Color Slider.
8. **Reuse**: Angle Slider machine and geometry, Color Slider binding and messages, the colour
   model in `shared/color`, `trackPointer`, `range-value.ts` for the value text, Field wiring,
   hidden input for forms (the colour as a string).
9. **Deliberately different from React Aria and Kobalte, and why**: no radius props; one `slider`
   in the tree; the same hue text as Color Slider; one commit per interaction; the machine is the
   Angle Slider's.
10. **Non-goals**: saturation/lightness inside the ring (Color Area), a triangle picker, alpha,
    named hues as a palette, a `ColorPicker` that hosts the wheel (a later change to Color Picker).

## Open questions

- **Color Picker integration**: color-picker.md decided "no wheel in v1". Does the Color Picker
  get a `Wheel` part, or is it composed by the consumer with Color Area? Resolve in the Color Picker
  change, not here.
- **Colour space of a wheel with a non-hue-bearing colour**: for a grey (saturation 0), hue is
  stored in `ColorMemory`; confirm the wheel keeps the remembered hue so the thumb does not jump to
  0 (the Color Slider's rule).
- **Thumb radius**: React Aria centres the thumb on the ring's mid-radius; a theme with a very thin
  ring may want an inset thumb. Decided in the theme, not the component.
- **Hit test shape for a non-square Track**: the Track is square by contract; if a consumer
  stretches it (react-spectrum#1605), do we measure the shorter side? Test in the browser suite.
