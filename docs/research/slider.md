# Slider — research

Status: done · Wave: 2

A Slider picks one value (single thumb) or several ordered values (range / multi-thumb)
from a numeric interval by dragging a thumb, pressing the track, or with the keyboard.
Seven of the nine libraries ship it (all but Headless UI and Ariakit). The cross-cutting
notes already decided the hardest part: every thumb is a **visually hidden native
`<input type="range">`** ([native-platform.md §8](native-platform.md),
[assistive-tech-and-a11y-testing.md](assistive-tech-and-a11y-testing.md) causes G and J).
This note records how the others built it, the bug history, and the decisions
`add-slider` builds on.

Sources read 2026-10-14 (local clones, paths relative to each repo). React Aria's real
sources live in `packages/react-aria/src/slider/*` and
`packages/react-stately/src/slider/useSliderState.ts` (read with `git show HEAD:`).

## Pattern

- WAI-ARIA APG: [Slider](https://www.w3.org/WAI/ARIA/apg/patterns/slider/) and
  [Slider (Multi-Thumb)](https://www.w3.org/WAI/ARIA/apg/patterns/slider-multithumb/).
- Roles and attributes: each thumb is a `slider` (implicit on `input[type=range]`) with
  `aria-valuenow`, `aria-valuemin`, `aria-valuemax`; `aria-valuetext` when the number
  alone is not the human value ("€20", "Tuesday"); `aria-orientation="vertical"` for a
  vertical slider (horizontal is the default); a name on every thumb. Multi-thumb: each
  thumb's `aria-valuemin`/`aria-valuemax` are bounded by its neighbours ("the minimum
  of the upper thumb is the value of the lower thumb"), and the thumbs keep a **fixed
  tab order** that does not change when values change. A group (`role="group"`)
  labelled by the visible label wraps the thumbs.
- Keyboard: Right/Up increase one step; Left/Down decrease one step; Home → minimum;
  End → maximum; PageUp/PageDown (optional) change by a larger step. In RTL the
  horizontal arrows mirror (accessibility.md §6: Left increases in RTL, Up always
  increases). Shift+Arrow as a large step is a common addition (Radix, Zag, Base UI,
  React Aria), not APG.
- WCAG 2.5.7 Dragging Movements (AA): dragging needs a single-pointer alternative —
  pressing the track at a point moves the nearest thumb there. 2.5.8 target size: the
  thumb is small, so the theme expands its hit area (`--rind-hit-area`).

## How the others built it

### Base UI

- Source: `base-ui/packages/react/src/slider/{root/SliderRoot.tsx, control/SliderControl.tsx,
  thumb/SliderThumb.tsx, thumb/prehydrationScript.template.js, indicator/SliderIndicator.tsx,
  value/SliderValue.tsx, label/SliderLabel.tsx, utils/*}`.
- Parts: `Root` (`role="group"`, `aria-labelledby` the Label), `Label`, `Value`
  (output), `Control` (the pointer surface), `Track`, `Indicator` (the fill), `Thumb`
  (a `div` wrapping a nested `<input type="range">`).
- Props: `value`/`defaultValue` (`number | number[]`, the shape is preserved in
  callbacks), `onValueChange(value, details)` with `reason` (`input-change`,
  `track-press`, `drag`, `keyboard`) and `activeThumbIndex`, cancelable;
  `onValueCommitted(value, details)`; `min`/`max`/`step`/`largeStep` (default 10);
  `minStepsBetweenValues`; `thumbCollisionBehavior: "push" | "swap" | "none"` (default
  `push`); `thumbAlignment: "center" | "edge" | "edge-client-only"`; `orientation`;
  `format` (`Intl.NumberFormatOptions`) + `locale`; `name`, `form`, `disabled` (also per
  thumb). Thumb: `getAriaLabel(index)`, `getAriaValueText(formatted, value, index)`,
  `index` (required for SSR of range sliders).
- Notable:
  - The thumb's input **is** the slider for AT and keyboard: `role` is implicit,
    `aria-valuenow`/`aria-valuetext` are set on it, it carries `name`/`form`, and its
    native `onChange` (TalkBack increments, which do not send keys — chromium 40816094,
    quoted in `SliderThumb.test.tsx`) goes through `handleInputChange`. Keys are
    handled in `onKeyDown` with `preventDefault`, so step logic is the library's.
  - The input is visually hidden but sized `100%` of the thumb "so that VoiceOver's
    focus indicator matches the thumb's dimensions", with `writing-mode: vertical-lr`
    (`vertical-rl` in RTL) when vertical.
  - Pointer: `setPointerCapture` on the Control, document-level `pointermove`/`pointerup`
    listeners while pressing, **and** a `touchstart` path that keeps tracking the finger
    after the browser cancels the pointer to pan (tests: "Without `touch-action: none`,
    the browser cancels the pointer once it starts panning"). A press on a thumb keeps
    the pointer's offset from the thumb centre (`pressedThumbCenterOffsetRef`), so the
    thumb does not jump. A press on the track picks the closest enabled thumb; stacked
    thumbs at `max` pick the lowest index so they can move. `dragging` turns on only
    after 2 moves (`INTENTIONAL_DRAG_COUNT_THRESHOLD`).
  - Rounding: `roundValueToStep` rounds `(value - min) / step` and fixes the decimals to
    `max(decimals(step), decimals(min))`, avoiding `0.30000000000000004`.
  - `edge` alignment measures the thumb and control and, to avoid a flash before
    hydration, injects a **prehydration `<script>`** that positions thumbs from the input
    attributes.
  - Default `aria-valuetext` for two thumbs is `"<value> start range"` / `"end range"`:
    hard-coded English.
- Problems: the keyboard handler **blurs and re-focuses** the input to force
  `:focus-visible` after a pointer focus, and that cycle runs before the value update,
  so VO reads the previous value (BU#5296, open; AT note cause G). `onValueChange`
  clones the native event to rewrite `target` for form libraries. The prehydration
  script needs CSP allowances. See Bug history.

### React Aria / RAC

- Source: `react-aria/src/slider/{useSlider.ts, useSliderThumb.ts, utils.ts}`,
  `react-stately/src/slider/useSliderState.ts`, `react-aria-components/src/Slider.tsx`.
- Parts (RAC): `Slider`, `Label`, `SliderOutput`, `SliderTrack`, `SliderThumb` (renders a
  `VisuallyHidden` `<input type="range">` inside the thumb `div`).
- State: `values: number[]` internally, `onChange`/`onChangeEnd` in the shape the user
  passed; `minValue`/`maxValue`/`step`; `pageSize` = 10 % of the range snapped to the
  step and at least one step; per-thumb `isDisabled`; `getThumbMinValue(i)` /
  `getThumbMaxValue(i)` are the neighbours' values, used both for clamping and for the
  input's `min`/`max`. No `minStepsBetweenThumbs`, thumbs cannot cross.
- Notable:
  - **Native input per thumb** with `name`, `form`, `min`/`max` = neighbour bounds,
    `aria-valuetext` always set from `Intl.NumberFormat` (`formatOptions`), and
    `onChange` → `setThumbValue` (the AT path); `useFormReset` restores the default.
  - The Label has **no `for`**: "VoiceOver on iOS causes this to override the
    `aria-labelledby` on the thumb" ([WebKit 172464](https://bugs.webkit.org/show_bug.cgi?id=172464));
    label click focuses the first thumb manually because "Safari does not focus
    `<input type="range">` elements when clicking on an associated `<label>`".
  - Each thumb input is labelled `aria-labelledby="<group label> <own id>"` plus its own
    `aria-label`, so the name is "Price Minimum".
  - `SliderOutput` is an `<output for="thumb ids">` with `aria-live="off"` (an
    `<output>` is implicitly `role=status`, a live region).
  - The output text for two thumbs uses `NumberFormat#formatRange` ("20–80"), and
    `Intl.ListFormat` for more.
  - Track press: closest thumb, ties broken toward the side of the press; `touch-action:
    none` on track and thumb. Keyboard through `useMove` (arrows, Shift = page step) and
    `useKeyboard` (PageUp/Down, Home/End); `onChangeEnd` fires after each key.
- Problems: VO reads the old value on arrow (RA#5583 — also in the APG example);
  `aria-valuetext` out of sync with a custom output (RA#6402). See Bug history.

### Zag / Ark UI

- Source: `zag/packages/machines/slider/src/{slider.machine.ts, slider.connect.ts,
  slider.style.ts, slider.utils.ts, slider.dom.ts}`; Ark
  `ark/packages/react/src/components/slider/*`.
- Parts: `Root`, `Label`, `ValueText`, `Control`, `Track`, `Range`, `Thumb`,
  `HiddenInput` (per thumb, `type="text" hidden`), `MarkerGroup`, `Marker`,
  `DraggingIndicator`.
- Machine: `idle → focus → dragging`; events `POINTER_DOWN`, `THUMB_POINTER_DOWN`,
  `POINTER_MOVE`, `POINTER_UP`, `POINTER_CANCEL`, `FOCUS`, `BLUR`, `ARROW_INC/DEC`,
  `HOME`, `END`, `SET_VALUE`, `INCREMENT`, `DECREMENT`. Value is always `number[]`.
  `onValueChangeEnd` is queued in a microtask after every step and on pointer up.
- Notable: `thumbAlignment: "contain" | "center"` (default `contain`, measured with a
  ResizeObserver — thumbs are `visibility: hidden` until measured); `origin: "start" |
  "center" | "end"` for the range fill; `thumbCollisionBehavior` (default `none`);
  `minStepsBetweenThumbs`; markers with `data-state="under-value | at-value |
  over-value"`; per-thumb `aria-valuemin`/`aria-valuemax` from neighbours; `largeStep`
  default `10 × step`; form reset and fieldset-disabled tracking; `touch-action: none`
  and `user-select: none` on the control.
- Problems: the thumb is a `div[role=slider]`, so TalkBack cannot adjust it (cause J);
  value text cached in Safari (ZG#3099, cause H); thumbs invisible before hydration with
  `contain`. See Bug history.

### Radix / Reka UI

- Source: `radix/packages/react/slider/src/slider.tsx` (1,099 lines); Reka
  `reka-ui/packages/core/src/Slider/*` (a Vue port with the same model).
- Parts: `Root`, `Track`, `Range`, `Thumb` (`span[role=slider]`), a `BubbleInput` per
  thumb inside a form.
- Props: `value`/`defaultValue` (`number[]` only), `onValueChange`, `onValueCommit`,
  `min`/`max`/`step`, `minStepsBetweenThumbs`, `orientation`, `dir`, `inverted`, `name`,
  `form`, `disabled`.
- Notable: values are kept sorted and the moving index follows the sort (thumbs swap);
  `inverted` flips the slide direction and the **keys** with it (`BACK_KEYS` per slide
  direction, ArrowUp decreases when sliding from top); `getThumbInBoundsOffset` keeps the
  thumb inside the track (contain-like) without measuring; default thumb names
  "Minimum"/"Maximum" (2 thumbs) or "Value i of n" — hard-coded English;
  `setPointerCapture` on the slider and moves gated on `hasPointerCapture`; Shift+Arrow
  and PageUp/Down = 10 steps; form `reset` listener.
- Problems: `span[role=slider]` is not adjustable by TalkBack (RX#2850, open); VO reads
  the previous value (RX#2303); value drift with float steps; `onValueCommit` firing
  without a change. See Bug history.

### Bits UI

- Source: `bits-ui/packages/bits-ui/src/lib/bits/slider/{slider.svelte.ts, types.ts,
  helpers.ts, components/*}`.
- Parts: `Root`, `Range`, `Thumb`, `ThumbLabel`, `Tick`, `TickLabel`.
- Props: `type: "single" | "multiple"` (decides the value shape), `step: number |
  number[]` (an array is a list of snap points), `autoSort`, `thumbPositioning: "exact"
  | "contain"`, `trackPadding` (an SSR-friendly alternative to measuring for contain),
  `onValueCommit`.
- Notable: `touch-action: pan-y` on a horizontal root and `pan-x` on a vertical one, so
  the page can still scroll across a slider.
- Problems: `span[role=slider]`; see Bug history.

### Kobalte

- Source: `kobalte/packages/core/src/slider/{create-slider-state.ts, slider-thumb.tsx,
  slider-input.tsx, slider-track.tsx, slider-fill.tsx}`.
- React Aria's state model in Solid. The thumb is a `span[role=slider]` **and** a
  visually hidden `<input type="range" tabIndex=-1>` that is *not* `aria-hidden`, with
  its own `aria-valuetext`/`aria-label` — two `slider` nodes per thumb in the AX tree.
  The input's `onChange` re-forces its `value` from state because a "controlled" Solid
  input keeps the native value.

## Accessibility

Rules from [accessibility.md](accessibility.md) and the AT note applied to this pattern.

- **Native range input per thumb (decided).** TalkBack does not send arrow keys to a
  `div[role=slider]`; it adjusts native range inputs instead
  ([chromium 40816094](https://issues.chromium.org/issues/40816094), RA#1400, RX#2850,
  BU#2575 — cause J). iOS VoiceOver's swipe up/down adjusts a native range the same way.
  So each thumb renders an `<input type="range">` that is the focusable, named control.
  It is visually hidden (`core/dom/visually-hidden` input variant) but sized to the
  thumb so VO's focus outline matches (Base UI), and it has `pointer-events: none` so
  pointer input reaches the thumb and the control. Exactly one `slider` per thumb in the
  AX tree (Kobalte's span + input is two).
- **How the native input coexists with our machine.** Three input paths, one machine:
  1. *Keyboard*: `keydown` on the input becomes a logical key (`a11y/keys.ts`,
     `value: true` context) and a machine event; we `preventDefault`, so the browser's
     own stepping never runs and step, large step, bounds and Home/End are ours.
  2. *Pointer*: pointer events land on the Control/Thumb, never on the input; the drag
     module turns them into percent events; the machine moves the value and focuses the
     thumb's input.
  3. *AT adjust* (TalkBack, iOS VO, any AT that sets the value): the browser changes
     the input's value and fires native `input`/`change`; we adopt it as an
     `INPUT.CHANGE` machine event (the `hidden-form-input` adoption rule) and re-sync
     the input if the machine rejects or snaps it.
  After every step the machine writes the input's `value` property (never React's
  controlled `value`, which would also write the `value` attribute that form reset
  restores), and `aria-valuenow`/`aria-valuetext` come from the same snapshot, in the
  same task as the event — the fix for cause G (BU#5296). No blur/refocus ever.
- **Value text.** Always emit `aria-valuetext`, formatted with `Intl.NumberFormat`
  (`formatOptions`, component locale) and passed through a `messages.valueText`
  function, as React Aria does: speech then never depends on how an AT renders a raw
  number (some speak a native range as a percentage of its range), and units/currency
  are spoken ("€20"). For two thumbs, each thumb's name comes from `messages.thumbLabel`
  ("Minimum"/"Maximum"; "Value i of n" for more — Radix's defaults, but translatable),
  combined with the group label by self-reference (`aria-labelledby="label self"` +
  `aria-label`), so VO says "Price, Minimum, €20, slider". Keep the visible value text
  and `aria-valuetext` from the same formatter (RA#6402).
- **Label.** Root is `role="group"` labelled by the Label. The Label is a `<label>`
  **without `for`** (WebKit 172464: on iOS a `for` overrides the thumb's
  `aria-labelledby`), and a pointer press on it focuses the first enabled thumb, since
  Safari does not focus range inputs from a label (React Aria). The focus is a pointer
  focus: no `data-focus-visible` (control-label's modality rule, invariant 12).
- **Value output.** A visible ValueText must not be a live region: AT already speaks the
  focused slider's value; an `<output>` is implicitly `role=status` (RA sets
  `aria-live="off"`). We render a plain element, `aria-hidden` is not needed (it is
  visible text, not a duplicate control).
- **Focus visible.** Focus is on the hidden input; `data-focus-visible` is computed by
  connect from modality and put on the Thumb (and Root), so the theme draws the ring on
  the visible thumb. Pointer press focuses the thumb's input without a ring (Base UI
  uses `focus({ focusVisible: false })`; we use `focusSafely` with pointer modality).
- **Forced colors.** Sliders disappear in High Contrast when the track and thumb are
  backgrounds only (ARK#3421, RX#2993 — cause K). Theme: track and thumb get
  `CanvasText` borders, the indicator `Highlight`, the focused thumb an outline; nothing
  relies on `box-shadow`.
- **Target size.** Thumb ≥ 24×24 CSS px through `--rind-hit-area`; the Control is the
  2.5.7 alternative (press anywhere).
- **Motion.** Value changes are instant; the theme may transition the thumb only for
  keyboard steps and under `prefers-reduced-motion: no-preference`, never while dragging
  (`data-dragging`), or the thumb lags the pointer.
- **RTL and vertical.** Horizontal sliders start at the inline start (right in RTL);
  vertical sliders always grow upward. Keys follow `keyboard-interactions` (Left
  increases in RTL, Up always increases, Home/End/PageUp/PageDown never mirror). The
  vertical native input gets `aria-orientation="vertical"` and `writing-mode:
  vertical-lr` so AT and the input agree on the axis.
- **Touch.** The Control sets `touch-action: pan-y pinch-zoom` (horizontal) or `pan-x
  pinch-zoom` (vertical) so a page can still scroll and zoom across a slider (Bits); the
  thumb sets `touch-action: none`. When the browser takes a touch for scrolling it
  sends `pointercancel`: the drag is cancelled and the value reverts (the user meant to
  scroll), instead of Base UI's parallel `touchmove` tracking.
- **Announcements.** None: the focused slider's own value change is what AT speaks.
  Invariant 23 holds (no `aria-live` of its own).
- **Native-platform check.** The native range input is used for semantics and forms;
  not as the visible control (one thumb only, per-engine pseudo-element styling, no
  range, no markers).

## Bug history

Issues marked "read" were opened and read in full (body and comments); the others are
from search results and titles. About 60 slider issues found, 47 read, 44 kept.
Ariakit has no slider (its two slider issues are feature requests); Headless UI has none.
No issue about native form reset restoring a slider's default was found in any tracker.

| Library | Issue | Symptom | Root cause | Fix / status | Lesson for rind-ui |
|---|---|---|---|---|---|
| Base UI | [BU#5296](https://github.com/mui/base-ui/issues/5296) (open, read) | VO announces the previous value after VO-cursor interaction | The key handler blurs and re-focuses the input to force `:focus-visible` *before* the value update | Unfixed; maintainer suspects VO | Never blur/refocus; value attributes in the same step as the key (invariant 16) |
| Base UI | [BU#5294](https://github.com/mui/base-ui/issues/5294) (closed, read) | Stale value on the first key after a pointer focus | Same ordering | Folded into #5296 | Same |
| Base UI | [BU#4954](https://github.com/mui/base-ui/issues/4954) (closed, read) | VO off by one | VO Utility "Arrow-key Quick Nav" setting | Not a bug | Manual protocol resets VO settings (cause L) |
| React Aria | [RA#5583](https://github.com/adobe/react-spectrum/issues/5583) (closed, read) | VO reads one value behind | macOS VO; reproduces on the APG example | Closed as VO bug | Compare with APG before chasing it |
| Radix | [RX#2303](https://github.com/radix-ui/primitives/issues/2303) (closed, read) | VO out of sync with VO+arrow | Most likely the same VO bug | No fix | Same |
| Base UI | [BU#2575](https://github.com/mui/base-ui/issues/2575) (closed, read) | TalkBack cannot adjust | TalkBack uses "set value", only real inputs support it (chromium 40816094); `tabindex=-1` nodes became extra TalkBack focus targets (chromium 40875648) | Native range per thumb (PR #2578); extra targets removed (#2631, #4242) | One range input per thumb; nothing else in the slider focusable, not even `tabindex=-1` |
| Radix | [RX#2850](https://github.com/radix-ui/primitives/issues/2850) (open, read) | TalkBack swipe does not move the thumb | `span[role=slider]` | Deferred to Radix 2.0 (breaking) | Decide native inputs before 1.0 |
| React Aria | [RA#1400](https://github.com/adobe/react-spectrum/issues/1400) (closed, read) | TalkBack skips the `<output>` text | Value only in the output | Self-referencing labelledby proposed | Value lives in each thumb's `aria-valuetext` |
| React Aria | [RA#6402](https://github.com/adobe/react-spectrum/issues/6402) (open, read) | No custom `aria-valuetext` | Only `formatOptions` | Open | `messages.valueText({ value, formatted, index })` per thumb |
| React Aria | [RA#4101](https://github.com/adobe/react-spectrum/issues/4101) (open) | Tedious to adjust on iOS VO | One step per swipe | Open | Document `step` choice; AT adjust uses native step |
| Radix | [RX#1760](https://github.com/radix-ui/primitives/issues/1760) (open, read) | `onValueCommit` sometimes not called | Change check looked at one thumb; release outside an iframe | PRs unmerged | Commit on release when any value differs from the drag-start snapshot |
| Radix | [RX#4154](https://github.com/radix-ui/primitives/issues/4154) (closed, read) | Commit gets the previous render's value | `pointerup` handled before React rendered the last move | Fixed | Commit reads the machine's latest value, not render state |
| Radix | [RX#3698](https://github.com/radix-ui/primitives/issues/3698) (closed, read) | Cannot narrow a range to one value (commit skipped) | Wrong `hasChanged` | Fixed | One equality helper for change and commit |
| Radix | [RX#3619](https://github.com/radix-ui/primitives/issues/3619) (open, read) | Keyboard changes never commit | Commit wired to pointer only | Open | Every key step commits |
| Kobalte | [KB#352](https://github.com/kobaltedev/kobalte/issues/352) (closed, read) | `onChangeEnd` not fired with arrows | Pointer only | Fixed | Same |
| Kobalte | [KB#322](https://github.com/kobaltedev/kobalte/issues/322) (closed, read) | `onChangeEnd` fires twice | Duplicated end handlers | Fixed | One end path; test exactly one commit |
| Kobalte | [KB#284](https://github.com/kobaltedev/kobalte/issues/284) (open) | Drag sometimes does not commit | Same class as RX#1760 | Open | Same |
| Zag | [ZG#2497](https://github.com/chakra-ui/zag/issues/2497) (closed, read) | Fast drag: end value differs from last change | Stale value at end | Fixed | Same as RX#4154 |
| Base UI | [BU#3599](https://github.com/mui/base-ui/issues/3599) (closed, read) | Range commit never fires with a pointer | Range-only pointer bug | Fixed | Commit tests for single and range |
| Base UI | [BU#3311](https://github.com/mui/base-ui/issues/3311), [BU#5068](https://github.com/mui/base-ui/issues/5068) (closed, 3311 read) | Commit fires on later unrelated clicks | Document `pointerup` listener never removed | Fixed | Document listeners live exactly as long as one drag |
| Base UI | [BU#5637](https://github.com/mui/base-ui/issues/5637) (closed, read) | After `pointercancel`, the next tap anywhere commits a stale value | Cancel path missing | PR #5639 | `pointercancel` / `lostpointercapture` end the drag |
| Base UI | [BU#1910](https://github.com/mui/base-ui/issues/1910) (closed, read) | Release outside an iframe leaves `data-dragging` stuck | No `pointerup` received | #2059 | Pointer capture + `lostpointercapture` |
| Base UI | [BU#5772](https://github.com/mui/base-ui/issues/5772) (closed, read) | Tap on the track changes the value but never commits | Commit required a move | #5779 | Press without move = change + commit |
| Base UI | [BU#5595](https://github.com/mui/base-ui/issues/5595) (closed, read) | Held arrow commits every step | By design (native parity; keyup can be lost) | Won't change; commit has a reason | Commit per key step, `details.reason` lets apps debounce |
| Radix | [RX#3010](https://github.com/radix-ui/primitives/issues/3010) (open, read) | Android drag fires one change then stops | Browser took the gesture for scrolling (`pointercancel`) | Workaround `touch-action: none` | Connect sets `touch-action` on the Control by orientation |
| Radix | [RX#570](https://github.com/radix-ui/primitives/issues/570) (closed, read) | `preventDefault` on touchstart blocked page scroll; passive warnings | JS scroll blocking | Moved to CSS `touch-action` | CSS `touch-action`, no JS blocking |
| Base UI | [BU#1295](https://github.com/mui/base-ui/issues/1295) (closed, read) | Long press on a thumb selects text / opens a menu (iOS) | iOS text selection | CSS + iOS handling | `user-select: none` on the Control; iOS text-selection module during drags |
| React Aria | [RA#9493](https://github.com/adobe/react-spectrum/issues/9493) (closed, read) | Scroll lock in a modal breaks range drag on iOS | `touchmove` `preventDefault` | PR #9506 | Scenario: slider inside a modal on iOS still drags |
| Radix | [RX#1966](https://github.com/radix-ui/primitives/issues/1966), [RX#2156](https://github.com/radix-ui/primitives/issues/2156) (open, read) | Thumb jumps on grab near the edges | Inset interpolation vs pointer mapping | By design | Pointer → value uses the same geometry as the thumb position; keep the grab offset |
| Base UI | [BU#981](https://github.com/mui/base-ui/issues/981), [BU#1530](https://github.com/mui/base-ui/issues/1530) (closed, read) | Thumb overflows the track; padding breaks tracking | Centre alignment only | `thumbAlignment="edge"` (#2540), needs measurement | `contain` alignment from a CSS size variable, no measurement for rendering |
| Base UI | [BU#4303](https://github.com/mui/base-ui/issues/4303) (closed, read) | `NaN%` inside `display:none` | 0/0 from a zero-size rect | Fixed | Zero-size geometry yields no value, never NaN |
| Bits | [BITS#1337](https://github.com/huntabyte/bits-ui/issues/1337) (closed, read) | Thumb overruns the track | Centre alignment | Edge option | Same as BU#1530 |
| Reka | [RK#1557](https://github.com/unovue/reka-ui/issues/1557) (closed, read) | Thumb jumps when dragged from its edge | Grab offset ignored | Fixed | Keep the pointer-to-thumb-centre offset |
| Zag | [ZG#541](https://github.com/chakra-ui/zag/issues/541) (closed, read) | Value jumps when pressing a thumb off-centre | Track press logic ran on the thumb | "Design"; users disagree | A press on a thumb never changes the value |
| Base UI | [BU#1360](https://github.com/mui/base-ui/issues/1360), [BU#1406](https://github.com/mui/base-ui/issues/1406) (closed, read) | Ends unreachable with slow drags; controlled value ignored | Thumb position from raw pointer % instead of the snapped value | Reverted | Position is a pure function of the value |
| Base UI | [BU#1781](https://github.com/mui/base-ui/issues/1781) (closed, read) | Thumb does not snap while dragging | Same | #1750 | Same |
| Base UI | [BU#4547](https://github.com/mui/base-ui/issues/4547) (closed, read) | Keyboard steps give `0.30000000000000004` | `value + step` unrounded | #4548 | One rounding helper on every path |
| Bits | [BITS#1518](https://github.com/huntabyte/bits-ui/issues/1518) (closed, read) | step 0.1 → `1.2000000000000002` (regression) | Float add | Fixed | Same + regression test |
| Radix | [RX#3852](https://github.com/radix-ui/primitives/issues/3852) (closed, read) | step ≤ 1e-7 breaks dragging | Decimal count via `toString` fails on `"1e-7"` | Fixed | Decimal count handles exponent notation |
| Zag | [ZG#3195](https://github.com/chakra-ui/zag/issues/3195), [ZG#2504](https://github.com/chakra-ui/zag/issues/2504) (closed, read) | Modifier steps off-grid; Shift+Arrow past max resets to 0 | Multiplied step not snapped/clamped | Fixed; `largeStep` | Snap then clamp after every multiplier |
| Radix | [RX#715](https://github.com/radix-ui/primitives/issues/715), [RX#1054](https://github.com/radix-ui/primitives/issues/1054) (closed, read) | PageUp decreased; Home/End scrolled the page | Wrong sign; no `preventDefault` | Fixed | PageUp increases; `preventDefault` on every handled key |
| Kobalte | [KB#293](https://github.com/kobaltedev/kobalte/issues/293) (closed, read) | PageUp/Down change the value and scroll | Missing `preventDefault` | #282 | Same |
| Several | [RX#2247](https://github.com/radix-ui/primitives/issues/2247), [BU#1220](https://github.com/mui/base-ui/issues/1220), [BU#1602](https://github.com/mui/base-ui/issues/1602), [BU#1731](https://github.com/mui/base-ui/issues/1731), [RA#6408](https://github.com/adobe/react-spectrum/issues/6408) (open), [RX#730](https://github.com/radix-ui/primitives/issues/730) (read) | Thumbs swap or pass each other; stacked thumbs at max cannot move; focus stays on the wrong thumb after crossing | Sorting vs hard constraint; z-order picks the thumb | Base UI swap mode (#2856); RA open | Stacked thumbs: pick by movement direction; swap is opt-in and moves focus with the value |
| Zag / Kobalte | [ZG#2488](https://github.com/chakra-ui/zag/issues/2488), [KB#494](https://github.com/kobaltedev/kobalte/issues/494) (closed, read) | `minStepsBetweenThumbs`: wrong initial positions; frame drops near the limit | Gap maths; constraint loop | Fixed | Gap = minSteps × step; normalise defaults once at creation |
| RA / Ark | [RA#5644](https://github.com/adobe/react-spectrum/issues/5644), [ARK#3270](https://github.com/chakra-ui/ark/issues/3270), [RA#4978](https://github.com/adobe/react-spectrum/issues/4978) (closed, read) | External change reverts on next drag; thumb does not snap back after a refused change; value > max rendered off-track | Internal ref out of sync with props; no clamp | Fixed / partial | Drag starts from the resolved value; clamp for rendering |
| RA / Reka | [RA#942](https://github.com/adobe/react-spectrum/issues/942), [RK#1691](https://github.com/unovue/reka-ui/issues/1691) (closed, read) | Track press moved a disabled thumb; disabled slider renders thumb at 0 % | Nearest-thumb ignored disabled; position skipped | Fixed | Disabled affects interaction, never position |
| Several | [RX#2970](https://github.com/radix-ui/primitives/issues/2970), [BITS#524](https://github.com/huntabyte/bits-ui/issues/524), [ZG#258](https://github.com/chakra-ui/zag/issues/258), [KB#439](https://github.com/kobaltedev/kobalte/issues/439) (closed, read) | `inverted` ≈ RTL confusion; `dir` not forwarded; Home/End wrong in RTL | Direction composed in several places | Fixed / by design | One function for axis direction, used by pointer, keys and styles |
| Several | [RX#2541](https://github.com/radix-ui/primitives/issues/2541), [RK#669](https://github.com/unovue/reka-ui/issues/669), [RX#2454](https://github.com/radix-ui/primitives/issues/2454), [RX#4096](https://github.com/radix-ui/primitives/issues/4096), [BITS#1443](https://github.com/huntabyte/bits-ui/issues/1443) (closed, read) | Slider blocks Enter-to-submit; decimal step makes the hidden input invalid; single `name[]` for a range; events on programmatic changes; infinite loop in a form | Hidden-input semantics | Fixed; per-thumb `name` | Native range per thumb with correct `min`/`max`/`step`; per-thumb `name`; events only for user changes |
| Radix | [RX#1900](https://github.com/radix-ui/primitives/issues/1900), [RX#615](https://github.com/radix-ui/primitives/issues/615) (closed, read) | "SSR broken" (NaN max); thumb loses focus on change (index collection remount) | Bad input; index known only after two renders | User error / rewrite | Thumb index explicit (`index` prop) so SSR is stable; dev warnings for NaN/min ≥ max |

## Known pitfalls

1. **Commit semantics** are the largest bug class (RX#1760, RX#4154, RX#3698, RX#3619,
   KB#322, KB#352, ZG#2497, BU#3599, BU#3311, BU#5637, BU#5772, BU#1910): one end path,
   driven by the machine; commit = the latest machine value; one commit per key step,
   per native adjust, per pointer release that changed anything (a tap included); none
   after a cancel.
2. **Float drift** on every path (BU#4547, BITS#1518, RX#3852, ZG#3195): snap
   `min + round((v - min) / step) * step`, fixed to the decimals of `step` and `min`,
   decimal count from the exponent form too.
3. **Position not derived from value** (BU#1360, BU#1781, RA#5644, ARK#3270): thumbs and
   indicator are pure functions of the resolved value.
4. **Stacked and crossing thumbs** (RA#6408, BU#1731, BU#1602, RX#2247): choose by press
   point and movement direction, never by z-index.
5. **Touch scrolling** (RX#3010, RX#570, BU#1295, RA#9493): CSS `touch-action`, no JS
   scroll blocking, no text selection.
6. **TalkBack needs native inputs** (BU#2575, RX#2850), and nothing else in the slider
   may be focusable, not even with `tabindex=-1` (chromium 40875648).
7. **VO off-by-one** (BU#5296 self-inflicted; RA#5583, RX#2303 VO itself): no
   blur/refocus; compare with the APG example and reset VO settings before filing.
8. **Direction composed in many places** (RX#2970, ZG#258, KB#439): one axis function.
9. **Geometry** (RX#1966, BU#981, BU#4303, RK#1557, ZG#541): one formula for render and
   pointer mapping; keep the grab offset; zero-size → no value.
10. **Hydration** (Zag `contain` hides thumbs until measured; Base UI ships a
    prehydration script; RX#615 index after two renders): positions must render on the
    server from the value alone.

## Testing notes

- **No layout in jsdom.** Pointer-to-value needs the Control's rect; jsdom returns zeros
  and `@rind-ui/testing/setup` polyfills `setPointerCapture`/`releasePointerCapture` as
  no-ops and `hasPointerCapture` as `false`. So: (1) the drag module must not gate moves
  on `hasPointerCapture` (Radix does) — it listens on the owner document while a drag is
  active, which works with and without capture; (2) a zero-size Control produces no
  value (never `NaN`); (3) pointer paths of the model run in browser mode only, jsdom
  runs keyboard, virtual and native-input paths (`testMachine({ modalities })`).
- **The machine is layout-free.** Pointer events reach it as a fraction along the
  logical axis (RTL, vertical and thumb-size compensation already applied by
  `core/dom`), so every pointer transition is testable in Node with numbers.
- **AT adjust path.** A driver must be able to set a range input's value the way
  TalkBack does (property + native `input`/`change`, no key events). Playwright's
  `locator.fill()` does this for range inputs; the DOM adapter uses the native setter
  and dispatches the events.
- **Pointer steps.** Model edges `idle → dragging → idle` need separate down / move / up
  steps at a position inside a part (not one whole-gesture drag), in both adapters.
- **Cause G regression check.** A focus-event spy on the thumb input during keyboard
  steps (AT note invariant 16): no `blur`/`focus` may fire, and `aria-valuenow` equals
  the oracle value right after the key.
- Driver actions: `focusThumb(i)`, `step(i, "increase" | "decrease", { large })`,
  `toEdge(i, "min" | "max")`, `setValue(i, v)` (keyboard: presses; pointer: drag),
  `pressTrack(v)`, `pointerDown(i)` / `pointerMove(v)` / `pointerUp()` /
  `cancelDrag()` (Escape), `adjustNative(i, v)` (AT path), `resetForm()`. Queries:
  `values()`, `valueText(i)`, `bounds(i)`, `focusedThumb()`, `isDragging()`,
  `orientation()`, `formValues()`.

## Reado

`organisms/settings/SystemTab.tsx` uses a native `<input type="range">` (mascot size, 90–240, step 10) with a separate `px` text. It migrates to `Slider` with `formatOptions: { style: "unit", unit: "pixel" }`, so the spoken value gets the unit the visible text already shows. Ark's `ColorPicker.ChannelSlider` stays until Color Slider exists.

## Decisions

- **Parts**: `Root` (`div role="group"`, labelled by Label), `Label` (`<label>` without
  `for`; press focuses the first enabled thumb), `ValueText` (plain `output`-free text of
  all values: `formatRange` for two, `Intl.ListFormat` for more — React Aria), `Control`
  (pointer surface; `touch-action`, `user-select: none`), `Track`, `Indicator` (the
  fill), `Thumb` (`div`, `index` prop, renders its range input), `ThumbInput` (internal
  to Thumb: the native `<input type="range">`), `MarkerGroup` + `Marker` (`aria-hidden`,
  `data-state="under-value | at-value | over-value"` — Zag), `Description` (via
  `control-label`'s Description requirement on every thumb input).
- **Values**: controllable `value` / `defaultValue` / `onValueChange(value, details)`
  with `number | readonly number[]`; the shape the consumer passes is the shape the
  callbacks get (Base UI, React Aria); internally always an array (Zag). `equal` =
  element-wise. `onValueCommit(value, details)` at the end of each interaction (see
  pitfalls 1). `details.reason` = the machine event; `details.thumb` = index.
- **Numbers**: `min` 0, `max` 100, `step` 1, `largeStep` = 10 % of the range snapped to
  the step and at least one step (React Aria's `pageSize`; Zag `10 × step`, Base UI 10).
  Values live on the native grid `min + k × step` (a native range input sanitises to
  that grid, so an off-grid `max` is unreachable; dev warning). Out-of-range or unsorted
  defaults are normalised once with a dev warning; `min ≥ max` is a dev error.
- **Multi-thumb**: `minStepsBetweenThumbs` (gap = n × step); each thumb's
  `aria-valuemin`/`aria-valuemax` and input `min`/`max` are the neighbour bounds (APG,
  React Aria, Zag); keyboard and native adjust always stop at those bounds;
  `thumbCollision: "stop" | "push" | "swap"` (default `stop`) applies to pointer drags
  only. `swap` moves focus to the thumb that now holds the dragged value. Stacked thumbs:
  a press picks the thumb that can move toward the press point; on a drag from a stack,
  the first movement direction decides.
- **Keys** (from `a11y/keys.ts` with `value: true`): `INCREASE`/`DECREASE` one step
  (Shift: `largeStep`), `PAGE_PREV` (PageUp) / `PAGE_NEXT` (PageDown) = ± `largeStep`,
  `FIRST`/`LAST` → thumb bounds, `DISMISS` (Escape) cancels a drag; all handled keys
  `preventDefault`. RTL/vertical mirroring is the keys module's (Left increases in RTL,
  Up always increases).
- **Machine**: states `idle`, `dragging`. Events `POINTER.DOWN { fraction, thumb?,
  modality }`, `POINTER.MOVE { fraction }`, `POINTER.UP`, `POINTER.CANCEL`, logical keys
  carrying `thumb`, `INPUT.CHANGE { thumb, value }` (native adjust), `RESET`, `FOCUS {
  thumb, modality }`, `BLUR`, `INPUT.SYNCED`. Context: `focusedThumb`, `activeThumb`
  (last used, for z-order), `dragStart` (values at press), `pending` (user-change marker
  for the form input). The machine is layout-free: fractions are computed by
  `core/dom/pointer-drag.ts` from the Control rect, the axis direction, the grab offset
  and the thumb size.
- **Alignment**: `thumbAlignment: "center" | "contain"` (default `center`). `contain` is
  CSS-only: connect writes the position as `calc()` over `--rind-slider-thumb-size`, so
  the server render is final (no measurement, no prehydration script); pointer mapping
  measures the real thumb at press time.
- **`data-*`**: Root/Control/Track/Indicator/Thumb carry `data-orientation`,
  `data-disabled`, `data-readonly`, `data-dragging`, `data-focus`, `data-focus-visible`;
  Thumb adds `data-index`, `data-active`, `data-dragging` (its own); position custom
  properties `--rind-slider-thumb-percent` (Thumb), `--rind-slider-start` /
  `--rind-slider-end` (Indicator).
- **Contract**: actions `focusThumb`, `step`, `toEdge`, `setValue`, `pressTrack`,
  `pointerDown`, `pointerMove`, `pointerUp`, `cancelDrag`, `adjustNative`, `resetForm`;
  queries `values`, `valueText`, `bounds`, `focusedThumb`, `isDragging`, `orientation`,
  `formValues`; traits `valued`, `directional`, `form-associated`.
- **Deliberately different**: native range input per thumb with our machine owning the
  value (Base UI's model without the blur/refocus); no `<output>`; translatable thumb
  names; CSS-only `contain`; `touch-action` by orientation with cancel = revert (Base
  UI keeps tracking touches instead); no `inverted` (its key mirroring contradicts
  "ArrowUp always increases").

## Open questions

- Does `pointercancel` → revert feel right on Android when a diagonal drag starts?
  Verify on a device; the alternative (Base UI's parallel touch tracking) is a contained
  change in `pointer-drag.ts`.
- Snap-point arrays for `step` (Bits) and an `inverted` mode: not in this change; add if
  a consumer asks.
- Native range inputs announce as percentages on some AT when `aria-valuetext` is
  missing; we always set it, so this is not verified per AT — confirm in the manual
  protocol.
