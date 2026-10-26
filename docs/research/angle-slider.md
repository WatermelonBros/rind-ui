# Angle Slider — research

Status: done · Wave: 3

An Angle Slider picks one angle, 0 up to (not including) 360 degrees, by dragging a thumb around a
circle, pressing the circle, or with the keyboard. Think of a light direction, a rotation, a
gradient angle, a compass bearing. Two of the nine libraries ship it: Ark/Zag (`angle-slider`) and,
outside the nine, Mantine (`AngleSlider`, with the `useRadialMove` hook). React Aria's
[ColorWheel](color-wheel.md) is the same geometry bound to a hue. Radix, Base UI, Headless UI,
Ariakit, React Aria (as a generic control), Reka UI, Bits UI and Kobalte have no angle slider (no
component, no request found, 2026-10-26). It is a Slider whose track bends back on itself, and
every bug below comes from that one fact: the ends meet, so "clamp to the range" is the wrong
rule.

Builds on [slider.md](slider.md) (hidden native `<input type="range">` per thumb, the `Slider` machine
and its reasons), [color-picker.md](color-picker.md) (Color Slider is a Slider with a binding; the
Color Area keyboard events), [native-platform.md](native-platform.md) §8, and
[accessibility.md](accessibility.md) §6 (keyboard, RTL), §9 (`Intl`).

Sources read (local shallow clones and raw files, 2026-10-26):

| Library | Files |
|---|---|
| Zag / Ark | `zag/packages/machines/angle-slider/src/{angle-slider.machine,angle-slider.connect,angle-slider.utils,angle-slider.types,angle-slider.dom,angle-slider.anatomy}.ts`, `CHANGELOG.md` |
| Mantine | `packages/@mantine/core/src/components/AngleSlider/AngleSlider.tsx`, `packages/@mantine/hooks/src/use-radial-move/use-radial-move.ts` (raw from GitHub main) |
| React Aria | `react-stately/src/color/useColorWheelState.ts` (the wrap rules, shared with [color-wheel.md](color-wheel.md)) |
| Trackers | chakra-ui/zag, chakra-ui/ark, mantinedev/mantine (search "angle slider"); issues marked "title only" were not opened |
| Platform | `<input type="range">`, `Intl.NumberFormat` unit `degree`, pointer events, `getBoundingClientRect` |

## Pattern

- WAI-ARIA APG: [Slider](https://www.w3.org/WAI/ARIA/apg/patterns/slider/) with a circular
  geometry. No APG example is circular. Roles and keys are the slider's: `role="slider"` with
  `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, a name, and `aria-valuetext` when the number
  alone is not the human value.
- Keys (APG): Right/Up increase one step, Left/Down decrease, Home → minimum, End → maximum,
  Page Up/Down a larger step. APG does not wrap. For a circle, wrapping from the top value to 0 is
  what React Aria and Mantine do (see below).
- `aria-orientation` has no meaning for a circular slider; leave it off.
- WCAG 2.5.7 Dragging Movements: pressing the circle at a point moves the value there (a
  single-pointer alternative). WCAG 1.4.1 / 1.4.11: the angle must not be carried by position
  alone; the thumb needs a visible text value or a labelled output.
- `aria-valuetext`: "90 degrees" reads better than "90". `Intl.NumberFormat(locale, { style:
  "unit", unit: "degree", unitDisplay: "long" })` is the platform way and localises. Neither
  library sets one; both screen-reader announcements are the bare number.
- The value space: an angle is `[0, 360)`. The value 360 is the value 0. This is the root of the
  inconsistent `max` values below.

## How the others built it

### Zag / Ark

- **Anatomy**: `root`, `label`, `control`, `thumb`, `valueText`, `markerGroup`, `marker`
  (plus a `hiddenInput`).
- **Props**: `value` / `defaultValue` (number), `onValueChange({ value, valueAsDegree })`,
  `onValueChangeEnd`, `step` (1), `disabled`, `readOnly`, `invalid`, `name`, `dir`,
  `aria-label`, `aria-labelledby`.
- **States**: `idle`, `focused`, `dragging`. `CONTROL.POINTER_DOWN` → `dragging`; keys act in
  `focused`.
- **Thumb**: a `div role="slider"` with `aria-valuemin=0`, **`aria-valuemax=360`**,
  `aria-valuenow`, `tabIndex=0`. The form value is a separate `<input type="hidden">`.
  The `MAX_VALUE` constant is **359**: the announced range and the real range disagree.
- **Keys**: the keymap maps ArrowLeft **and ArrowUp** to decrement and ArrowRight **and
  ArrowDown** to increment, the reverse of the slider pattern for the vertical arrows. Home →
  0, End → 359. Step from `getEventStep` (Shift for the larger step). No Page keys, no
  `aria-valuetext`.
- **Pointer**: the Control's `pointerdown` computes the angle from the control's bounding rect
  centre (`getPointAngle`); `trackPointerMove` listens on the document. A press on the thumb
  records an `angularOffset` so the drag keeps the grab point (fix in 1.26.4: grabbing the thumb
  off-centre made the value jump).
- **Snapping**: `constrainAngle(degree, step)` takes `ceil(x / step)` and `round(x / step)`; the
  condition `upperStep >= clamped / step` is always true (`ceil(x) >= x`), so every pointer
  position snaps **up**, not to the nearest step; `359` is mapped to `0`.
- **RTL**: since 1.34.1 the angle is mirrored (`(360 - angle) % 360`) when `dir="rtl"`, `dir`
  reaches every part, and `--marker-display-value` positions markers.
- **CSS variables**: `--value` and `--angle` on the root (the angle after RTL mirroring);
  markers get `--marker-value` and `--marker-display-value`, and `data-state` `under-value |
  at-value | over-value`.
- **Value text**: a `valueText` part is only an id/anchor; the consumer renders the number.

### Mantine

- One component plus `useRadialMove(onChange, { step, onChangeEnd, onScrubStart, onScrubEnd })`.
- **Props**: `value` / `defaultValue` / `onChange`, `onChangeEnd`, `step`, `marks`, `restrictToMarks`
  (snap and keys jump between marks), `withLabel`, `formatLabel`, `size`, `thumbSize`, `disabled`,
  `name` (a hidden input), `hiddenInputProps`.
- **Element**: a `div role="slider"`, `tabIndex` 0 (-1 when disabled), `aria-valuemin=0`,
  `aria-valuemax=360`, `aria-valuenow`, `aria-disabled`, `aria-label`. Value range is 0–359.
- **Keys**: ArrowLeft/Down decrement, ArrowRight/Up increment, with **wrap**: 0 → 359 and
  359 → 0 (implemented by hand, then `normalizeRadialValue`). Home → 0, End → 359.
- **Pointer**: `useRadialMove` attaches `mousedown` / `touchstart` and, while active,
  `mousemove` / `mouseup` / `touchmove` / `touchend` on the document; angle from
  `Math.atan2` around the element centre, `360 - deg`. **Mouse and touch events, not pointer
  events, and no pointer capture.** `normalizeRadialValue` repeats the "always rounds up"
  shape (`Math.ceil(x) >= x`).
- **A11y gap noticed by users**: the disabled state was only `data-disabled`, not
  `aria-disabled` ([mantine#9237](https://github.com/mantinedev/mantine/issues/9237), closed
  2026-10).

### React Aria (the wheel's rules, for comparison)

- `increment`: past the maximum, **wrap to the minimum**. `decrement` from 0: jump to the
  largest multiple of the step below 360 (`roundDown(360 / s) * s`) with the comment "make sure
  you can always get back to 0". Pointer values are `mod`-ed into `[0, 360)`.
- The thumb is a native `input[type=range]` with `aria-valuetext` including the hue name.

## Bug history

| Bug | Where | Cause | Decision |
|---|---|---|---|
| Thumb has no accessible name (axe: "ARIA input fields must have an accessible name") | [zag#2781](https://github.com/chakra-ui/zag/issues/2781) (read), fixed 1.26.3 | The thumb had only `role` and values | The input is named by the Label, or by `aria-label` / `aria-labelledby` from props; with neither, a development warning (the rule every named control follows, accessibility.md §2). |
| Dragging from off-centre of the thumb makes the value jump | zag 1.26.4 changelog | Value taken straight from the pointer angle | A grab offset (angle between press and the value) is kept through the drag. |
| Max value wrong (360 vs 359) | zag 0.78.0 changelog ("Fix angle slider max value"); source still announces 360 with a 359 maximum | `[0, 360]` vs `[0, 360)` | One range, `[0, 360)`: the native input's `max` is the last grid value below 360; `aria-valuemax` is that same number. |
| `dir` prop ignored, no `dir` on parts | [zag#2968](https://github.com/chakra-ui/zag/issues/2968) (read), fixed 1.34.1 | The prop was declared and not connected | `dir` is a prop of every part through the shared helper; geometry is **not** mirrored (below). |
| Touch scrubbing not smooth | zag 1.17.2 changelog | Not stated | `touch-action: none` on the Control; per-move work is CSS variables only; `pointercancel` is a cancel. |
| Every pointer position snaps up | source reading (Zag `constrainAngle`, Mantine `normalizeRadialValue`; no issue found) | `ceil(x) >= x` is always true | Snap to the nearest step (`shared/step-math.ts` `snap`), then wrap `>= 360` to 0. A test at the midpoint between two steps. |
| Up arrow decrements | source reading (Zag keymap; no issue found) | Copied the circle's visual "turn left" onto the vertical arrows | Up and Right increase, Down and Left decrease, exactly the slider pattern (RTL swaps only the horizontal pair). |
| Mouse drag broken after an upgrade | [mantine#8883](https://github.com/mantinedev/mantine/issues/8883) (read, first lines), closed 2026-05 | Not established | One drag lifecycle (`trackPointer`: capture, document listeners removed on end, cancel on `pointercancel`, lost capture and a hidden document) shared with Slider and Color Area, with a test per termination. |
| RTL issues | [mantine#7822](https://github.com/mantinedev/mantine/issues/7822) (read), closed 2025-05 | General RTL report, not specific to the angle slider | See the RTL decision. |
| Disabled not exposed | mantine#9237 (above) | `data-disabled` only | The native `disabled` input carries it; `readOnly` becomes `aria-readonly`. |
| Package 404 | [zag#2059](https://github.com/chakra-ui/zag/issues/2059) (title only) | Packaging | Not relevant. |
| Anatomy export missing in React, Solid, Svelte | [ark#3620](https://github.com/chakra-ui/ark/issues/3620) (title only) | Packaging | Every part is exported through the meta test that already guards all components. |

## Accessibility decisions

- **Thumb**: a visually hidden native `<input type="range" min="0" max="<last grid value>"
  step>` (the Slider decision, [slider.md](slider.md)); the visible thumb is a `div` that only
  rotates. The input is the control for name, value, form, reset and AT.
- **Name**: Label (`for`), else `aria-label` / `aria-labelledby`.
- **`aria-valuetext`**: the angle formatted with `Intl.NumberFormat` unit `degree` in the
  component's locale ("90 degrees"); overridable with `messages.valueText({ value, formatted })`.
- **Keyboard**: arrows step; Home → 0, End → the last grid value; Page Up/Down and Shift+arrow
  a large step. At the end of the range, an arrow **wraps** (the circle has no end); wrapping can
  be switched off with `wrap={false}` and then clamps like a slider. Because the machine
  handles the keys (to wrap), it does not rely on the browser's range handling; AT-originated
  native `input` events are accepted as `INPUT.CHANGE` (the Color Area event).
- **RTL**: a circle is geometry, not text. The angle runs clockwise from the top in both
  directions and is not mirrored. `dir` only swaps the horizontal arrow pair (Left increases in
  RTL), as every slider ([accessibility.md](accessibility.md) §6). This differs from Zag's
  1.34.1 mirroring; see Open questions.
- **Pointer**: a press anywhere on the Control sets the value (WCAG 2.5.7); a press on the thumb
  keeps the grab offset. A press within a few pixels of the centre is ignored (the angle of a
  zero vector is undefined and the thumb would flick).
- **No drag-only control**: keyboard and press both work with no drag.
- **Forced colors**: the thumb and track keep a visible border under `forced-colors`
  (theme rule shared with Slider).
- **Announcements**: none besides the native range's value change.

## Decisions for `add-angle-slider`

1. **Parts**: `Root`, `Label`, `Control` (the pointer surface, `touch-action: none`), `Thumb`
   (wraps the hidden `input`), `Value` (an `<output>` for the formatted angle), `MarkerGroup`,
   `Marker` (`value`).
2. **Machine**: states `idle | dragging`; no hover or focus state (the rule decided in
   [splitter.md](splitter.md)). Events: `POINTER.DOWN { angle | null, onThumb }`, `POINTER.MOVE { angle }`,
   `POINTER.UP`, `DRAG.CANCEL`, `STEP { steps: 1 | -1, page }`, `EDGE { edge }`,
   `INPUT.CHANGE { value }`, `RESET`, `VALUE.SYNCED`, focus and blur (as Color Area).
   Context: `value` (controllable number, `[0, 360)`), `grabOffset`.
3. **Props**: `value` / `defaultValue` / `onValueChange({ value, reason })` (reasons `drag`,
   `press`, `keyboard`, `input`, `reset`), `onValueCommit` once per interaction, `step` (1),
   `largeStep` (15), `wrap` (true), `disabled`, `readOnly`, `invalid`, `name`, `form`, `locale`,
   `dir`, `messages`, `aria-label`, `aria-labelledby`.
4. **Shared geometry module**: a new `dom/pointer-angle.ts` (angle and radius of a pointer around
   an element's centre, using the border box and `css-zoom.ts`; wrap and step helpers in
   `shared/step-math.ts`) built on `trackPointer` from `dom/pointer-drag.ts`. Written for this
   component and the Color Wheel together (the second user is in the same wave), not before.
5. **`data-*`**: `data-scope="angle-slider"`, `data-part`, `data-dragging`, `data-disabled`,
   `data-readonly`, `data-invalid`, `data-focus` / `data-focus-visible` on the Thumb,
   `data-state` `under-value | at-value | over-value` on Markers. CSS variables on Root:
   `--rind-angle-slider-angle` (degrees, for `rotate`) and `--rind-angle-slider-fraction`
   (0 to 1).
6. **Contract**: locate by the Label or the only Angle Slider in the target. Actions `setAngle`
   (a press at the point of that angle), `drag` (from an angle to an angle, with a keyboard twin
   through steps), `step`, `toEdge`, `cancelDrag`, `pointerDown/Move/Up`; queries `value`,
   `isDragging`, `valueText`. Traits `valued`, `directional`.
7. **Reuse**: the Slider's hidden-input and reason model, `trackPointer`, `step-math` (`snap`,
   `gridMax`), the Color Area's `STEP` / `EDGE` / `INPUT.CHANGE` events, `shared/range-value.ts` for
   `aria-valuetext`.
8. **Deliberately different from the others, and why**:
   - Value space `[0, 360)` with one `max` everywhere (Zag announces 360, uses 359).
   - Snap to nearest, not up.
   - Up increases (Zag decrements).
   - A native `input[type=range]`, not `div role="slider"` + hidden `input[type=hidden]`
     (no form or reset special-casing).
   - Pointer events with capture (Mantine uses mouse and touch).
   - Geometry is not mirrored in RTL.
9. **Non-goals**: partial arcs (`min` / `max` other than a full circle), counter-clockwise or
   non-top origins (the theme rotates with CSS), multiple thumbs, `restrictToMarks`, a
   `<datalist>` of ticks.

## Open questions

- **RTL geometry**: Zag mirrors the angle in RTL (its own decision, 1.34.1); this note does not.
  A consumer in an RTL locale may expect a mirrored dial. Revisit only with a request; a
  `direction` prop (`clockwise | counterclockwise`) would cover it without tying it to `dir`.
- **Wrap for AT**: APG sliders do not wrap, and a screen-reader user holding Right Arrow past 359
  hears the value drop to 0. Test with NVDA and VoiceOver; the fallback is `wrap={false}`.
- **Partial arc** (a 270-degree knob): a different component (a Knob) or `min` / `max` here.
  Out of scope.
- **Number of grid values**: with a `step` that does not divide 360 (7), the last value is
  357 and wrap goes 357 → 0 (a gap of 3). Document, or force the step to a divisor?
