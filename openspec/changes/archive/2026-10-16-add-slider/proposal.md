## Why

Slider is a wave-2 input shipped by seven of the nine libraries, and its bug history is
long and repetitive: commit callbacks that fire twice, late or never; float drift from
steps; thumbs that jump, swap or get stuck; touch drags lost to page scrolling; TalkBack
unable to adjust a `div[role=slider]`; VoiceOver reading the previous value. The
cross-cutting notes already decided the foundation (a visually hidden native
`<input type="range">` per thumb); this change specifies the rest once, with a
layout-free machine that model tests can walk.

Research: [slider](../../../docs/research/slider.md) ·
[accessibility](../../../docs/research/accessibility.md) §5, §6, §9 ·
[assistive-tech-and-a11y-testing](../../../docs/research/assistive-tech-and-a11y-testing.md)
causes G, J, K and §1.4 Slider ·
[native-platform](../../../docs/research/native-platform.md) §8, §14

Depends on: `add-foundations` (archived), `add-a11y-foundations` (keys with `value`
context, modality, `focusSafely`, visually hidden input style, i18n messages and
`format.number`, quirks, iOS text selection), `add-checkbox` (`hidden-form-input`,
`control-label`'s Description), and `add-theme-system`. This change ships the extended `valued`
invariant (`model-based-testing`, moved here from `add-progress`). Requests to `add-checkbox`,
`add-theme-system` and `add-overlay-infrastructure` are listed in design.md.

## What Changes

- A public **Slider** in `@rind-ui/core` (machine, connect, contract, messages) and
  `@rind-ui/react` (parts `Root`, `Label`, `ValueText`, `Control`, `Track`, `Indicator`,
  `Thumb`, `MarkerGroup`, `Marker`, `Description`; each Thumb renders its native range
  input).
- Single and multi-thumb values (`number | number[]`, shape preserved), `min`, `max`,
  `step`, `largeStep`, `minStepsBetweenThumbs`, `thumbCollision`, `thumbAlignment`,
  `orientation`, `disabled` (root and per thumb), `readOnly`, `name`, `form`,
  `formatOptions`, `locale`, `messages`, `onValueChange`, `onValueCommit`.
- APG keyboard (arrows, Shift+arrows, PageUp/PageDown, Home/End) with RTL and vertical
  handled by the shared key mapping; track press; drag with pointer capture; Escape
  cancels a drag.
- A shared **pointer-drag** module (`core/dom`): one drag lifecycle with capture,
  document listeners only while active, cancel handling and pointer-to-fraction
  mapping; reused later by Splitter, Color Area and Angle Slider.
- Test adapters gain pointer steps at a position inside a part, a part's box, and
  setting a native input's value as assistive technology does.
- `getSlider` driver, model-based tests, slider invariants, `slider.css`, stories, docs.

## Capabilities

### New Capabilities

- `slider`: the Slider component — anatomy, values, keyboard, pointer, AT adjustment,
  commit semantics, ARIA, form participation, data attributes, contract, invariants,
  theme.
- `pointer-drag`: the shared drag lifecycle and pointer-to-fraction mapping for
  components that drag along an axis.

### Modified Capabilities

- `test-drivers`: ADDED pointer steps at a position, part geometry and native value
  input in both adapters.
- `model-based-testing`: ADDED the `valued` trait extension (value lists, `null`,
  contract-declared expectations), moved from `add-progress`.

## Non-goals

- `inverted` sliders (Radix/Reka): their key mirroring contradicts "ArrowUp always
  increases" in `keyboard-interactions`.
- Snap-point arrays for `step` (Bits UI), non-linear scales.
- Angle Slider, Color Slider, Color Area (later components reusing `pointer-drag`).
- Field / Fieldset integration and an error message part.
- `required` (a range input always has a value).
- Framework adapters other than React; fx.

## Impact

- New: `packages/core/src/components/slider/`, `packages/core/src/dom/pointer-drag.ts`,
  `packages/react/src/slider/`, `getSlider` and adapter additions in
  `@rind-ui/testing`, `packages/theme/src/slider.css`, stories, docs page.
- Reado: `settings/SystemTab.tsx` (native range) migrates to Slider.
- No new dependency.
