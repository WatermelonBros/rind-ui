# Color Picker (and Color Area, Color Slider, Color Swatch, Color Field) — research

Status: done · Wave: 3

One note for the whole colour family, because the libraries ship it as one stack on one colour
model and the bugs cross the component boundaries: Ark's `ColorPicker` (zag `color-picker` +
`color-utils`) is a single machine; React Aria ships `Color` plus `ColorArea`, `ColorSlider`,
`ColorWheel`, `ColorField`/`ColorChannelField`, `ColorSwatch`, `ColorSwatchPicker` and a
`ColorPicker` that only synchronises them; Kobalte ports React Aria's area, slider, wheel, swatch,
field and channel field; Reka ships Area, Slider, Field, Swatch and Swatch Picker over its own
`shared/color` (its Color Picker is a request, reka-ui#501, #1976). Radix, Base UI, Headless UI,
Ariakit and Bits UI ship nothing (Bits UI has a request, bits-ui#1167). `add-color-picker` builds
on this note.

Sources read 2026-10-16 (clones under the research scratchpad, paths relative to each repo). React
Aria's sources are read with `git show HEAD:` (`packages/react-aria/src/color/*`,
`packages/react-stately/src/color/*`, `packages/react-aria-components/src/Color*.tsx`).

## Pattern

- WAI-ARIA APG: there is **no colour picker pattern**. The parts are APG
  [Slider](https://www.w3.org/WAI/ARIA/apg/patterns/slider/) (channel slider, hue strip, alpha
  strip), [Slider (Multi-Thumb)](https://www.w3.org/WAI/ARIA/apg/patterns/slider-multithumb/) (the
  2D area is "two sliders" in `accessibility.md`), [Radio
  Group](https://www.w3.org/WAI/ARIA/apg/patterns/radio/) (a swatch palette: one choice, arrows move
  and check), a text input (hex), a spinbutton (channel inputs) and a non-modal
  [Dialog](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) for the popover.
- Roles and attributes: each channel is an `input[type=range]` (implicit `slider`) with
  `aria-valuenow/min/max/valuetext`; the 2D area exposes two of them (x horizontal, y vertical,
  `aria-orientation`); a swatch is `role="img"` named by a colour name; a swatch choice is a radio;
  channel inputs are `role="spinbutton"` (Number Input); the hex field is a `textbox`.
- Keyboard: slider keys per axis (arrows, Shift/PageUp/PageDown large step, Home/End); area:
  Left/Right x, Up/Down y; hex field commits on Enter/blur; swatches: arrows; the popover: Escape
  closes, focus returns to the trigger.
- WCAG: 1.4.1 (the value is never conveyed by colour alone: value text carries the channel values and a
  colour *name*), 1.4.11 (thumbs need a 3:1 outline on every gradient), 2.5.7 (the area and sliders are
  dragged; keys and typed channel/hex values are the alternative), 2.5.8 (thumb hit areas ≥ 24 px),
  1.3.2 / 2.1.1.

## How the others built it

### Ark UI / Zag (`color-picker`, `@zag-js/color-utils`)

- Source: `zag/packages/machines/color-picker/src/{color-picker.machine,color-picker.connect,color-picker.dom,
  color-picker.types}.ts`, `utils/*`; `zag/packages/utilities/color-utils/src/*`;
  `ark/packages/react/src/components/color-picker/*`.
- API shape: Root (machine), Label, Control, Trigger, Positioner, Content, Area (+AreaBackground,
  AreaThumb), ChannelSlider (+Track, Thumb, Label, ValueText), ChannelInput (`channel` = a colour channel, `hex`
  or `css`), EyeDropperTrigger, SwatchGroup, SwatchTrigger (+SwatchIndicator), Swatch, ValueSwatch, FormatSelect,
  FormatTrigger, View (children only when `format` matches), ValueText, HiddenInput, TransparencyGrid.
  Props: `value`/`defaultValue` (a `Color` **object**, built with `parseColor`), `format` (`rgba|hsla|hsba`, also the
  display and emission space), `open`/`inline`, `closeOnSelect`, `positioning`, `name`, `onValueChange`,
  `onValueChangeEnd`, `onOpenChange`.
- State model: top-level `idle`, `focused` (a channel input focused or trigger blurred, with the `closed` tag),
  `open` with children `idle`/`dragging`; `value` and `format` are bindables. Area/slider keys are separate events
  per key (`AREA.ARROW_LEFT`, `CHANNEL_SLIDER.PAGE_UP`, …). A `Color` is a class hierarchy (`RGBColor`, `HSBColor`,
  `HSLColor`) with `toFormat`, `withChannelValue`, `incrementChannel`, `getChannelRange`, `toString(format)`.
- Notable: `areaValue` is the value converted to `hsba` (or `hsla`) so the area works whatever the format; the
  `format` prop is both the value space and what the inputs show; `Trigger`'s `aria-label` is a hard-coded English
  string ("select color. current color is …"); hex typing waits for Enter/blur "by design" (zag#2473); swatches are
  plain buttons with `data-state=checked`; the hidden input is `type=text` holding the string in the current format.
- Problems: the area thumb is a single `div role=slider` with `aria-valuenow` = the x value only and an English
  `aria-valuetext`; channel sliders are `div role=slider`, not native inputs; `INTERACT_OUTSIDE` resolved to
  `open.idle` so a picker in a Dialog closed once and then never (zag#3043, zag#3067, ark#3414); value is a class
  instance, so a string or a plain object throws (ark#2932); channels only exist in the space the value has (zag#1567,
  ark#1649, zag#2389).

### React Aria (`useColorArea`, `useColorSlider`, `useColorWheel`, `useColorField`, `useColorSwatch`, `ColorPicker`)

- Source: `react-aria/src/color/{useColorArea,useColorAreaGradient,useColorSlider,useColorWheel,useColorField,
  useColorChannelField,useColorSwatch}.ts`, `react-stately/src/color/{Color,useColorAreaState,useColorFieldState,
  useColorPickerState,…}.ts`, `react-aria-components/src/{ColorArea,ColorSlider,ColorField,ColorSwatch,
  ColorSwatchPicker,ColorPicker,ColorThumb,ColorWheel}.tsx`, `intl/color/*.json`.
- API shape: `Color` is an immutable class per space (`RGBColor`, `HSBColor`, `HSLColor`) built by `parseColor` with
  `toFormat`, `getChannelRange` (`minValue, maxValue, step, pageSize`), `withChannelValue`, `formatChannelValue`,
  `getChannelName`, **`getColorName(locale)`** and `getHueName`. `ColorArea` (`colorSpace`, `xChannel`, `yChannel`,
  `xName`, `yName`, `form`), `ColorSlider` (`channel`, `orientation`, `name`), `ColorWheel`, `ColorField` (hex only),
  `ColorChannelField`, `ColorSwatch` (`color`, `colorName`), `ColorSwatchPicker` (a `ListBox` grid or stack) and
  `ColorPicker` (**no popover**: a context provider handing the same colour state to each child).
- State model: `useColorAreaState` keeps the colour in the area's own space and exposes `setColorFromPoint`,
  `incrementX/Y`, `setDragging` (which fires `onChangeEnd` on the true→false edge). The colour is never converted
  back to another space on edit, which is how hue and saturation survive at black, white and grey.
- Notable:
  - **Native inputs.** `ColorArea` renders two visually hidden `input[type=range]` (x and y) with
    `aria-roledescription="2D slider"`, a value text of "name value, name value, name value, colour name" before the
    first change and only the changed channel after it (RA#4110), tab index `-1` and `aria-hidden` on the input that is
    not focused (one "2D slider" in a form-control list), and moves focus to the y input when a vertical key is
    used. `ColorSlider` is a `Slider` (native range) with a channel track background and value text "name value,
    colour name" ("hue name" for hue).
  - **Colour names** from an OKLCH heuristic and a per-locale string table (`getColorName`): "very dark vibrant blue",
    "transparent 50% red". They were added because degrees and percentages mean nothing to a screen reader user
    (RA#4111).
  - `ColorField` text commits on blur **and** Enter, filters input with `/^#?[0-9a-f]{0,6}$/i`, keeps the previous
    value when parsing fails, treats empty as `null`; `ColorSwatchPicker` keys items by `color.toString('hexa')`
    and selects the swatch equal to the current colour.
  - Pointer and keyboard both go through `useMove`; the thumb has its own press target and the container its own
    listener (`isOnColorArea`) so a press on the area jumps the thumb and a press on the thumb does not.
- Problems: no popover; swatch identity is the colour (RA#7918, RA#10251); typed values are lost when a popover
  is dismissed (RA#9748, RA#10445); ColorWheel, ColorArea and ColorSlider labelling on iOS VoiceOver (RA#4101,
  RA#4110, RA#4111); no auto-scroll while dragging (RA#6299); forced colours list still open (RA#2949).

### Kobalte (`color-area`, `color-slider`, `color-wheel`, `color-swatch`, `color-field`, `color-channel-field`)

- Source: `kobalte/packages/core/src/{color-area,color-slider,color-wheel,color-swatch,color-field,
  color-channel-field,colors}/*`.
- A port of React Aria's state and a copy of its colour model (`colors/utils.ts`, 905 lines, own parser, names and
  ranges). `ColorArea` keeps the two hidden range inputs with `aria-roledescription` (translations in `*.intl.ts`);
  `ColorWheel` thumb is a `div role=slider` with `aria-valuenow` = hue.
- Problems: `onChange` ran twice per click because x and y were set separately (kobalte#592); the alpha channel field
  rounded to 0 or 100 % because alpha ranges 0–1 (kobalte#589). No picker (kobalte#360 request).

### Reka UI (`ColorArea`, `ColorSlider`, `ColorField`, `ColorSwatch`, `ColorSwatchPicker`, `shared/color`)

- Source: `reka-ui/packages/core/src/{ColorArea,ColorSlider,ColorField,ColorSwatch,ColorSwatchPicker}/*`,
  `shared/color/{parse,convert,channel,gradient,utils}.ts`.
- Colour values are strings (hex) or plain objects; `ColorAreaRoot` keeps `xValue`, `yValue` and a **separate hue
  ref** "to preserve hue when saturation is 0" and exact floats "to avoid floating-point drift"; `update:modelValue`
  emits hex. Thumbs are `div role=slider` with a single `aria-valuenow`.
- Problems: custom attributes dropped on `ColorFieldRoot` (reka-ui#2545); OKLCH requested (reka-ui#2798, open); a
  general 2D "SliderArea" requested (reka-ui#2455). Colour picker still a request.

## Reado's usage

`reado/src/components/organisms/editor/ColorPickerPopover.tsx`: `ColorPicker.Root open inline value={parseColor(
rgba(r,g,b,a))} onValueChange={d => …d.value.toFormat("rgba").getChannelValue("red"|"green"|"blue"|"alpha")}` with
`Content`, `ValueText`, `Area` + `AreaBackground` + `AreaThumb`, and two `ChannelSlider` (`hue`, `alpha`) each with
`ChannelSliderTrack` + `ChannelSliderThumb`. The panel is positioned by Reado itself (fixed, from a swatch rect) and
closes itself on Escape and outside mousedown, so it uses **`inline`** (no popover, no layer). It re-parses the value
from sRGB on **every render** (a new object each time, always `rgb`), the exact situation of zag#2503 and RA#9509
(hue jumps or locks at grey, black and the right edge). It rounds r/g/b and keeps alpha raw, and formats the result in
the notation of the source file (`hex`, `rgb()`, `hsl()` — Reado's own `formatColor`). Reado needs: `inline` mode, a
controlled value that tolerates a fresh sRGB object per render, area + hue + alpha, a value text in a stable
format, and an `rgb`-space `details.value` with 0–255 channels and 0–1 alpha. See "Decisions".

## Accessibility

Apply [accessibility.md](accessibility.md) and [assistive-tech-and-a11y-testing.md](assistive-tech-and-a11y-testing.md)
(§1.4 "Slider": cause G stale value, cause J TalkBack; "Date fields / calendar" for the dialog) to this pattern.
[native-platform.md](native-platform.md) §8: `<input type=color>` has an OS picker, no alpha outside Safari 18.4, no
swatches or area — **avoid as the visible control**; a hidden native input carries the form value.

- **Channel sliders and the area are native `input[type=range]`** (TalkBack, VoiceOver, NVDA all adjust them; RA does
  this; zag/Reka/Kobalte-wheel `div role=slider` were the weaker route). The 2D area is two of them.
- **Names.** Every slider needs a name ("Hue", "Alpha", "Saturation"). `aria-valuetext` = "{channel} {value}, {colour
  name}" so the user hears *what colour* it is, not 240° (RA#4111, RA#4110). The first announcement on the area
  includes the other channels (what colour am I in?), later ones only the channel that changed (RA#4110).
- **iOS VoiceOver** adjusts a range input by 1 per swipe, and tap-and-hold announces nothing (RA#4101, open). `step`
  vs `pageStep` cannot be reached from VO; we keep `step: 1` (hue, 0–100 channels, 0–255) and 0.01 for alpha and
  document that large steps need the typed inputs (the 2.5.7 alternative). The Number Input channel fields are the
  AT-friendly path.
- **Typing alternative.** Hex field and channel inputs are always available inside the picker content (a consumer may
  omit them, then the keyboard and the native sliders are the alternative).
- **Colour is not the only cue.** A swatch has a text name (colour name), a selected swatch has a mark besides the
  ring, the value text is plain text.
- **Forced colours** (RA#2949): every gradient, swatch and thumb sets `forced-color-adjust: none` (it *is* the
  colour); thumbs get a `CanvasText`/`Canvas` double outline so they stay visible on any gradient; focus ring is an
  outline; the selected swatch gets a check glyph in `currentColor`. `Highlight` is not usable on a swatch.
- **Target size.** Thumb hit area ≥ 24×24 (Slider's `--rind-hit-area`); swatches ≥ 24×24; the area thumb the same.
- **Dialog.** Content is a non-modal dialog by default (Popover); focus enters on the area/first control and returns
  to the trigger; Escape closes; outside press closes; a drag that ends outside the popover must not dismiss it
  (RA#3994: pointer capture keeps `pointerup` from counting as an outside press).
- **RTL.** The x axis and horizontal sliders mirror (`dir="rtl"`: hue 0 at the right); gradients flip with the axis
  (zag#2666); Home/End are value keys (min/max) like Slider.
- **Reduced motion.** No animated thumbs; the theme only transitions the swatch ring.
- **Eye dropper.** `EyeDropper` is Chromium-only; elsewhere the control must not be a dead button (ark#2764).

## Bug history

Search: `gh search issues --repo <repo> "<term>"` for `color picker`, `color area`, `ColorArea`, `ColorSlider`,
`ColorWheel`, `ColorField`, `ColorPicker`, `ColorSwatch`, `ColorSwatchPicker`, `color`, `hsb`, `alpha`, `swatch`, `eye
dropper`, `channel input` over chakra-ui/zag, chakra-ui/ark, adobe/react-spectrum, kobaltedev/kobalte, unovue/reka-ui,
huntabyte/bits-ui; the other tracked repos (radix, base-ui, headlessui, ariakit) have no colour component. Every row
below was read.

| Library | Issue | Symptom | Root cause | Fix / status | Lesson for rind-ui |
|---|---|---|---|---|---|
| Zag | [#3043](https://github.com/chakra-ui/zag/issues/3043), [#3067](https://github.com/chakra-ui/zag/pull/3067), Ark [#3414](https://github.com/chakra-ui/ark/issues/3414) | Picker in a Dialog closes on the first outside click, never again; or closes on a click on white space inside | `INTERACT_OUTSIDE` target `idle` resolved to `open.idle` (no transition); content not focusable so the click counted as outside | closed; absolute target, `tabIndex=-1` on content | Open/close through Popover's layer stack, one close per gesture; test open→dismiss→open→dismiss inside a Dialog and a click on empty content |
| Zag | [#3010](https://github.com/chakra-ui/zag/issues/3010) | Vertical channel slider resolves the horizontal percent on press/drag | orientation fell back to horizontal when the active orientation was not recorded at press time | closed | One axis function in the pointer-drag module (Slider reuse); vertical Color Slider test |
| Zag | [#2894](https://github.com/chakra-ui/zag/issues/2894) | Controlled picker does not update when dragging towards black; needed `format` | controlled value without a `format` prop kept the value's own format; fixed by the maintainer, workaround `format` | closed (docs, then fix) | Value space and display format are independent; every channel resolves through conversion |
| Zag | [#2782](https://github.com/chakra-ui/zag/issues/2782) | Eye dropper result has alpha 0 | reporter's repro, maintainer could not reproduce; closed | closed | Eye-dropper colour is opaque by contract; test it |
| Zag | [#2666](https://github.com/chakra-ui/zag/issues/2666) | RTL: area and alpha slider pick reversed values | range/percent helpers assume LTR | closed | `dir` handled once (pointer-drag fractions, gradient direction, thumb offset); RTL runs in model tests |
| Zag | [#2503](https://github.com/chakra-ui/zag/issues/2503) | Controlled: hue thumb jumps to the left edge at the right edge | 360 and 0 are the same colour; the echoed value re-derives hue 0 | closed (docs: "preserve the Color object") | **Echo rule**: a controlled value that is the same sRGB colour as the current one is ignored; hue 360 is representable |
| Zag | [#2473](https://github.com/chakra-ui/zag/issues/2473) | Typing in a channel input never fires `onValueChangeEnd`; text only applies on Enter/blur | by design (commit points); end event missing | closed (event added) | Inputs commit on Enter/blur and report one commit; typing never changes the value |
| Zag | [#2389](https://github.com/chakra-ui/zag/issues/2389), Ark [#1649](https://github.com/chakra-ui/ark/issues/1649), RA [#4561](https://github.com/adobe/react-spectrum/issues/4561) | "Unknown color channel: hue" throws on keyboard use when the value is RGB | channels exist only in the value's space | closed (demo bug / docs: use hsl) | `channel` must work for any space through conversion; never throw from a key handler |
| Zag | [#884](https://github.com/chakra-ui/zag/issues/884) | Alpha input resets to 1 when the hex input blurs | hex parse replaced alpha | closed | Typing an opaque hex keeps the current alpha; only 8-digit hex sets it |
| Zag | [#1567](https://github.com/chakra-ui/zag/issues/1567) | Hue/saturation/brightness inputs do not clamp on blur | machine only knew the active format's channels | closed (docs: show inputs of the current format) | Clamp every channel input from the model's range, in any format |
| Zag / Reka | [#2438](https://github.com/chakra-ui/zag/issues/2438), [reka-ui#2798](https://github.com/unovue/reka-ui/issues/2798) | OKLCH requested as a colour space | — | closed / open | Model space list is open; OKLCH is deferred (out-of-gamut axes need a gamut policy), names use it privately |
| Ark | [#2764](https://github.com/chakra-ui/ark/issues/2764) | "Pick a colour" button does nothing in Firefox | `EyeDropper` unsupported, no feedback | closed (won't fix) | Feature-detect; the part is hidden when unsupported; no dead control |
| Ark | [#2932](https://github.com/chakra-ui/ark/issues/2932) | `ctx.value.toFormat is not a function` after v4 | a string was passed where a `Color` object is required | closed (changelog: use `parseColor`) | Accept `string \| Color`; the model is plain data |
| Ark | [#2713](https://github.com/chakra-ui/ark/issues/2713), [#1348](https://github.com/chakra-ui/ark/issues/1348) | Vue v-model: external changes not reflected after a thumb edit / at all | Vue reactivity gaps (maintainers fixed per release) | closed | Controlled value is applied from every source, then pointer, then external again (model test) |
| Ark | [#1922](https://github.com/chakra-ui/ark/issues/1922) | `asChild` on ChannelInput throws | part assumed its own element | closed | Every part takes `render` (convention); tested for each part |
| React Aria | [#9509](https://github.com/adobe/react-spectrum/issues/9509) | Hue locked when the controlled colour is black or white | consumer round-tripped through hex, losing hue | closed (consumer conversion) | Same class as zag#2503; the Echo rule keeps hue/saturation across sRGB round trips |
| React Aria | [#7553](https://github.com/adobe/react-spectrum/issues/7553) | Thumb jitters on a large area with HSB | pointer values snapped to step 1 (100 steps over 360 px) | closed stale (maintainer: sub-step values hurt keyboard users) | Pointer resolution is finer than the keyboard/AT `step` |
| React Aria | [#6299](https://github.com/adobe/react-spectrum/issues/6299) | Area/slider in a scrolling dialog do not scroll the thumb into view | no autoscroll on move | open | Non-goal; no `scrollIntoView` while dragging |
| React Aria | [#4101](https://github.com/adobe/react-spectrum/issues/4101) | VoiceOver iOS: +1 per swipe, tap-and-hold silent | range input behaviour | open (iOS) | Document; typed inputs are the path; measured in the manual protocol |
| React Aria | [#4110](https://github.com/adobe/react-spectrum/issues/4110), [#4111](https://github.com/adobe/react-spectrum/issues/4111) | Area labelling confusing on iOS VO; wheel announces degrees only | value text repeated all channels / no colour name | closed (colour names, value text only changed channel) | `aria-valuetext` with colour name; first focus lists all channels, later only the changed one |
| React Aria | [#2252](https://github.com/adobe/react-spectrum/issues/2252) | Escape does not close the Dialog when the ColorWheel thumb is focused | not established (a later version no longer reproduced it) | closed | Escape on a thumb bubbles unless a drag is active (Slider's rule) |
| React Aria | [#2814](https://github.com/adobe/react-spectrum/issues/2814) | Double-tap on a thumb leaves it in the pressed/open state (iPad, Android) | suspected: drag state waits for a move (reporter's guess) | closed | `dragging` ends on `pointerup`/`pointercancel` with no move required |
| React Aria | [#2247](https://github.com/adobe/react-spectrum/issues/2247), [#2250](https://github.com/adobe/react-spectrum/issues/2250), Kobalte [#592](https://github.com/kobaltedev/kobalte/issues/592) | `onChangeEnd` twice per click (StrictMode / controlled string); area `onChange` twice (x then y) | two writes, two callbacks | closed | One write for both axes; one `onValueChange`, one `onValueCommit` per interaction |
| React Aria | [#10445](https://github.com/adobe/react-spectrum/issues/10445) | Typed hex not committed on Enter, discarded on Escape dismissal | commit wired to blur only | closed (Enter commits) | Enter commits; Escape reverts a dirty draft first |
| React Aria | [#9748](https://github.com/adobe/react-spectrum/issues/9748) | Picker popover dismissed by outside click loses the typed hex | React does not blur on unmount; commit only on blur | closed | The picker flushes a valid pending draft before closing |
| React Aria | [#7547](https://github.com/adobe/react-spectrum/issues/7547) | Pasting a lower-case hex "does nothing" | reporter's source dropped the `#` | closed (not a bug) | Accept hex with or without `#` and any case (verified: the report said the opposite of its title) |
| React Aria | [#6363](https://github.com/adobe/react-spectrum/issues/6363) | Emptying the field makes the swatch transparent | default `#0000` parsed as alpha 0 | closed (default made opaque) | An empty draft reverts; `#0000` is transparent black, never a default |
| React Aria | [#5484](https://github.com/adobe/react-spectrum/issues/5484) | Controlled field jumps `#334` → `#333344` while typing | controlled value re-fed into the input text | closed | Draft text is owned by the field until a commit point |
| React Aria | [#3985](https://github.com/adobe/react-spectrum/issues/3985) | Android: more than six characters accepted | `keydown`-based filter, IME composes | closed | Filter the resulting text (`beforeinput`/`input`), never keys |
| React Aria | [#3994](https://github.com/adobe/react-spectrum/issues/3994) | Popover closes when a slider drag ends outside it | outside-interaction detection treated the drag leaving the popover as an outside press (fix: react-spectrum PR 3935, not read) | closed | Layer dismissal ignores the release of a drag that began inside (pointer capture + overlay rule) |
| React Aria | [#6202](https://github.com/adobe/react-spectrum/issues/6202) | `parseColor('hsb(360,…)')` becomes hue 0 | `mod(h, 360)` | closed (360 allowed per CSS) | Hue range is 0–360 inclusive, 360 preserved |
| React Aria | [#7918](https://github.com/adobe/react-spectrum/issues/7918), [#10251](https://github.com/adobe/react-spectrum/issues/10251) | Swatch picker always selects `#000` when nothing matches; identical colours collide on one key | selection state defaulted to a colour; swatch identity = colour string | open / closed (use ListBox) | Selection is `null` when no swatch matches; swatches may carry an id |
| React Aria | [#2921](https://github.com/adobe/react-spectrum/issues/2921) | Home/End do not mirror in RTL on the area | key mapping ignored direction | closed (mirrored) | Decision: Home/End are value keys (min/max), consistent with Slider; arrows mirror |
| React Aria | [#1554](https://github.com/adobe/react-spectrum/issues/1554) | Android: tapping the track works once | tap left `isDragging` true | closed | Pointer-drag ends on release for every pointer type (Slider's module) |
| React Aria | [#2949](https://github.com/adobe/react-spectrum/issues/2949) | High Contrast list incl. colour components | system colours not applied | open | `forced-color-adjust: none` on colour surfaces + outline thumbs; Playwright forced-colors capture |
| React Aria | [#8192](https://github.com/adobe/react-spectrum/issues/8192) | Wants a colour-temperature "colour slider" with custom range | not a channel of a colour space | closed (use Slider) | A Color Slider is a channel of a Color; anything else is a Slider with a gradient track |
| Kobalte | [#589](https://github.com/kobaltedev/kobalte/issues/589) | Alpha channel field rounds to 0 or 100 % | alpha range 0–1 with integer rounding | closed | Percent formatting on a 0–1 value (Number Input `style: percent`); precision per channel |
| Reka | [#2545](https://github.com/unovue/reka-ui/issues/2545) | Custom attributes not forwarded on `ColorFieldRoot` | root not a pass-through | closed | Every part forwards its element's attributes |

## Known pitfalls

- **Degenerate round trips.** HSB/HSL → RGB → HSB loses hue at zero saturation or brightness/lightness and saturation
  at black/white; `parseColor(hex)` per render (Reado) is the trigger. Fix by keeping the editing-space colour and
  ignoring echoes of the same sRGB colour.
- **Hue 360 ≡ 0.** Slider thumbs at the right edge flip to the left if the value is normalised.
- **Two writes per gesture** (x then y) double-fire callbacks.
- **Pointer vs step resolution** for large areas; **float drift** from repeated deltas (use absolute fractions, not
  accumulated deltas).
- **Unmount does not blur** in React: pending text must be flushed explicitly.
- **iOS** scrolls the page under a touch drag unless `touch-action: none`; the Slider notes (modal scroll lock) apply.
- **EyeDropper**: Chromium only, needs a user gesture, rejects on Escape (an `AbortError`, not a failure).
- **SSR**: gradients and positions are computed from the value only (no measuring), like Slider.
- **Safari 18.4** `<input type=color alpha>` exists but is not usable as the control (no area, no names).

## Testing notes

- jsdom has no layout: pointer steps need a browser; keyboard, native `fill`, typing and the whole model run in jsdom.
  The area's pointer fraction mapping is pure (pointer-drag) and unit-tested.
- The oracle for model-based tests is the **colour model itself** (pure functions): expected channel after a key step,
  expected sRGB after an edit in each space, expected colour name. The model gets its own property tests (round trip of
  all 16.7 M opaque 8-bit colours in a sampled grid plus every grey/primary, parse/format round trip, hue invariants).
- Drivers expose: `values()` (channels), `color()` (formatted), `valueText()`, `colorName()`, `format()`, `isOpen()`,
  `setChannel(channel, value)`, `type(text)`, `pickSwatch(i)`, `eyeDropper(result)` (the test environment injects a
  fake `EyeDropper`), pointer actions as Slider's.
- Contrast and gradients: Playwright captures in forced colours, RTL, vertical, and axe in three engines on examples.

## Decisions

- **Split.** One change `add-color-picker`, seven capabilities: `color-model` (shared, framework-neutral), `color-area`,
  `color-slider`, `color-swatch`, `color-field` (Color Field + Color Channel Field), `color-swatch-picker`,
  `color-picker`. The picker composes the others; each is usable alone (Color Area, Slider, Swatch, Field are listed
  separately in `components.md`). A Color Wheel is not in this change (polar mapping; additive, see Non-goals).
- **Colour model.** Plain immutable data `{ space: "rgb" | "hsl" | "hsb", channels, alpha }`, pure functions
  (`parseColor`, `formatColor`, `toSpace`, `withChannel`, `channelRange`, `isSameColor`, `colorName`,
  gradients), accepted as `string | Color` everywhere. Hue 0–360 inclusive; alpha 0–1.
- **Space vs format.** The value may be in any space; `format` (`hex | rgb | hsl | hsb`) is how the picker shows and
  emits it; the area's `colorSpace` is separate. Channels not present in a space resolve by conversion.
- **Echo rule + channel memory.** A controlled colour that is the same sRGB colour (8-bit channels, alpha to 1/255) as
  the current one, in a different space, is ignored; same space with different channels is adopted. Machines keep the
  last non-degenerate hue/saturation for conversions from achromatic colours.
- **Native range inputs** for the channel slider (Slider reused, not re-specified) and for both area axes; the thumb
  inputs follow `add-slider`'s accessible-native-input rule.
- **Pointer** through `pointer-drag` (2D mode requested); fractions in, one write per move for both axes.
- **Colour names** (React Aria's OKLCH heuristic) in `aria-valuetext` and swatch names, English defaults in `messages`,
  overridable and replaceable by a `colorName` function.
- **Swatch picker = Radio Group** (arrows move and check, one tab stop, null when nothing matches, optional id).
- **Picker.** Popover reused through a coordinator that owns the value and drives bound children (Date Picker's
  pattern); `inline` mode (Reado) renders Content with no layer. Typed text commits on Enter/blur/before close; Escape
  reverts a dirty draft before closing.
- **Deliberately different**: no `format`-as-space conflation (zag#2894, ark#1649); no class instances; no hard-coded
  English; no hidden-then-shown tab stops on the area (single tab stop, focus follows the axis); eye dropper hidden
  when unsupported; no oklch/named colours/wheel in v1.

## Open questions

- OKLCH as a fourth space: when a consumer needs it (Theme builder? white-label tooling), and which gamut policy.
- Whether Color Wheel should reuse `pointer-drag` polar mode or ship its own.
- Device check: iOS VoiceOver on the two-input area (does the second input read acceptably when reached by swipe?).
