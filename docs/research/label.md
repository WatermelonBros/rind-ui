# Label — research

Status: done · Wave: 1 (the standalone label; the control-bound labels are `control-label`
in `add-checkbox` and `Field.Label` in `add-field`, which reuse this note's interaction
rules)

Cross-cutting: [accessibility.md](accessibility.md) §2 (name precedence: native
`<label for>` for labelable controls, `aria-labelledby` otherwise),
[assistive-tech-and-a11y-testing.md](assistive-tech-and-a11y-testing.md) §1.2 A (a click
the browser forwards from a label looks like an AT "virtual" click). Label activation
counting and the pointer-modality rule for label-forwarded clicks are already decided in
[checkbox.md](checkbox.md) and specified in `add-checkbox` (`control-label`).

## Pattern

- No APG pattern. HTML `<label>`: names its *labeled control* — the element named by `for`
  if it is **labelable** (`button`, `input` except hidden, `meter`, `output`, `progress`,
  `select`, `textarea`, form-associated custom elements), else its first labelable
  descendant. Activation behaviour: a click on the label (not on an interactive descendant)
  runs the control's activation (`click()`): focuses inputs, toggles checkboxes, **clicks
  buttons** (so a `<label for>` on a popup trigger opens the popup). Hover/active on the
  label propagate to the control (`:hover` on the input).
- A `for` that points at a non-labelable element (a `div role=combobox`, a `span`) names
  nothing and activates nothing; Chrome DevTools reports it (HUI#3876, HUI#3883).
- Name from a label works before hydration and without JavaScript (RX#1577).

## How the others built it

- **Radix** `label/src/label.tsx`: a native `<label>`; `onMouseDown` →
  `if (target.closest("button, input, select, textarea")) return;` user handler first;
  `if (!event.defaultPrevented && event.detail > 1) event.preventDefault()` — stops the
  text selection a double click on the label text would make. History: it was a
  `<span role="label">` with JS focus forwarding (RX#638/#1310/#1558 invalid role, RX#1577
  no-JS, RX#1233 no hover) until PR #1686 made it native; the interactive-descendant guard
  came with PR #2753 (RX#2656: it broke a nested number input's spinner).
- **Reka** `Label/Label.vue`, **Bits** `bits/label/label.svelte.ts`: the same mousedown
  rule, without the interactive-descendant guard (BITS#1323: double-click selection inside
  a nested input broken, closed without fix).
- **Base UI** `internals/labelable-provider/useLabel.ts` (used by `Field.Label` and every
  control label): `nativeLabel` (default) → `htmlFor` + the guarded mousedown rule;
  non-native (`render` not a `<label>`) → `onClick` focuses the control with
  `focus({ focusVisible: true })` and `onPointerDown` prevents default (no text selection,
  no focus theft); a dev error when the tag and `nativeLabel` disagree (BU#587).
- **Headless UI** `components/label/label.tsx`: `htmlFor` from the field; `onClick`
  `preventDefault`s the native label activation, then calls `target.click()` for
  checkbox/radio/switch roles and `target.focus({ preventScroll: true })` otherwise;
  passive mode for decorative labels; default tag `div` when there is no `htmlFor`.
  HUI#3658: `preventDefault` on every click made links inside the label unclickable.
- **React Aria** `react-aria-components/src/Label.tsx`: a plain `<label>` filled from
  context (`useLabel`: `htmlFor` only when the label element is a `label`, id first in the
  control's `aria-labelledby`); controls with non-labelable elements use
  `aria-labelledby` + their own label press handling.

## Accessibility

- A Label is not focusable and has no role: no keyboard interaction, no `aria-*`.
- **Labelable target** → `for`; the browser does naming and activation. **Non-labelable
  target** → the control must reference the label with `aria-labelledby`; the Label can
  only offer focus forwarding. rind controls already do this through `control-label` and
  `Field.Label`; a standalone Label aimed at a consumer's non-labelable element warns in
  development and forwards focus.
- **A label focuses; it does not open.** Native `<label>` + `<select>` only focuses
  (HUI#3787, BU#3236). A label-forwarded click on a popup trigger button opens it and, on
  mobile, re-opens a Select right after an option was picked (RX#3679). Popup triggers
  (Select, Combobox, Menu, Date Picker) must treat a label-forwarded click as focus only;
  toggles (Checkbox, Switch, Radio) keep native activation (`control-label`).
- **Focus ring after a label click**: pointer modality, no ring (`control-label`, RA#10299)
  — Base UI forces `focusVisible: true`; we follow the modality rule already specified
  (a label click is a pointer interaction).
- **Text selection**: suppress only the selection a *double* click on label text makes,
  never a single mousedown (BU#586: it also blocked blurring the previous input), never on
  interactive descendants (RX#2656, BITS#1323), never when already `defaultPrevented`.
- Target size: the label extends the control's hit area (2.5.8) — a theme concern.

## Bug history

All issues read, open and closed.

| Library | Issue | Symptom | Root cause | Fix / status | Lesson for rind-ui |
|---|---|---|---|---|---|
| Radix | [primitives#2656](https://github.com/radix-ui/primitives/issues/2656) | double-click prevention broke a nested number input's spinner | `preventDefault` on every `detail > 1` mousedown | closed (PR #2753 guard) | skip interactive descendants, respect `defaultPrevented`, user handler first |
| bits-ui | [bits-ui#1323](https://github.com/huntabyte/bits-ui/issues/1323) | double-click word selection inside a nested input broken | unguarded port | closed, no fix | copy the guarded rule |
| Base UI | [base-ui#586](https://github.com/mui/base-ui/issues/586) | mousedown on a label did not blur the focused input | `preventDefault` on single mousedown | closed | prevent only when `detail > 1` |
| Radix | [primitives#638](https://github.com/radix-ui/primitives/issues/638) / [#1310](https://github.com/radix-ui/primitives/issues/1310) / [#1558](https://github.com/radix-ui/primitives/issues/1558) | "invalid ARIA role" from axe/Lighthouse | `<span role="label">` | closed (PR #1686 native label) | real `<label>`, no invented roles |
| Radix | [primitives#1577](https://github.com/radix-ui/primitives/issues/1577) | label click does nothing without JS | JS focus forwarding on a span | closed (#1686) | native `for` first |
| Radix | [primitives#1233](https://github.com/radix-ui/primitives/issues/1233) | label hover does not reach the control's `:hover` | not a label | closed (#1686) | native label propagates hover |
| Radix | [primitives#1232](https://github.com/radix-ui/primitives/issues/1232) | wrapping `<Label>text<input/></Label>` did not focus | only `htmlFor`/context association | closed | implicit (wrapping) association works with no id |
| Radix | [primitives#609](https://github.com/radix-ui/primitives/issues/609) | `preventDefault` on a link inside a Label still toggled the checkbox | native listener bypassed React order | closed | honour children's `defaultPrevented` |
| Headless UI | [headlessui#3658](https://github.com/tailwindlabs/headlessui/issues/3658) | links inside a Label not clickable | `preventDefault` on all clicks | closed (PR #3709) | never cancel clicks on interactive descendants |
| Radix | [primitives#512](https://github.com/radix-ui/primitives/issues/512) | controlled Checkbox in a plain `<label>` stuck | two toggles per click | closed | `control-label` (one activation per label click) |
| Radix | [primitives#3679](https://github.com/radix-ui/primitives/issues/3679) | Select inside a `<label>` reopens after picking on mobile | label re-dispatches the tap to the trigger | open | popup triggers: label-forwarded click = focus only |
| Headless UI | [headlessui#3787](https://github.com/tailwindlabs/headlessui/issues/3787) | label click does not open Listbox | by design (native parity) | closed | contract: a label focuses, never opens |
| Base UI | [base-ui#3236](https://github.com/mui/base-ui/issues/3236) | label click on Select focuses but does not open; no `:focus-visible` | native parity; Chrome lacked `focusVisible` | closed | focus, don't activate |
| React Aria | [react-spectrum#10751](https://github.com/adobe/react-spectrum/issues/10751) | label click focuses Select/Slider with no ring | modality set after the focus ring subscribed | open | decide focus-visible synchronously from the modality rule |
| Radix | [primitives#3294](https://github.com/radix-ui/primitives/issues/3294) | `<Label htmlFor>` + `id` on Select.Trigger: orphan label | id not on the right element | open | `for` targets the visible focusable control |
| Base UI | [base-ui#1051](https://github.com/mui/base-ui/issues/1051) | Field.Label click focused the hidden input | id on the hidden input | closed | id belongs to the visible control |
| Base UI | [base-ui#2113](https://github.com/mui/base-ui/issues/2113) | label no longer focused the Select trigger | id dropped in a refactor | closed (PR #2118) | label-click-focuses test per control |
| Base UI | [base-ui#587](https://github.com/mui/base-ui/issues/587) | `render={<div/>}` label did not focus | relied on native `for` | closed (`nativeLabel`) | substituted label → JS focus + `aria-labelledby`; warn on mismatch |
| Headless UI | [headlessui#3876](https://github.com/tailwindlabs/headlessui/issues/3876) | "label for doesn't match any id" | `for` → button/hidden input without id | open | `for` only to labelable targets |
| Headless UI | [headlessui#3883](https://github.com/tailwindlabs/headlessui/issues/3883) | Radio label `for` → `span` | same | open | detect non-labelable target, drop `for` |
| Headless UI | [headlessui#3569](https://github.com/tailwindlabs/headlessui/issues/3569) | consumer `aria-labelledby` ignored | generated ids overwrote it | closed | consumer ids merge with generated ones |
| React Aria | [react-spectrum#6787](https://github.com/adobe/react-spectrum/issues/6787) | label `for` stale when the input gets a consumer `id` | id derived twice | closed (PR #6788) | one id per control, consumer id fed back |
| React Aria | [react-spectrum#1534](https://github.com/adobe/react-spectrum/issues/1534) | provided `id` changed internally | two ids merged | closed | one source wins deterministically |
| React Aria | [react-spectrum#3613](https://github.com/adobe/react-spectrum/issues/3613) | label for a button does not trigger `onPress` in Firefox | Firefox dispatches the forwarded click differently | closed (bmo 1796300) | handle the plain `click` |
| React Aria | [react-spectrum#3901](https://github.com/adobe/react-spectrum/issues/3901) | label click inside a draggable started keyboard DnD | forwarded click looked virtual (`detail === 0`) | closed | the label-forwarded-click rule (`control-label`) |
| Ariakit | [ariakit#7176](https://github.com/ariakit/ariakit/issues/7176) | test helper's label click lost `detail`/modifiers | re-dispatch without them | closed (PR #7208) | the test adapter's `clickLabel` replays the browser's event |
| Kobalte | [kobalte#652](https://github.com/kobaltedev/kobalte/issues/652) | no `for` in SSR HTML | set in a client effect | closed | label↔control relation in server markup |
| Reka | [reka-ui#2860](https://github.com/unovue/reka-ui/issues/2860) | radio `aria-label` = raw value, overriding the label | one-shot DOM query before the label mounted | closed | never compute names from render-time DOM queries |

## Known pitfalls

- Popup triggers inside a `<label>` (or with `<label for>`) are activated by the label.
- A label-forwarded click has `detail: 0` and no pointer events on the target: it must not
  be classified as an AT click (`control-label` rule).
- `preventDefault` on mousedown also prevents the focus change away from the previous
  element (BU#586) — single clicks must never be cancelled.

## Testing notes

- jsdom does implement label activation (`click` forwarding); browser mode for selection
  and hover.
- Contract: scope `label`, located by text; actions `click`, `doubleClick` (keyboard: none,
  "a label has no keyboard interaction"); queries `text`, `control` (the element it labels,
  via `HTMLLabelElement.control`), `selection` (selected text after a double click).

## Decisions

- **Parts**: `Label.Root` (`label`). **No machine**: no state, no transitions; connect
  produces the props from the rendered element and its target.
- **`label-interaction` capability** (specified here, reused by `control-label` and
  `Field.Label`): the guarded double-click selection rule; focus-only forwarding for
  non-labelable targets; dev warning for `for` → non-labelable or missing element; no
  `preventDefault` on clicks.
- **`data-*`**: `data-scope="label"`, `data-part="root"`, `data-instance`. No state
  attributes: a standalone Label does not observe its target; labels that mirror a
  control's state are `control-label`'s and `Field.Label`.
- **Different from others**: Headless UI's click re-dispatch is not copied (native
  activation stays); Base UI's forced `focusVisible: true` is not copied (modality rule).

## Open questions

- None.
</content>
</invoke>
