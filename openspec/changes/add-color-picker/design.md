## Context

See proposal.md for why. The comparison and the bug history are in
[color-picker.md](../../../docs/research/color-picker.md); its Decisions section is binding unless this document
says otherwise. This change builds on, and does not re-specify:

| From | Used for |
|---|---|
| `add-foundations` (archived) | `setup()/machine()`, `controllable()` with `equal`, `bindProp()`, `$sync`, `$reverted`, `ChangeDetails.cancel()`, effects, contracts with `{ skip }` and prop steps, drivers, `testMachine`, React adapter |
| `add-a11y-foundations` (archived) | press events, modality, `focusSafely`, `keyboard-interactions` (logical keys, `value: true` mirroring), `announcer`, `i18n-messages` (typed messages, `format.number`, locale), `element-ids`, `a11y-quirks`, visually-hidden input style |
| `add-slider` | the Slider machine and parts (Color Slider **is** a Slider), `core/dom/pointer-drag.ts`, `core/shared/step-math.ts`, the accessible-native-input rule of `hidden-form-input` (one component, several inputs), `Part.pointer/box/fill` in the test adapters |
| `add-popover` | the Popover machine as a controlled child (`open`, reasons, `non-modal-tab-order`, `initialFocus`, `persistentElements`, `scope`, positioning, presence, `modal`) |
| `add-number-input` | channel inputs (typing, commit, steps, `number-parsing` incl. `unit` and `percent` styles) |
| `radio-group` (archived `add-radio-group`) | the swatch picker (one tab stop, arrows move and check, forms) |
| `add-checkbox` | `hidden-form-input`, `control-label` |
| `add-field`, `add-text-field` (archived/queued) | `field-control`, `field-validation`, Root-as-Field helper |
| `add-overlay-infrastructure`, `add-floating-positioning` (archived) | layer stack, dismissal ("What Counts As An Outside Press": down and up outside), containment, restore, presence, positioning, used through Popover only |
| `add-theme-system` | tokens, variants, stylesheet convention |

## Goals / Non-Goals

**Goals:**
- A colour model that is plain data, testable in Node, and the **oracle** of every model-based test.
- Each of Area, Slider, Swatch, Field, Swatch Picker usable alone; the Picker only composes them.
- Reado's inline panel works with a fresh sRGB object each render and keeps hue continuous.

**Non-Goals:** Color Wheel, OKLCH space, named colours, autoscroll, loupe, hex stepping (proposal).

## Decisions

### 1. Split: one change, seven capabilities

`color-model` is shared by everything and every component spec cites its rules (Echo rule, hue memory, names); splitting it
into several changes would make the first one carry the model and the others wait on it. Area, Slider, Swatch, Field and
Swatch Picker are listed separately in `components.md` and stay independently usable (each has its own contract, driver and
stylesheet); the Picker is the only coordinator. One change keeps one oracle and one set of theme tokens (`--rind-color-*`
shared by area, slider, swatch). Alternative — `add-color-model`, `add-color-area`, … as eight changes — rejected: the
dependency chain is a straight line, the review surface is the same, and the model's API would be frozen before any
component proved it. **Color Wheel** is excluded (polar mapping; additive on `color-model` and `pointer-drag`).

### 2. Layout

```
packages/core/src/
├─ shared/color/
│  ├─ color.ts          Color type, spaces, channels, ColorParseError
│  ├─ parse.ts          parseColor, tryParseColor
│  ├─ format.ts         formatColor
│  ├─ convert.ts        toSpace, colorMemory (rgb ⇄ hsl ⇄ hsb)
│  ├─ channels.ts       channelRange, getChannel, withChannel (uses core/shared/step-math.ts)
│  ├─ equal.ts          isEqualColor, isSameColor
│  ├─ name.ts           describeColor (private OKLCH), colorName
│  ├─ gradient.ts       channelGradient, areaGradient
│  ├─ value.ts          colorValue(): the "Controlled Colour Value" rule as a helper over controllable()
│  └─ messages.ts       channel/format/colour-name strings
├─ dom/eye-dropper.ts   capability `eye-dropper` (feature detect, open, abort handling; env.window.EyeDropper)
├─ components/
│  ├─ color-area/       color-area.{machine,connect,contract,messages}.ts, color-area.axes.ts (pure)
│  ├─ color-slider/     color-slider.{machine,connect,contract}.ts   (coordinator over the Slider)
│  ├─ color-swatch/     color-swatch.{connect,contract}.ts
│  ├─ color-field/      color-field.{machine,connect,contract}.ts, color-channel-field.{connect,contract}.ts
│  ├─ color-swatch-picker/ color-swatch-picker.{connect,contract}.ts   (coordinator over the Radio Group)
│  └─ color-picker/     color-picker.{machine,connect,contract,messages}.ts, flush-registry.ts
packages/react/src/color-{area,slider,swatch,field,swatch-picker,picker}/
packages/testing/src/drivers/color-*.ts
packages/theme/src/color-{area,slider,swatch,field,swatch-picker,picker}.css, color-checker.css (shared tokens)
apps/site/examples/color-*.tsx
```

### 3. The model

```ts
type ColorSpace = "rgb" | "hsl" | "hsb"
interface Color { readonly space: ColorSpace; readonly channels: readonly [number, number, number]; readonly alpha: number }
type ColorChannel = "red"|"green"|"blue"|"hue"|"saturation"|"lightness"|"brightness"|"alpha"
interface ColorMemory { hue?: number; saturation?: number }
```

- **Plain data, functions not methods** (ark#2932, structured clone, SSR, tree shaking). `Object.freeze` in dev only.
- **Precision per channel** (`rgb` integers, others two decimals) is applied in `withChannel` and `toSpace`, so values never
  carry floating-point residue; steps use `step-math`'s decimal-safe snap (shared with Slider and Number Input).
- **Hue memory.** Conversion to a hue space from an achromatic colour uses `memory.hue`. Machines keep
  `context.memory` and update it with `colorMemory(color, memory)` on every colour they see; conversions pass it. A hue-space colour
  already holds its hue, so memory only matters across a space change. Rejected: Reka's separate hue ref (memory in the
  model's API instead of in each component), Zag's "preserve the object" documentation workaround (breaks for fresh objects).
- **Echo rule** and "no callback for an unchanged emitted colour" live in `value.ts` (`colorValue`), a small helper over
  `controllable()`: `equal` is `isEqualColor` in the emission space; the controlled adapter `normalize` runs
  `string | Color → Color` and drops an incoming value that is `isSameColor` as the internal colour when the spaces differ. Because the internal
  colour is a context value, the machine's `$sync:value` proposal path is untouched.
- **Names.** `describeColor` ports React Aria's heuristic (OKLCH conversion via the CSS Color 4 matrices, thresholds as
  specified); `colorName` joins the strings from `messages`. Translations are the consumer's (RA#4111 stalled on distributing a string table;
  we ship English only and typed hooks).
- **Gradients.** `areaGradient` stacks two `linear-gradient`s per `(space, x, y)` triple; table-driven, covered by a corner and mid-point property test against `toSpace`.
- **Hue 360** is in range; `withChannel` clamps, never wraps; `parseColor` wraps hue except exactly 360.

### 4. Color Area

Machine (`idle` / `dragging`):

```
events: POINTER.DOWN { x, y, onThumb, modality } | POINTER.MOVE { x, y } | POINTER.UP | POINTER.CANCEL
        | LogicalKey & { axis }   (INCREASE DECREASE PAGE_PREV PAGE_NEXT FIRST LAST DISMISS)
        | INPUT.CHANGE { axis, value } | RESET | FOCUS { axis, modality } | BLUR | INPUT.SYNCED
idle      ── POINTER.DOWN [canInteract] / setFromPointer(both), recordStart, focusX ──► dragging
          ── keys [canChange] / stepAxis, focusAxisIfChanged, commit
          ── INPUT.CHANGE [canChange] / setFromInput, commit   (else resyncInputs)
dragging  ── POINTER.MOVE / setFromPointer(both, one write)
          ── POINTER.UP / commitIfChanged ──► idle
          ── POINTER.CANCEL | DISMISS / restoreStart (preventDefault on DISMISS) ──► idle
effects:  dragging: ["trackDrag"] (pointer-drag, mode "both")   service: ["formInputs"]
```

- **Two native inputs, one tab stop.** x then y in the Thumb; the last-focused input has no `tabindex`, the other `-1` (roving between two;
  Shift+Tab from y leaves the Area). Both are exposed to assistive technology: React Aria's `aria-hidden` on the unfocused input and
  Zag's single `div role=slider` with a one-number `aria-valuenow` were weighed; the former hides a real control when the user swipes with VoiceOver, the latter gives a custom `div role=slider` that native adjustment (TalkBack, VoiceOver swipe) cannot step by axis. Focus moves to the input of the axis a vertical key changed (React Aria's rule) so the changed value is read;
  that is the only blur/focus in the component and it is conditional on a cross-axis step.
- **One write for two axes** (kobalte#592): `setFromPointer` computes both channels from the 2D fraction, snaps each to its pointer resolution and writes one colour.
- **Pointer resolution vs step** (react-spectrum#7553): pointer values snap to `resolution` (0.1 for 0–100 and hue, 1 for rgb); keyboard and AT use `step`. The input's native
  `step` attribute is the model step; a pointer value that is not on the step grid is allowed in the colour but the input rounds for display (`aria-valuenow`
  is the exact value; the native `value` property is rounded to the step, which Slider's `step-math` tolerates because the machine owns the value).
- **Value text** keeps "first announcement lists the colour, later ones only the change" with a context flag `changedSinceFocus` reset on focus-in.
- **`forced-color-adjust: none`**, `touch-action: none`, `user-select: none` come from connect (inline style), colours and rings from the theme.

### 5. Color Slider = Slider + binding

`colorSliderMachine` is a coordinator: it owns the colour (`colorValue`), computes the Slider's props (`min`, `max`, `step`, `largeStep`, `value`, `formatOptions`, `messages.valueText`
closure with the colour name) and receives the Slider's `onValueChange`/`onValueCommit` as events (`SLIDER.CHANGE`, `SLIDER.COMMIT`), exactly as the Menubar drives its menus and the Date Picker drives its Calendar. Connect = the
Slider's connect output merged with `trackStyle` (`channelGradient`), `thumbStyle` (`--rind-color`), `data-channel`, `data-space`. No Slider rule is copied; the contract extends `getSlider`. Rejected: a
copy of Slider's machine (Ark/Zag's channel slider is a separate `div role=slider` implementation, the source of zag#3010 and zag#2666), and a Slider prop `renderTrack` (no such need elsewhere).

### 6. Color Field and Channel Field

- **Color Field** machine: states `idle`, `editing` (dirty draft), `invalid`; context `draft`, `text`, `value` (controllable `Color | null`), `memory`. Events: `INPUT` (text), `COMMIT`, `ESCAPE`, `FLUSH`, `BLUR`, `RESET`, `ADOPT`, `$sync:value`. Text acceptance is a pure function (`acceptHexText(text, alpha)`), checked in
  `beforeinput` and `input`. The hidden input uses `hidden-form-input` (value `#RRGGBB(AA)`).
- **Color Channel Field** is a Number Input (`add-number-input`) with props computed from the channel (`min`, `max`, `step`, `formatOptions`, `commitBehavior: "snap"`) and a `commit → withChannel` adapter; no new machine. It
  needs the embedded boundary (below).
- Alpha on a hex commit is kept by `commitHex(draft, current, alphaEnabled)` (pure).

### 7. Color Swatch Picker = Radio Group + matching

A coordinator maps the colour to the Radio Group's `value` key (`matchSwatch(items, color, lastKey)`, pure) and maps `onValueChange(key)` back to the item's colour. React Aria's ListBox grid keys items by colour (RA#7918, #10251); a Radio Group fits (APG,
one choice, arrows move and check, native form values) and costs no new machinery. Up/Down by row is not provided (documented); a later `grid` mode of Radio Group would add it.

### 8. Color Picker coordinator

```
states: closed | open | inline                       (inline: single state, no effects)
events: TRIGGER.PRESS { modality } | OPEN | CLOSE { reason } | FLUSHED
        | COLOR.SET { color, reason, channel? } | COLOR.COMMIT { reason }
        | FORMAT.SET { format } | EYEDROPPER.PRESS | EYEDROPPER.RESULT { hex } | RESET | ADOPT { text }
        // props: $sync:value | $sync:open | $sync:format | $props:disabled | readOnly
closed ── TRIGGER.PRESS | OPEN [!disabled, !readOnly] ──► open / recordModality
open   ── TRIGGER.PRESS ──► closed / flushDrafts
       ── CLOSE ──► closed / flushDrafts, reason          (reason "select" from SWATCH with closeOnSelect)
global ── COLOR.SET / setColor (one commit path) · COLOR.COMMIT / commit · FORMAT.SET / setFormat
       ── EYEDROPPER.PRESS / eyeDropper effect ── RESULT ──► COLOR.SET opaque
values: value (colorValue), format (controllable), open (controllable)
effects: popover (child service wiring), eyeDropper, flushRegistry
```

- **Children are bound**: Area, ChannelSlider, ChannelInput, SwatchGroup get the picker's colour as a controlled value and send `COLOR.SET`/`COLOR.COMMIT` back; the picker passes the **same internal colour** (with its hue) to each, so
  the Echo rule only ever applies to the consumer's `value`.
- **Flush**: a registry (React context in the adapter, `FlushRegistry` in core) lets each Color Field register `flush()`; `CLOSE` and `TRIGGER.PRESS` (when open) call all of them *before* leaving `open`; commits made by them arrive as
  `COLOR.SET` events processed in the same task (the machine runtime queues, so ordering is: commits, then the transition).
- **Popover as a child**, with `scope: "color-picker"`; the picker owns `open` (controlled Popover), as the Date Picker's coordinator does. `closeOnSelect` produces `CLOSE { reason: "select" }`.
- **Inline**: `initial: "inline"` when the prop is true; `open`/Trigger inert; `Content` gets `role="group"`; no `overlay` effect, no `trackPosition`, no document listeners (`trackDrag` of the
  Area and Sliders are the only document listeners, and only while dragging).
- **Why not `picker-popover`** (Date Picker's shell): it coordinates an embedded segmented field, a calendar's focused date and "select closes"; here the content is a bag of independent controls and the trigger shows a swatch. The
  reason vocabulary and the "child Popover with `scope`" pattern are reused, nothing else.
- **Eye dropper**: `core/dom/eye-dropper.ts` exposes `isSupported(env)` and `pick(env, signal)` over `env.window.EyeDropper`; the machine `EYEDROPPER.PRESS` effect resolves to `RESULT` or to nothing on `AbortError`. A fake `EyeDropper`
  is installed on the test window by the driver. Support is a context bit set `after mount` (an `EyeDropperTrigger` mount event), so SSR and the first client render agree.
- **Format**: `format` controllable; `View` is a connect-level conditional (`isFormat(format)` in the adapter's render), `FormatSelect` a native select whose `value` is set as a property.

### 9. Contract, drivers and tests

Contracts per component (specs); every model-based test uses `color-model` functions as the oracle: expected channels after a key step are `incrementChannel`-style model calls, expected sRGB after an edit is `toSpace`, expected names are `colorName`. Model configurations:

- Area: hsb default (sat × bri), hsl (sat × light), rgb (red × green), hue × saturation, `dir="rtl"`, read-only, controlled that echoes a fresh sRGB object, controlled that refuses, with `xName`/`yName` in a form.
- Slider: `hue` on an `hsb` value, on an `rgb` value, `alpha`, vertical, RTL, controlled echo.
- Field: hex with and without `alpha`, `css`, controlled refuse, in a Popover (Escape layering), required in a form with reset.
- Swatch Picker: matching value, no match, duplicate colours with keys, disabled swatch, RTL.
- Picker: inline controlled with a fresh parse per render (Reado), popover non-modal, `modal`, inside a Dialog, `format` cycling, swatches with `closeOnSelect`, Field + form + reset, with and without a fake `EyeDropper`.

jsdom runs keyboard, native `fill`, typing and the model; pointer steps need layout and run in the browser project and Playwright. `FOCUS`, `BLUR`, `INPUT.SYNCED`, `FLUSHED` are `skip` events (not user events).

### 10. Theme

Tier-3 tokens `--rind-color-<component>-*`; shared `--rind-color-checker-*` (size, two tones) used by Swatch, Slider track and Area under alpha; thumb rings as `Canvas`/`CanvasText`; families: Area and Slider `range`, Field/Channel
Field and Control/Trigger `field`, Picker content `panel`, Swatch `decoration`, Swatch Picker group inherits `data-size`. Requests below add the rows to the family matrix.

## Requests to other changes

- **add-slider** (`pointer-drag`): add a **2D mode**: `axis: "both"` reports `{ type: "move", x, y }` fractions (x from the inline start, mirrored under `dir="rtl"`; y from the bottom; padding and border excluded, optional half-thumb
  `inset` at each edge, a grab offset on both axes). The Color Area is its first user (later Splitter-2D, Signature crop). Everything else in the module is unchanged.
- **add-slider** (`slider`, anatomy and pointer): make `Control` optional. Without a `Control` part the `Root` is the pointer surface (the geometry and `touch-action` go on it), and presses that start on `Label` or `ValueText` do not start a drag. This
  is the shape of Ark's `ChannelSlider` and Reado's usage (`ChannelSlider` > `Track` + `Thumb`), and avoids an extra element in Color Slider.
- **field-control** (archived with `add-field`; needs a follow-up change or a delta in the next field change): add a requirement **Embedded Controls**: a component that renders other form controls inside its own content MAY mark that subtree as an
  *embedded boundary* (React: `FieldControlBoundary`); controls rendered under a boundary SHALL NOT register with the enclosing Field, SHALL NOT create their own Field (Root-as-Field), SHALL NOT receive the Field's ARIA wiring and SHALL NOT warn about a second
  control. `add-number-input`, `add-slider`, `radio-group` and Color Field/Picker honour it. (Date Field already has a private `embedded` flag; this generalises it and the Date Field flag becomes a use of the boundary.)
- **add-number-input**: Number Input SHALL honour the embedded boundary (no registration, no Field Label/Description rendering, hidden input only when `name` is set); `formatOptions` with `style: "unit"` (`degree`, `percent`) SHALL be supported by `number-parsing` (the
  Color Channel Field relies on both parsing "120°" and "50%").
- **theme-variants** (archived with `add-theme-system`; needs a delta in the next theme change): Family Matrix rows — `range`: add Color Area and Color Slider; `field`: add Color Field, Color Channel Field and the Color Picker control and trigger; `panel`: add the Color Picker
  popover content; `decoration`: add Color Swatch; Color Swatch Picker's group inherits `data-size` (no family).
- **docs/components.md**: set Color Area, Color Slider, Color Swatch, Color Field, Color Swatch Picker and Color Picker to `spec` (done here), Color Wheel stays `todo`.

## Risks / Trade-offs

- [Two inputs per area read as two sliders to some screen readers] → `aria-roledescription` "2D slider" on both and the first-focus value text that lists all channels; iOS VoiceOver device check in the manual protocol; fallback is React
  Aria's `aria-hidden` on the idle input, contained in connect.
- [The Echo rule can hide a genuine external change that is the same sRGB colour in another space, e.g. a consumer setting `rgb(0,0,0)` to reset hue] → a consumer that wants a reset passes a colour in the working space (`hsb(0,0,0)`); documented, tested.
- [Pointer values off the step grid] → the model keeps two-decimal precision; `aria-valuenow` is exact; the native `value` rounds. Tested with a large area.
- [Gradient approximation for HSL lightness areas] → three-stop gradients; corner and mid-point tests within 4/255; documented.
- [Colour-name heuristic is English-centric in its thresholds] → the description is locale-free; only strings are localised; `colorName` replaces it entirely.
- [Eye dropper hidden until mount flashes in Chromium] → one frame; the alternative (feature detect on the server) cannot work.
- [Flush before close depends on the registry reaching every field] → the model test closes the picker by each path with a dirty hex input and a dirty channel input.

## Migration Plan

Reado `ColorPickerPopover.tsx` (read-only here; migrate in Reado's own change):

```tsx
<ColorPicker.Root inline format="rgb" value={parseColor(`rgba(...)`)} onValueChange={(c) => onChange(formatColor({ r: c.channels[0], g: c.channels[1], b: c.channels[2], a: c.alpha }, hit.format))}>
  <ColorPicker.Content> <ColorPicker.ValueText/> … <ColorPicker.Area><AreaBackground/><AreaThumb/></ColorPicker.Area>
    <ColorPicker.ChannelSlider channel="hue" aria-label…><ChannelSliderTrack/><ChannelSliderThumb/></ColorPicker.ChannelSlider> … alpha …
```

Mapping: `ColorPicker.Root open inline` → `inline`; `parseColor` from `@rind-ui/core` (a string is also accepted); `d.value.toFormat("rgba").getChannelValue("red")` → `d.channels[0]` (with `format="rgb"` the emitted colour is `rgb`);
`ChannelSliderTrack/Thumb` unchanged names; add `aria-label`s (or Labels) to the sliders (Ark left them unnamed). Reado keeps its own positioning, Escape and outside handlers; the picker installs none in inline mode.

## Open Questions

- Should the swatch group offer a grid keyboard mode (Up/Down by row) once Radio Group has one?
- OKLCH: which consumer comes first and which gamut policy (chroma reduction per CSS Color 4) — deferred with the Theme builder.
