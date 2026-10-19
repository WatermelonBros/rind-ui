## Context

The research note ([rating.md](../../../docs/research/rating.md)) compares Zag / Ark, Reka,
Bits UI, Kobalte and MUI, the APG radio and slider rating examples and React Aria's open
request, and records the bug history behind each scenario. Every shipping library except
Bits uses a radio group; Bits uses `div[role=slider]`. rind-ui uses a native range input.

## Goals / Non-Goals

**Goals:**
- A layout-free machine: pointer events carry the star index and the fraction across it, so
  every transition runs in Node.
- One value on one axis: whole stars, half stars and "no rating" with no extra elements.
- The preview is visual only: no ARIA, form or tab-stop change while hovering.

**Non-Goals:**
- Reusing the Slider machine: it has thumbs, drags and commits that a Rating does not need.

## Decisions

### 1. Pattern: a native range input, not radios

The focusable element is a visually hidden `<input type="range" min=0 max=count step>`
inside the Control, sized to it, `pointer-events: none`. It is the only element with role
`slider` and the only tab stop. Why not radios: half stars need 2N radios or a renamed
radio, clearing needs an "Empty" radio that breaks the count (MUI#42562), arrows wrap and Up
decreases (MUI#41290, ZG#566), and TalkBack cannot adjust a `div[role=slider]` (cause J),
which a native input fixes. Cost: `aria-required` is not allowed on `slider`; required is
validated by the form input and said in the Label or a Field Description.

### 2. Machine

States `idle` and `previewing`. Context `preview` (number or null), `focused`, `pending`
(an unanswered controlled proposal). Events:

```ts
| { type: "POINTER.MOVE"; index: number; fraction: number }   // never from touch
| { type: "POINTER.LEAVE" }
| { type: "PRESS"; index: number; fraction: number; modality }
| { type: "INCREASE" | "DECREASE" | "PAGE_PREV" | "PAGE_NEXT" | "FIRST" | "LAST"; modality }
| { type: "INPUT.CHANGE"; value: number }                     // assistive technology
| { type: "RESET" } | { type: "VALUE.SYNCED" } | FocusEvent | BlurEvent
```

- Grid: `step` = 0.5 with `allowHalf`, else 1; `floor` = 0 with `allowClear`, else one step.
  Values normalise to `[0, count]`, rounded to the grid.
- `ratingAt(index, fraction)`: `index - 0.5` when half and `fraction < 0.5`, else `index`.
- Keys: ±step, Page ±1 star, Home = floor, End = count, never below the floor (an unrated
  Rating stays at 0 going down), no wrap.
- A press sets `ratingAt`; pressing the current value with `allowClear` gives 0. A mouse or
  pen press enters (or stays in) `previewing` with the pressed value; a tap or a bare click
  goes to `idle`. Read-only: a press only focuses.
- Any key, an AT change and a reset end the preview (`idle`). `disabled` or `readOnly`
  becoming true sends `POINTER.LEAVE`.
- One write path as in Slider: uncontrolled, the inputs are synced before `onValueChange`
  returns and dispatch `input` + `change` for user changes; controlled, the proposal waits
  in `pending` and is mirrored when the prop arrives (`VALUE.SYNCED`), or reverted.
- `INPUT.CHANGE`: snapped to the grid; below the floor refused; the inputs re-synced.

### 3. Connect

Parts `root`, `label`, `control`, `item`, `input`, `hidden-input`. Every part carries
`data-disabled`, `data-readonly`, `data-required`, `data-invalid`, `data-previewing`; the
Control and the input carry `data-focus` / `data-focus-visible` (the ring goes around the
stars). Items: `aria-hidden="true"`, `data-index`, `data-state` (`full` / `half` / `empty`
from the preview, else the value), `data-previewed` inside the preview. The input:
`aria-valuenow`, `aria-valuemin=0`, `aria-valuemax=count`, `aria-valuetext` from messages
("3.5 of 5 stars", "No rating", `format.number` in the locale), `aria-readonly`,
`aria-invalid`, `aria-labelledby` (Field label, else own Label), no `name`. The form input
(`hidden-input`): `aria-hidden`, `tabindex=-1`, `name`, `required`, value `""` while unrated
so `required` fails with `valueMissing`; its focus (validation) forwards to the range input.
`ratingFraction(box, clientX, dir)` maps a pointer to the fraction in reading order; a
zero-size box gives 1 (a whole star, never NaN).

### 4. React

`Rating.Root` owns the machine, Field and Fieldset binding (one control, validity element the
form input, focus the range input), `hidden-form-input` for both inputs (reset through the
form input, native adoption through the range input). `Rating.Item` sends `POINTER.MOVE`
(not touch) and `PRESS` on `pointerup` (activation on release, at the release position),
prevents `pointerdown` so focus stays on the input, and maps a bare click (`detail` 0, no
release before it) to a whole-star `PRESS`. `Rating.Control` renders both inputs after its
children and sends `POINTER.LEAVE` on `pointerleave`.

### 5. Contract

`locate` by role `slider` and name. Actions: `focus`, `rate(v)` (pointer/touch press at the
quarter of the half that means `v`, mirrored in RTL; keyboard steps), `pressStar(i)`,
`step`, `toEdge`, `hover(i, half?)`, `leave` (pointer only), `adjustNative(v)` (touch: what a
touch screen reader does), `resetForm`. Queries: `value`, `valueText`, `stars`,
`isPreviewing`, `isDisabled`, `isReadOnly`, `formValue`. Traits `valued`, `directional`,
`form-associated`, `field-associated`. Invariants: value on the grid; range input, form
input and stars agree with the value (stars only outside the preview).

### 6. Model configurations

uncontrolled (1), unrated, half stars with `allowClear` (2.5), read-only (3), controlled
applying (2); every modality in browser mode, keyboard in jsdom (hover skipped there: no
layout); `dir="rtl"` runs.

### 7. Theme

`rating.css`, family `range` (`solid`, `soft`; sizes `sm`/`md`/`lg`, every star ≥ 24 px).
Each Item draws its star: `::before` the outline (outer minus inner star, `evenodd`
polygon, `border-strong`, always drawn, so empty reads by shape), `::after` the solid star,
painted for `full`, half from the reading start for `half` (`:dir(rtl)` mirrors). Preview
tone on `data-previewed`. Forced colors: `forced-color-adjust: none`, outline `CanvasText`,
fill `Highlight`, disabled `GrayText`. Transition off under reduced motion.

## Risks / Trade-offs

- Half-star targets are half a star wide (12 px at 24 px stars): the keys are the full-size
  alternative; recorded in the research open questions.
- `aria-valuemin` is 0 even without `allowClear` (a native range input clamps a 0 value to
  `min`, so 0 must stay in range).
- No `aria-required` on a slider: required is announced only through the name or description.
