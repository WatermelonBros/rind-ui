# Rating — research

Status: done · Wave: 3

A Rating ("Rating Group" in Ark, Bits and Zag) is a row of N icons, usually stars. The
user picks a value from 1 to N, or in half steps if enabled. A read-only variant shows a
score. Four of the nine libraries ship one (Ark/Zag, Reka, Bits, Kobalte). MUI Material
also has one. React Aria has none; its feature request is open. The main question is
which ARIA pattern to use. APG gives an example for both: a **radio group** (one radio
per star) and a **slider** (one focusable element with `aria-valuetext`). The libraries
are split. This note records how each one built it, the bug history, and the decisions
for `add-rating`.

Builds on [slider.md](slider.md) (native `<input type="range">` as the accessible
control, step math, the `keys` module, AT adjustment), [radio-group.md](radio-group.md)
(the pattern we weighed and did not choose), `hidden-form-input` ("Accessible Native
Input"), `control-label`/`field-control`, and the cross-cutting notes
[accessibility.md](accessibility.md), [assistive-tech-and-a11y-testing.md](assistive-tech-and-a11y-testing.md)
and [native-platform.md](native-platform.md).

Sources read (local shallow clones, 2026-10-19):

| Library | Files |
|---|---|
| Zag / Ark | `zag/packages/machines/rating-group/src/{rating-group.machine,rating-group.connect,rating-group.dom,rating-group.types}.ts`; `ark/packages/react/src/components/rating-group/{rating-group-item,rating-group-hidden-input,rating-group-control}.tsx` |
| Reka UI | `reka-ui/packages/core/src/Rating/{RatingRoot,RatingItem,RatingItemIndicator}.vue` (it exists, built on `RadioGroup`) |
| Bits UI | `bits-ui/packages/bits-ui/src/lib/bits/rating-group/{rating-group.svelte.ts,components/rating-group.svelte,components/rating-group-input.svelte}` |
| Kobalte | `kobalte/packages/core/src/rating/{rating-root,rating-item,rating-control,rating-hidden-input,utils}.tsx` (folder is `rating`, not `rating-group`) |
| MUI Material | `material-ui/packages/mui-material/src/Rating/Rating.js` |
| React Aria | no component. [RA#5911](https://github.com/adobe/react-spectrum/issues/5911) (open) and the RAC example `examples/rac-spectrum-tailwind/src/components/StarRatingGroup.tsx` (via `gh api`) |
| APG | [Rating Radio Group example](https://www.w3.org/WAI/ARIA/apg/patterns/radio/examples/radio-rating/), [Rating Slider example](https://www.w3.org/WAI/ARIA/apg/patterns/slider/examples/slider-rating/) |

Radix, Base UI, Headless UI and Ariakit ship no Rating. Base UI's request is
[BU#30](https://github.com/mui/base-ui/issues/30) (open; duplicate
[BU#4796](https://github.com/mui/base-ui/issues/4796)). It links the
[WAI tutorial star rating](https://www.w3.org/WAI/tutorials/forms/custom-controls/#a-star-rating),
which uses native radios, and eBay's mindpatterns.

## Pattern

- WAI-ARIA APG has no Rating pattern. It has two examples:
  - **Rating Radio Group**: `div[role=radiogroup]` labelled by `aria-labelledby`. Each
    star is a `g[role=radio]` named "one star" … "five stars", with roving `tabindex`
    and `aria-checked`. Keys follow the radio pattern: arrows **wrap**, Down/Right go to
    the next star, Up/Left to the previous one. Space checks. "The state where a radio
    is not checked only occurs on page load": it cannot be cleared.
  - **Rating Slider**: one `div[role=slider]` with `aria-valuenow/min/max`, and
    `aria-valuetext` that adds the meaning ("… Extremely Satisfied"). Right/Up and
    Left/Down change the value by one step. PageUp/PageDown change it by two steps.
    Home/End go to min/max. When no rating is set yet, a focus ring is drawn around the
    whole group. The example rates a 10-point satisfaction scale, not stars.
  - APG's guidance: "For inputs with seven or fewer choices, another pattern that could
    be used is radio group … when there are more than seven choices, other patterns
    provide additional keyboard commands." Five stars with half steps is ten choices.
  - The slider example warns that touch AT users may not be able to operate a
    `div[role=slider]` (cause J). A native `<input type="range">` does not have this
    problem.
- Roles and attributes required:
  - Radio variant: `radiogroup` + name, `radio` + name + `aria-checked`; optional
    `aria-required`, `aria-readonly`, `aria-invalid`, `aria-disabled`.
  - Slider variant: `slider` + name, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`,
    `aria-valuetext`; optional `aria-readonly`, `aria-invalid`, `aria-disabled`,
    `aria-orientation`. **`aria-required` is not supported on `slider`** in ARIA 1.2.
    axe `aria-allowed-attr` flags it.
  - Display-only rating (not a control): `role="img"` + `aria-label` ("4.5 of 5 stars"),
    as MUI does for `readOnly`.
- Keyboard: see the comparison table; the decision is under Decisions.

## How the others built it

| | Zag / Ark | Kobalte | Reka | MUI | Bits | RA (example) |
|---|---|---|---|---|---|---|
| Pattern | `radiogroup` (Control) + `span[role=radio]` items | `radiogroup` + `div[role=radio]` | `RadioGroup` + one radio **per step** | native `input[type=radio]` **per step** + an "Empty" radio | **`div[role=slider]`** on Root, items `role=presentation` | RAC `RadioGroup` |
| Item name | `aria-label` "3 stars" (checked item: "3.5 stars") + `aria-roledescription="rating"` | consumer (`ItemLabel`) | consumer | visually hidden label `getLabelText(v)` = "3 Stars" | — (`aria-valuetext` "3 out of 5") | consumer |
| Half steps | `allowHalf`: pointer midway → `n − 0.5`; arrows ±0.5; the item under `ceil(value)` is checked and renamed | `allowHalf` (same as Zag) | `step: 1 \| 0.5 \| 0.25 \| 0.1` → 1/step radios per star | `precision` → 1/precision radios per star | `allowHalf`: arrows ±0.5, pointer halves, typed "3.5" | — |
| No value | `-1` (default); item 1 is the tab stop | `0` | `0` | `null` (checks the "Empty" radio) | `0` (`min` default 0) | none |
| Clear | `clearValue()` API; Left reaches 0 | Left reaches 0 | `clearable`: click current value | click current value (pointer only) | click item 1 when value = its value and `min = 0`; Down/Home reach `min` | — |
| Up / Down | Up decreases, Down increases (radio) | Up decreases (radio) | radio (wraps) | radio: Up decreases (MUI#41290, by design) | Up increases (slider) | radio |
| Home / End | 1 / count | 1 / count | — | — | min / max | — |
| Page keys | — | — | — | — | ±1 | — |
| RTL | `getEventKey(dir)` flips arrows | flips arrows **and** reverses item values | radio's | `useRtl` for hover math | `getComputedStyle` direction, flips Left/Right | radio's |
| Hover preview | `hoveredValue` state; skips touch on Control | `hoveredValue`; skips touch on leave | `hoverable` | always; hover also overrides focus value | `hoverPreview` (default true); skips touch | consumer code |
| Read-only | items keep a tab stop, `aria-readonly` on Control | `aria-readonly` on root + items | — | Root `role="img"` + `aria-label`, no inputs | `data-readonly` only; still tabbable | — |
| Form | hidden `input type=text hidden`, value `-1` when empty | visually hidden text input | radio group's | native radios share `name` | hidden input only with `name` | native radios |
| Form reset / fieldset | `trackFormControl` | `createFormResetListener` | radio group's | native | — | native |

### Zag.js / Ark UI

- Source: `rating-group.machine.ts` (206 lines), `rating-group.connect.ts`,
  `rating-group.dom.ts`; Ark adds thin parts (`Item` is a `span`, `HiddenInput`).
- API: parts `root`, `label`, `control`, `item`, `hiddenInput`. Props `count` (5),
  `value`/`defaultValue` (−1), `allowHalf`, `readOnly`, `disabled`, `required`, `name`,
  `form`, `dir`, `autoFocus`, `translations.ratingValueText(index)` ("`${index} stars`"),
  `onValueChange`, `onHoverChange`. API: `setValue`, `clearValue`, `getItemState(index)
  → { highlighted, half, checked }`.
- State model: `idle | hover | focus`. Events `GROUP_POINTER_OVER`,
  `GROUP_POINTER_LEAVE`, `POINTER_OVER {index, isMidway}`, `CLICK`, `FOCUS`, `BLUR`,
  `ARROW_LEFT/RIGHT`, `SPACE`, `HOME`, `END`, `SET_VALUE`, `CLEAR_VALUE`. `value` and
  `hoveredValue` are bindables. `watch(allowHalf)` rounds the value. `watch(value)`
  dispatches `input` on the hidden input.
- Notable:
  - `getItemState` gives each item `highlighted` (≤ displayed value), `half` (the
    displayed value ends half-way through it) and `checked`. These became the `data-*`
    vocabulary (`data-highlighted`, `data-half`, `data-checked`) that Kobalte copied.
  - Hover preview is driven by the **displayed value** = hovered value if hovering,
    else the committed value.
  - Hover is ignored for `pointerType === "touch"` on the Control.
  - Half detection: `getRelativePoint(...).getPercentValue({ dir })`, so RTL is handled
    in one place.
  - Form reset and fieldset disabling come from `trackFormControl` (after
    [ZG#245](https://github.com/chakra-ui/zag/issues/245) listed Rating as missing reset).
- Problems:
  - One `checked` flag drove the tab stop, `aria-checked` and `data-checked`. With no
    value, item 1 was announced as checked, and the hovered item too
    ([ZG#3456](https://github.com/chakra-ui/zag/issues/3456), fixed by
    [PR #3457](https://github.com/chakra-ui/zag/pull/3457): only `aria-checked`
    was split out. `data-checked` still follows hover.)
  - Unreachable by Tab after leaving it at 0
    ([ZG#2891](https://github.com/chakra-ui/zag/issues/2891)).
  - Up and Down both decreased the value
    ([ZG#566](https://github.com/chakra-ui/zag/issues/566)). Today Up = previous and
    Down = next, as in the radio pattern.
  - A half value was previewed but never committed
    ([ZG#252](https://github.com/chakra-ui/zag/issues/252)).
  - Ark set `aria-readonly` on the `span` items and axe flagged it as critical
    ([ARK#2248](https://github.com/chakra-ui/ark/issues/2248), fixed in zag `def93df`).
  - From the source (no issue filed):
    - With `allowHalf`, a step from 3.5 to 4 keeps focus on item 4 and only changes its
      `aria-label` from "3.5 stars" to "4 stars". Screen readers do not reliably
      announce a name change on the focused element.
    - `aria-roledescription="rating"` on a form control: iOS VO then drops "required"
      (AT note cause I).
    - Space only works when the value is empty.
    - The hidden text input submits `-1` for "no value".
    - `focusActiveRadio` focuses inside a `raf`, after the value update.

### Kobalte

- Source: `rating-root.tsx` (`div[role=radiogroup]` with `aria-required`,
  `aria-invalid`, `aria-readonly`, `aria-disabled`, `aria-orientation`; uses
  `createFormControl` and `createFormResetListener`), `rating-item.tsx`
  (`div[role=radio]`), `rating-control.tsx` (`role=presentation`, clears the hover on
  leave except for touch), `rating-hidden-input.tsx` (a visually hidden
  `input type=text`, `tabIndex=-1`), plus `ItemLabel`/`ItemDescription` parts.
- API: `value`/`defaultValue` (0), `onChange`, `allowHalf`, `orientation`, form-control
  props (`name`, `validationState`, `required`, `disabled`, `readOnly`).
- Notable:
  - Group-level `aria-required`/`aria-invalid`/`aria-readonly`, as React Aria does for
    radio groups.
  - Items are named by an `ItemLabel` part, not by a hard-coded string.
- Problems (from the source; the tracker has only the request
  [KB#315](https://github.com/kobaltedev/kobalte/issues/315), whose maintainer chose
  "Ark-like, based on radio group"):
  - Each item's value comes from its DOM index in `onMount`, so the SSR markup has no
    correct `aria-checked`.
  - In RTL the values are reversed (`items.length − index`) **and** the arrow keys are
    flipped. The first DOM item, which is the visual start in RTL, gets value N.
  - The read-only `tabIndex` branch has no `return`
    (`if (isReadOnly()) equal() ? 0 : undefined;`), so it does nothing.
  - Hover is set on every `pointermove` without checking `pointerType`.

### Reka UI

- Source: `RatingRoot.vue` wraps `RadioGroupRoot` and adds `length` (5), `clearable`,
  `hoverable`, `step` (1 | 0.5 | 0.25 | 0.1). `RatingItem.vue` is a `label` per star
  and computes the `steps` it contains. `RatingItemIndicator.vue` is one
  `RadioGroupItem` per step, with CSS variables `--reka-rating-item-step-width`,
  `-opacity` and `-z-index` that overlay partial indicators.
- Notable:
  - Clearing is `clearable && modelValue === rating → 0`.
  - The hover reset on `mouseleave` is unconditional, so a preview left over from a
    `hoverable`/`disabled` toggle still clears.
  - Partial steps are rendered by stacking radios of decreasing width.
- Problems:
  - `step: 0.1` gives 50 radios, so AT announces "x of 50". Radios are unnamed unless the
    consumer names them.
  - Partial indicators are hidden unless focused, which depends on `activeElement`.
    This caused an SSR hydration style mismatch
    ([RK#2964](https://github.com/unovue/reka-ui/issues/2964), closed).
  - Two `data-state` vocabularies across components
    ([RK#2823](https://github.com/unovue/reka-ui/issues/2823)).
  - The request was [RK#1966](https://github.com/unovue/reka-ui/issues/1966).

### Bits UI

- Source: `rating-group.svelte.ts` (427 lines). The Root is `role="slider"` with
  `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, `aria-valuetext`,
  `aria-orientation`, `aria-required`, `tabindex=0`. Items are `role="presentation"`
  with `data-state="active | partial | inactive"` and `data-value`. A hidden input is
  rendered only when `name` is set.
- API: `value` (0), `min` (0), `max` (5), `allowHalf`, `readonly`, `disabled`,
  `required`, `orientation`, `hoverPreview` (true), `aria-valuetext` (string or
  `(value, max) => string`, default "`${value} out of ${max}`"), `onValueChange`.
- Notable:
  - **The only headless library that uses the slider pattern.** One tab stop. Up
    always increases. Left/Right are flipped in RTL. Home/End go to `min`/`max`.
    PageUp/PageDown change by ±1.
  - Typed digits set the value, and "3" then "." "5" within one second sets 3.5.
  - `calculateRatingFromPointer` uses the item rect and flips it in RTL.
  - Any key clears the hover preview, so `data-state` shows the committed value while
    arrowing ([bits-ui PR #1533](https://github.com/huntabyte/bits-ui/pull/1533)).
  - Touch is skipped for preview.
- Problems (from the source; the tracker has no rating issues, only the PRs
  [#1525](https://github.com/huntabyte/bits-ui/pull/1525), #1533 and
  [#1767](https://github.com/huntabyte/bits-ui/pull/1767)):
  - Hard-coded `aria-label="Rating"`, and no Label part.
  - `readonly` sets no `aria-readonly` and keeps `tabindex=0`.
  - `aria-required` on a `slider` is not an allowed attribute.
  - `div[role=slider]`, so TalkBack cannot adjust it (cause J).
  - `isRTL` reads `getComputedStyle` inside a derived value, so it is not reactive and
    returns `false` during SSR.
  - Clearing only works on item 1.

### MUI Material

- Source: `Rating.js` (861 lines). Each item is a `label` (icon + visually hidden
  `getLabelText(value)`, default "`${value} Star${s}`") plus a visually hidden **native
  `input[type=radio]`** sharing `name`. With `precision < 1`, each star holds 1/precision
  radios whose labels are clipped by width. An extra "Empty" radio holds `null`.
  `readOnly` renders no inputs: Root becomes `role="img"` with `aria-label` from
  `getLabelText(value)`.
- Notable:
  - Native radios give keyboard, form value and reset for free.
  - Hover is computed from the Root rect: `roundValueToPrecision(max × percent +
    precision/2)`.
  - On change, "Give mouse priority over keyboard": if hovering, the hover value wins
    ([MUI#22827](https://github.com/mui/material-ui/issues/22827)).
  - Clear = clicking the checked radio again. Keyboard clicks are ignored by
    `clientX === 0 && clientY === 0`.
  - `onChangeActive` reports the hovered value so consumers can show "Poor/Good".
- Problems:
  - The Root has no `role=radiogroup`, so the group has no name.
  - The "Empty" radio makes NVDA announce "2 of 6", and "2 of 17" in Chrome/Edge
    ([MUI#42562](https://github.com/mui/material-ui/issues/42562), open; the maintainer:
    "this component seems backed into a corner").
  - Precision radios are clipped labels, which led to:
    - half stars broken in Chrome 101 ([MUI#32557](https://github.com/mui/material-ui/issues/32557));
    - half stars broken under `text-align: center` ([MUI#20053](https://github.com/mui/material-ui/issues/20053));
    - precision not working on Android Chrome ([MUI#36356](https://github.com/mui/material-ui/issues/36356), open);
    - wrong rendering for 3.9 at 0.2 ([MUI#16939](https://github.com/mui/material-ui/issues/16939)).
  - Wrap-around through "Empty" differs in Safari
    ([MUI#34202](https://github.com/mui/material-ui/issues/34202), open), and so does the
    focus ring ([MUI#34194](https://github.com/mui/material-ui/issues/34194), open).
  - See Bug history for the rest.

### React Aria / React Spectrum

- No component. [RA#5911](https://github.com/adobe/react-spectrum/issues/5911) (open)
  asks for Spectrum's Rating. The only reply is from a team member (reidbarber):
  "this can use a radio group for the semantics … The labeling may need some tweaking so
  that the total number of stars is announced. Edit: Maybe also consider the slider
  pattern for better touch support".
- The RAC example `StarRatingGroup.tsx` uses `RadioGroup` + `Radio` with string values
  and tracks the hovered rating at group level with `onPointerOver`/`onPointerLeave`.
  It has no half steps and no clearing.
- `gh search issues "rating"` / `"star rating"` / `"stars"` / `"rating radiogroup"` on
  `adobe/react-spectrum` finds nothing else relevant.

## Accessibility

Applies [accessibility.md](accessibility.md) §2 (naming), §4 (focus), §5 (press/hover),
§6 (keyboard, RTL), §8 (visual preferences, target size) and §9 (numbers: "3 of 5
stars"), and the AT note's causes A, C, G, I, J, K.

### Radio group or slider

| Concern | Radio group (Zag, Kobalte, Reka, MUI, RA example, APG) | Slider (Bits, APG slider example) |
|---|---|---|
| Tab stops | one (roving) | one |
| Half steps | 2N radios ("x of 10", MUI/Reka) **or** rename the checked radio (Zag, unreliable announcement) | natural: `step = 0.5`, valuetext "3.5 of 5 stars" |
| No value / clear | a radio group cannot be cleared by the user (APG; rind's radio-group decided "no deselect"). An extra "Empty" radio breaks the count (MUI#42562) | `0` is a value: valuetext "No rating" |
| Up / Down | Up = previous (radio). Users report it as a bug (MUI#41290, ZG#566) | Up increases (slider) |
| Ends | wraps (APG radio), odd for a score; MUI wraps through "Empty", Safari differs (MUI#34202) | clamps; Home/End |
| Hover preview leaking into AT | `aria-checked`/tab stop followed hover (ZG#3456) | items are `aria-hidden`; preview cannot reach the AT tree |
| Exploring the options with a screen reader | yes, each star is read | no, the scale is in the valuetext ("of 5 stars") |
| `required` | `aria-required` on `radiogroup` | not allowed on `slider`. Expose it in the label/description; validate with `setCustomValidity` |
| Touch AT | native radios or `role=radio` + click work (cause A) | `div[role=slider]` fails on TalkBack (cause J). A **native `<input type="range">`** works: swipe up/down adjusts it |
| Implementation in rind-ui | radio-group machine + per-step items, plus clear and half rules that contradict it | Slider's native-input technique, its step math and the `keys` module, one control |

### Rules for rind-ui (both decided below)

- **Name**: the Label part names the control (`aria-labelledby`). The value is spoken
  through `aria-valuetext` from `messages.valueText({ value, max, formatted })`. The
  default is "3 of 5 stars" / "3.5 of 5 stars" / "No rating": `Intl.NumberFormat` for the
  number, `Intl.PluralRules` for "star"/"stars". It is never a bare number: native range
  inputs otherwise announce a percentage on some AT (slider.md open question).
  Locale-dependent strings come from `Environment.locale` on both server and client
  ([MUI#40529](https://github.com/mui/material-ui/issues/40529): a server/client
  `aria-label` mismatch).
- **Keyboard** (`keys` module, `value: true`):
  - Right/Up: +step. Left/Down: −step. In RTL, Left increases; Up always increases.
  - Shift+Arrow and PageUp/PageDown: ±1 star (`largeStep = max(1, step)`; for whole
    stars it equals the step).
  - Home: lowest selectable value. End: N.
  - No wrap. Every handled key calls `preventDefault`.
  - From "no value", Increase gives `step` (0.5 with half steps).
- **Focus**: one tab stop, the native range input. A focus without a key changes
  nothing (cause C). Focus never moves on a value change (it cannot: there is one
  element), so the radio-group "focus follows value" bugs (ZG#2891, Kobalte's `raf`
  focus) cannot happen. `data-focus-visible` comes from modality tracking, never from a
  blur/refocus (cause G, BU#5296).
- **Value in the same task as the key** (cause G): `aria-valuenow` and
  `aria-valuetext` update synchronously.
- **Hover preview is visual only**: items are `aria-hidden`. The preview never changes
  `aria-valuenow`, `aria-valuetext`, the form value or the tab stop (ZG#3456). Feedback
  text that follows the hover ("Poor", "Excellent") is the consumer's, through
  `onPreviewChange`. It must not be a live region. If it should be spoken for the
  committed value, it goes into `messages.valueText`
  ([MUI#31364](https://github.com/mui/material-ui/issues/31364) was fixed this way, with
  `getLabelText`).
- **Clearing**: with `allowClear`, Decrease/Home reach 0 by keyboard and a press on the
  item that holds the exact current value clears it. Clearing by pointer only was
  [MUI#25533](https://github.com/mui/material-ui/issues/25533). Without `allowClear`, 0
  exists only as the initial "no rating yet" state.
- **Read-only** (form field): the control stays focusable with `aria-readonly="true"`
  (allowed on `slider` in ARIA 1.2). Keys, presses, hover and AT adjustments change
  nothing; an AT adjustment is reverted (slider `resyncInputs`).
- **Display rating** (product score, not a form field): no input, no tab stop. The Root
  is `role="img"` with `aria-label` = valuetext, and the items stay `aria-hidden` (MUI's
  `readOnly`). `aria-readonly` is never put on non-interactive elements
  ([ARK#2248](https://github.com/chakra-ui/ark/issues/2248)).
- **Disabled**: the input is natively disabled (not focusable, submits nothing), as in
  Slider; `data-disabled` on every part; fieldset disabling applies.
- **Required / invalid**:
  - `aria-invalid` only when the consumer or Field says so.
  - `required` is **not** written as `aria-required` (not allowed on `slider`). The
    Field's required indicator text is in the label or description. While `required` and
    the value is 0, constraint validation goes through `setCustomValidity` on the range
    input with `messages.valueMissing`. A range input has no native `valueMissing`
    because it always has a value.
  - The input's own validity message is what `field-validation` reports.
- **Forced colors** (cause K, APG radio-rating notes):
  - Stars are SVG with `fill`/`stroke` = `currentColor` and `forced-color-adjust: auto`.
  - "Filled" vs "empty" differs in **shape**: a solid star vs an outline star, both
    always drawn. Colour is never the only difference.
  - The half star is a solid star clipped with logical `inset()`, so it survives forced
    colors and RTL ([MUI#20954](https://github.com/mui/material-ui/issues/20954): the
    half was drawn in the wrong star in RTL).
  - Hover preview uses `Highlight`. The focus ring is an `outline` around the Control.
- **Contrast**: empty-star outlines need 3:1 against the background (WCAG 1.4.11, not
  1.4.3 —
  [MUI#39135](https://github.com/mui/material-ui/issues/39135)).
- **Target size**: each star is at least 24×24 CSS px (WCAG 2.5.8). With half steps, each
  half is a 12 px target; see Open questions.
- **Touch**: no hover preview for `pointerType: "touch"` (Zag, Bits, Kobalte). A tap
  commits the value computed from **that tap's own position**, not from a previous
  hover ([MUI#36356](https://github.com/mui/material-ui/issues/36356): Android gave whole
  stars). There is no drag-to-rate; `touch-action` stays default so the page can scroll.
- **Motion**: any hover scale/fill transition in the theme sits under
  `prefers-reduced-motion: no-preference`.
- **Native platform** ([native-platform.md](native-platform.md) §8, §14): there is no
  native rating element. The two native options are radios (MUI) and a range input. The
  range input is what Slider already uses as an accessible native input. It gives
  TalkBack/iOS VO adjustment, form value, reset and focus for free, so we use it as the
  control and draw the stars around it.

## Bug history

Method: `gh search issues` (open and closed) on each repo:
- `chakra-ui/zag`, `chakra-ui/ark`: "rating", "RatingGroup", "rating group",
  "rating-group", "star";
- `unovue/reka-ui`, `kobaltedev/kobalte`, `huntabyte/bits-ui`: "rating", "star";
- `mui/material-ui`: "Rating in:title" (55 hits, all titles read);
- `adobe/react-spectrum`: "rating", "star rating", "stars", "rating radiogroup";
- `mui/base-ui`, `radix-ui/primitives`: "rating" (Radix: no hits).

Plus `gh search prs` on Bits and Zag. For the topics asked about (half star, RTL,
readOnly vs disabled, form reset, keyboard, hover preview, clearing, screen reader,
focus, touch), the hits are below. **Bits UI and Kobalte have no rating bug issues.**
Their entries come from reading the source and are marked as such.

| Library | Issue | Symptom | Root cause | Fix / status | Lesson for rind-ui |
|---|---|---|---|---|---|
| Zag | [#3456](https://github.com/chakra-ui/zag/issues/3456) closed | No value: item 1 announced as checked; the hovered item announced as checked | One `checked` flag for tab stop, `aria-checked` and styling, following hover | [PR #3457](https://github.com/chakra-ui/zag/pull/3457): `aria-checked` from the committed value only | Preview is visual; AT state comes from the committed value only; scenario |
| Zag | [#2891](https://github.com/chakra-ui/zag/issues/2891) closed | Not reachable by Tab after leaving it at 0 | Roving tab stop tied to the checked item | Fixed (item 1 forced "checked", which caused #3456) | One element owns the tab stop: no roving |
| Zag | [#566](https://github.com/chakra-ui/zag/issues/566) closed | Up and Down both decrease | Key map | Fixed (now radio direction) | Up always increases (slider) |
| MUI | [#41290](https://github.com/mui/material-ui/issues/41290) closed | Up decreases, Down increases | Radio pattern direction | By design (radio APG) | Users expect slider direction; the radio pattern gets this complaint |
| Zag | [#252](https://github.com/chakra-ui/zag/issues/252) closed | Half preview shown, whole value committed | Commit ignored the half | Fixed | Commit and preview share one pointer → value function |
| MUI | [#22827](https://github.com/mui/material-ui/issues/22827) closed | Clicking between icons selects a star that was not highlighted | Hover math (Root rect) and click target (label boxes) disagree | "Mouse priority": the hover value wins | Same: one function; commit uses the press's own position |
| MUI | [#32557](https://github.com/mui/material-ui/issues/32557), [#20053](https://github.com/mui/material-ui/issues/20053) closed; [#36356](https://github.com/mui/material-ui/issues/36356) open | Half stars not selectable (Chrome 101, centred text, Android Chrome) | Clipped overlapping radio labels + `pointer-events` tricks; the touch path has no hover | Partly fixed | Half = item fraction from the pointer position; no overlapping hit targets |
| MUI | [#16939](https://github.com/mui/material-ui/issues/16939) closed, [#40483](https://github.com/mui/material-ui/issues/40483) closed | 3.9 at precision 0.2 rendered wrong; decimal precision errors | Float rounding | `roundValueToPrecision` with fixed decimals | Reuse slider step math (`snap`, fixed decimals) |
| MUI | [#42562](https://github.com/mui/material-ui/issues/42562) open | NVDA: "2 of 6" (Firefox), "2 of 17" (Chrome) for 5 stars | Extra "Empty" radio; group not a `radiogroup` | Open ("backed into a corner") | Radio pattern + clearing has no clean answer → slider |
| MUI | [#25533](https://github.com/mui/material-ui/issues/25533) closed | Clearing only possible with a pointer | Clear bound to clicking the checked radio | Fixed (keyboard path) | `allowClear` ⇒ Decrease/Home reach 0 |
| MUI | [#24711](https://github.com/mui/material-ui/issues/24711) closed, [#31020](https://github.com/mui/material-ui/issues/31020) open | After clearing, switching tabs and back shows the old stars | Window refocus focuses a radio; focus state drives the display | Open | Focus never changes the displayed or committed value |
| MUI | [#18939](https://github.com/mui/material-ui/issues/18939) closed | Hover state stuck after fast moves | `mouseleave` missed through child SVGs | `pointer-events: none` on icons | Preview clears on Control `pointerleave` and on any key (Bits PR #1533) |
| Bits | [PR #1533](https://github.com/huntabyte/bits-ui/pull/1533) | `data-state` showed the hover while arrowing | Preview not cleared by keys | Clear preview on keys | Same |
| MUI | [#26573](https://github.com/mui/material-ui/issues/26573), [#35632](https://github.com/mui/material-ui/issues/35632) closed | `onChangeActive` fired on focus/blur; stale target | Hover and focus share one state | Fixed | `onPreviewChange` only for pointer preview |
| MUI | [#36882](https://github.com/mui/material-ui/issues/36882) closed | `onChange` gets `null` with hover feedback in a DataGrid | Several state setters racing | User-side | One write path in the machine |
| MUI | [#20954](https://github.com/mui/material-ui/issues/20954) closed | RTL half star drawn in the next star | Physical `left` clipping | Fixed | Logical clip; RTL scenario |
| Kobalte | source, no issue | RTL reverses item values *and* flips keys | Two compensations for one direction | — | Direction handled in one place (keys module + pointer fraction) |
| MUI | [#34202](https://github.com/mui/material-ui/issues/34202), [#34194](https://github.com/mui/material-ui/issues/34194) open | Safari: arrows don't wrap; no visible focus on stars | Native radio focus differences in WebKit | Open | One element we style; no wrap by design |
| Ark | [#2248](https://github.com/chakra-ui/ark/issues/2248) closed | axe critical: `aria-readonly` on `span` items | ARIA on non-interactive elements | Fixed in zag | ARIA states only on the control |
| Reka | [#2964](https://github.com/unovue/reka-ui/issues/2964) closed | SSR hydration style mismatch for half-step indicators | Visibility depended on `activeElement` | Fixed | Item styles derive from the value only; SSR scenario |
| MUI | [#40529](https://github.com/mui/material-ui/issues/40529) closed | Server "5 Stars" vs client "5 sao" | Locale differs between server and client | Closed (needs info) | Messages use `Environment.locale` on both sides |
| MUI | [#31364](https://github.com/mui/material-ui/issues/31364) closed | Hover feedback ("Poor") not exposed to AT | Visual-only text | Docs: put it in `getLabelText` | Feedback for the value goes into `messages.valueText` |
| MUI | [#39135](https://github.com/mui/material-ui/issues/39135) open | Empty/filled stars fail contrast checks | Light grey / yellow | Open (1.4.11 vs 1.4.3 debate) | Theme: 3:1 non-text contrast for outlines |
| MUI | [#38828](https://github.com/mui/material-ui/issues/38828) closed | `user-event` click in jsdom gives `NaN` | Hover math on a zero-size rect | Stub `getBoundingClientRect` | Zero-size item → whole-star value, never `NaN` |
| Zag | [#245](https://github.com/chakra-ui/zag/issues/245) closed | Form reset ignored | No reset listener | Fixed | Reset via `hidden-form-input` |
| MUI | [#49439](https://github.com/mui/material-ui/issues/49439) open | WCAG 2.2 audit: names, `role="img"` read-only, half precision, 2.5.8 | — | Open | Same checklist in our manual protocol |
| RA | [#5911](https://github.com/adobe/react-spectrum/issues/5911) open | Rating requested | — | Team member: radio group, "maybe slider for better touch support" | Both patterns are acceptable; we pick on half steps and clearing |

## Known pitfalls

1. **Preview leaks into semantics or into the commit**: ZG#3456 (`aria-checked`),
   MUI#24711/#31020 (focus drives display), MUI#22827/ZG#252 (preview ≠ commit),
   MUI#36356 (touch has no preview, so the commit is wrong).
2. **Half steps as extra radios** (MUI, Reka): count announcements ("x of 10", "x of
   50"), clipped overlapping hit targets (MUI#32557, #20053), hydration (RK#2964).
   Renaming the focused radio (Zag) is not reliably announced.
3. **"No value" and clearing don't fit a radio group**: the Empty radio (MUI#42562),
   the forced tab stop on item 1 (ZG#2891 → ZG#3456), pointer-only clear (MUI#25533).
4. **Arrow direction**: the radio pattern makes Up decrease (MUI#41290, ZG#566).
   Direction compensated twice (Kobalte RTL).
5. **ARIA in the wrong place**: `aria-readonly` on spans (ARK#2248), `aria-required` on a
   `slider` (Bits), `aria-roledescription` on radios (Zag), a hard-coded `aria-label`
   (Bits).
6. **Touch AT**: `div[role=slider]` cannot be adjusted on TalkBack (cause J; APG warning).
7. **Geometry**: zero-size rects in jsdom (MUI#38828), physical `left` in RTL
   (MUI#20954), hover math on the Root rect vs per-item boxes (MUI#22827).

## Testing notes

- **Layout-free machine**: pointer events reach it as `{ item, fraction }`, where
  `fraction` is 0..1 along the item in the logical direction (RTL applied in `core/dom`,
  as slider's `pointer-drag` does). Half-star logic runs in Node. A zero-size item gives
  `fraction = null` → whole star.
- **Model-based**: states `idle ↔ previewing`. Arguments: `count` 3/5/10, `step` 1/0.5,
  `allowClear`, `readOnly`, `disabled`, `required`, `dir` rtl, initial 0/whole/half.
  Invariants:
  - `aria-valuenow` equals the oracle after every step;
  - preview never changes `aria-valuenow` or the form value;
  - exactly one focusable element;
  - no blur/focus during keys (cause G spy).
- **AT adjust path**: `adjustNative(v)` sets the range input like TalkBack (property +
  `input`/`change`, no keys). Playwright `fill()` on the range input; in the DOM adapter,
  the native setter. A read-only or non-clearable adjustment to 0 is reverted.
- **Hover**: Playwright `hover()` at an item fraction (browser mode). In jsdom a pointer
  move without layout previews whole stars. Touch: `pointerType: "touch"` press → no
  `data-previewing`.
- **axe**: no `aria-required` on the slider (`aria-allowed-attr`), items `aria-hidden`
  with no focusable content, display variant `role="img"` with a name.
- **Forced colors**: Playwright `forcedColors: "active"` captures of empty, half, full,
  previewing and focused stars (AK's method from the AT note, cause K).
- **Driver**:
  - actions: `rate(value)` (pointer: press the item at the fraction; keyboard: keys from
    the current value; virtual: `adjustNative`), `step("increase" | "decrease",
    { large })`, `toEdge("min" | "max")`, `preview(value)` / `endPreview()`,
    `clear()`, `adjustNative(v)`, `resetForm()`;
  - queries: `value()`, `valueText()`, `previewValue()`,
    `itemStates()` → `{ highlighted, half, checked }[]`, `isDisabled()`,
    `isReadOnly()`, `isInvalid()`, `formValue()`.

## Decisions

- **Pattern: slider.** One native `<input type="range">` is the accessible control,
  inside a visual row of `aria-hidden` stars. Reasoning:
  1. Half steps are first-class (asked for, and shipped by Zag, Kobalte, Bits, Reka,
     MUI). A slider exposes 3.5 as a value. A radio group needs ten radios or a renamed
     focused radio (pitfall 2).
  2. "No rating" and clearing are values of a slider (0). In a radio group they need an
     extra radio that breaks the count (MUI#42562), or they contradict rind's
     radio-group decision ("no deselect").
  3. Up increases and the ends clamp, which matches user reports (MUI#41290, ZG#566) and
     the APG slider-rating example.
  4. The hover preview cannot reach the AT tree because no item has a role (ZG#3456 is
     impossible by construction).
  5. The usual slider weakness, touch AT (cause J, APG warning), does not apply: we use
     the **native range input**, like Slider. That also gives form value, reset,
     fieldset and `adjustNative` from existing code (`hidden-form-input` "Accessible
     Native Input").
  6. rind-ui already has the pieces: `slider.math` (`snap`, `clamp`, fixed decimals),
     the `keys` module with `value: true`, the AT-adjust revert, slider messages.
  - What we give up, and how we cover it:
    - `aria-required` is not allowed on `slider`: required is shown in the label or
      description; validity comes from the form input (below), so a missing rating is a
      real `valueMissing` with the browser's own message.
    - The screen reader cannot list the five stars one by one: the valuetext says
      "of 5 stars".
    - APG suggests a radio group for ≤ 7 choices: with half steps there are 10, and
      APG allows both.
  - The radio variant was weighed seriously: APG, Zag, Kobalte, Reka, MUI and the RA team
    member lean that way. Its advantages (`aria-required`, per-star exploration) matter
    less than three things the slider handles natively: half steps, clearing, and
    direction.
- **Machine**: a new `rating.machine.ts`, **not** the slider machine. The slider machine
  is built around thumbs, drags, collisions and `dragging`. Rating has item presses, a
  preview and clearing. It reuses `slider.math` and the keys module; generalise the
  shared parts, not the machine.
  - States: `idle`, `previewing` (a non-touch pointer is over the Control and the rating
    is interactive).
  - Events:
    - `POINTER.MOVE { item, fraction }` (preview; enters `previewing`);
    - `POINTER.LEAVE`;
    - `PRESS { item, fraction, modality }` (commit from the press's own position;
      exact current value + `allowClear` → 0);
    - `INCREASE | DECREASE | PAGE_NEXT | PAGE_PREV | FIRST | LAST { shift }` (each clears
      the preview);
    - `INPUT.CHANGE { value }` (AT; reverted if read-only or below the floor);
    - `RESET` (form);
    - `VALUE.SYNCED`;
    - `FOCUS` / `BLUR` (context only; no transition depends on focus).
  - Context: `preview: number | null`.
  - Controllable `value: number` (0 = no rating), `defaultValue` (0), `onValueChange
    (value, details)` with `reason` = the event. The preview is in the render state
    (`state.preview`); no `onPreviewChange` until a consumer needs one.
- **Props**: `count` (5), `allowHalf` (false: the step is 1, else 0.5), `allowClear`
  (false), `name`, `form`, `required`, `disabled`, `readOnly`, `invalid`, `locale`, `dir`,
  `messages` (`valueText`). Values off the grid are rounded to it.
  Changing `step` does not rewrite the controlled value (Zag rounds on watch; we only
  render the snapped value).
- **Floor**: the lowest selectable value is `allowClear ? 0 : step`. Decrease and Home
  stop at the floor. The range input keeps `min=0`, so an initial 0 is a real native
  value; `aria-valuemin` is therefore 0 (Open questions).
- **Parts**:
  - `Root`: `div`, no role (interactive) or `role="img"` + `aria-label` (display, see
    below).
  - `Label`: `<label>` without `for`, as in Slider (WebKit 172464). A press focuses the
    input.
  - `Control`: `div`, the pointer surface. `pointerleave` ends the preview. It renders
    the internal `ControlInput`: the native `<input type="range" min=0 max=count
    step>`, visually hidden but sized to the Control so the VO focus ring matches, with
    `pointer-events: none`. It carries `aria-labelledby`, `aria-valuetext`,
    `aria-readonly`, `aria-invalid`, `aria-describedby` (Field), and no `name`.
  - `Item`: `span`, `aria-hidden`, `index` prop (1-based), consumer renders the icon.
  - Description and ErrorMessage come from Field (`field-control` binding, as for
    Slider).
  - A hidden form input (`hidden-input`, as Select's): `aria-hidden`, `tabindex=-1`,
    `name`, `required`, value `""` while unrated, so `required` is a native
    `valueMissing` and a reset goes through `hidden-form-input`; focusing it (validation)
    forwards to the range input. *(Implementation decision, add-rating: one carrier
    instead of `name` toggling and `setCustomValidity`.)*
- **Display rating**: not shipped in add-rating (a non-goal): a consumer renders stars
  with `role="img"` and an `aria-label`; `readOnly` covers the focusable case.
- **`data-*`**:
  - Root and Control: `data-disabled`, `data-readonly`, `data-invalid`,
    `data-required`, `data-previewing`, `data-focus`, `data-focus-visible`.
  - Focus attributes only on the Control and the input (the ring goes around the stars).
  - Item: `data-index`; `data-state` `full` / `half` / `empty` from the *displayed* value
    (preview, else committed); `data-previewed` inside the preview. The committed value
    is read from `aria-valuenow`, never from an item (ZG#3456 impossible: items have no
    ARIA state). *(Implementation decision, add-rating: one `data-state` instead of
    `data-highlighted` / `data-half` / `data-checked`; `data-highlighted` would also fall
    under the generic highlighted-part focus invariant.)*
- **Contract**: locate by role `slider` and the Label's name (display: role `img` and
  name). Actions and queries are listed under Testing notes. Traits `valued`,
  `directional`, `form-associated`.
- **Theme**: the stylesheet draws each star, no icon: `::before` an outline star
  (`evenodd` polygon, always drawn), `::after` the solid star, painted for `full` and from
  the reading start for `half` (`:dir(rtl)`). Forced colors: `CanvasText` outline,
  `Highlight` fill. Focus is an `outline` on the Control. Star size
  `--rind-rating-star-size` (≥ 24px at every size). No transition under reduced motion.
- **Deliberately different**:
  - The slider pattern on a native range input. Bits uses a `div[role=slider]`; the
    others use radio groups.
  - No wrap.
  - Up increases.
  - No `aria-required`.
  - No `aria-roledescription`.
  - No hard-coded names: the Label names the control.
  - Commit from the press position, not from the hover state.
  - Clearing is reachable by keyboard.
  - Items carry no committed-value state at all: only what is drawn.
  - Typed digits (Bits) are not bound.

## Open questions

- `aria-valuemin` is 0 even without `allowClear`, because the native range must hold an
  initial 0. Is "0 of 5" reachable in the AT's view but refused acceptable, or should the
  input switch `min` to `step` once a value is set? Check on VO, NVDA and TalkBack in the
  manual protocol.
- Half-star targets are 12 px wide at the default 24px star. WCAG 2.5.8's exceptions do
  not obviously cover this. Should the theme default to a larger star when `step = 0.5`,
  or do we document it?
- Touch drag-to-rate (scrub across stars), as in Slider's `pointer-drag`. Not in the
  first change; add it if consumers ask, and decide `touch-action` then.
- `step` finer than 0.5 (Reka 0.25/0.1, MUI `precision`): the machine allows any step
  that divides 1, but the first change ships `1 | 0.5` only.
- Typed digits ("3", "3.5") as a shortcut (Bits): useful for power users, not in APG.
  Decide with the keys module owner.
