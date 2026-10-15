# Checkbox — research

Status: done · Wave: 1 (used by Reado; first form-associated control, so it also settles the
hidden-form-input and label wiring that Switch, Checkbox Group, Radio Group and Select reuse)

Cross-cutting rules come from [accessibility.md](accessibility.md),
[assistive-tech-and-a11y-testing.md](assistive-tech-and-a11y-testing.md) and
[native-platform.md](native-platform.md) (§14: hidden native inputs, no `ElementInternals`).
Button-like semantics (native `<button>`, `render` substitution, `focusableWhenDisabled`,
disabled fieldset) are researched in [button.md](button.md) and specified once in
`add-button` (`button-like-element`). The group and its "select all" parent are in
[checkbox-group.md](checkbox-group.md); Switch, which shares this note's form and label
decisions, is in [switch.md](switch.md).

Sources read 2026-10-14 in the local clones (paths relative to each repo; React Aria via
`git show HEAD:`).

## Pattern

- WAI-ARIA APG: [Checkbox](https://www.w3.org/WAI/ARIA/apg/patterns/checkbox/), with the
  two examples "Checkbox (Two State)" and "Checkbox (Mixed-State)".
- Roles and attributes:
  - `role="checkbox"` (implicit on `<input type="checkbox">`), `aria-checked="true" |
    "false" | "mixed"`; the native input exposes mixed through its `indeterminate` property.
  - Accessible name from a visible label (`<label for>` or `aria-labelledby`), else
    `aria-label`; description through `aria-describedby`.
  - `aria-required`, `aria-invalid`, `aria-readonly` (allowed on `checkbox` since ARIA 1.2),
    `aria-disabled` for a focusable disabled control.
  - A set of related checkboxes is a `group` labelled by its visible label (or
    `<fieldset><legend>`); see checkbox-group.md.
- Keyboard: **Space** toggles. Nothing else. APG lists no Enter interaction; a native
  checkbox in Chromium, Firefox and Safari performs the form's *implicit submission* on
  Enter instead of toggling (the behaviour users of form-heavy UIs rely on; see
  HUI#2958, BU#4677).
- Mixed state: APG's mixed example is a *parent* checkbox whose activation cycles mixed →
  checked → unchecked → mixed; that cycle belongs to the group. A standalone checkbox with
  `aria-checked="mixed"` becomes checked when activated (native `indeterminate` is cleared by
  a click; Radix, Zag, Reka, Bits do the same).

## How the others built it

Two families:

| Family | Libraries | Accessible element | Form participation |
|---|---|---|---|
| **Native input is the control** | React Aria, Zag/Ark, Kobalte, Ariakit (default) | a visually hidden (or visible, Ariakit) `<input type="checkbox">` | free: the input *is* the form field |
| **ARIA control + hidden input** | Radix, Base UI, Headless UI, Reka, Bits | `<button role="checkbox">` (Radix, Reka, Bits) or `<span role="checkbox">` (Base UI, HUI) | a second, `aria-hidden` input mirrors the value |

### React Aria / React Aria Components

- Source: `packages/react-aria/src/checkbox/useCheckbox.ts`, `toggle/useToggle.ts`,
  `utils/useFormReset.ts`, `react-aria-components/src/Checkbox.tsx`.
- API: `<Checkbox>` renders a `<label>` wrapping a `VisuallyHidden` `<input type="checkbox">`
  and the consumer's children (render props: `isSelected`, `isIndeterminate`, `isFocusVisible`,
  `isPressed`, `isInvalid` …). Props `isSelected`/`defaultSelected`/`onChange`,
  `isIndeterminate`, `isReadOnly`, `isRequired`, `validationBehavior: "aria" | "native"`,
  `validate`, `name`, `value`, `form`.
- State: `useToggleState` (boolean). **Indeterminate is presentational**: `isIndeterminate`
  stays until the consumer clears it, the input's `indeterminate` property is re-applied
  after every render.
- Notable: the label gets its own `usePress`; its `onClick` is `preventDefault()`ed and the
  press toggles and focuses the input, so press state (`data-pressed`) also shows for label
  presses and the native label activation never double-toggles. `onMouseDown`
  `preventDefault` on the label so it does not steal focus. `useFormReset` restores
  `defaultSelected` on the form's `reset` event. Native vs ARIA validation is a prop.
- Problems: the hidden 1×1 input is what screen readers and test tools target — VoiceOver
  draws its focus box as a dot in the corner (RA#9687, open), Cypress cannot click it by role
  (RA#8755); label clicks focus the input with `:focus-visible` matching (RA#10299) or
  `isFocusVisible` true inside a `tabIndex` ancestor (RA#3675); Enter toggled through the
  label's press handler (RA#6398); hooks default to `validationBehavior: "aria"` so
  `isRequired` doesn't block submission (RA#7317).

### Base UI

- Source: `packages/react/src/checkbox/root/CheckboxRoot.tsx`, `indicator/CheckboxIndicator.tsx`,
  `utils/getCheckboxStateAttributesMapping.ts`, `packages/utils/src/visuallyHidden.ts`.
- API: `Checkbox.Root` (a `<span role="checkbox">`, or a native button with `nativeButton`),
  `Checkbox.Indicator`; props `checked`/`defaultChecked`/`onCheckedChange(checked, details)`,
  separate `indeterminate`, `readOnly`, `required`, `name`, `value`, `form`, `uncheckedValue`,
  `parent` (Checkbox Group), `inputRef`.
- State: `useControlled`. **The hidden input is the source of truth**: a click on the span
  is `preventDefault()`ed and re-dispatched to the input (`dispatchClickWithModifiers`), the
  input's native `change` drives `onCheckedChange` and the state. The input's `onClick` stops
  React propagation so ancestors see one click; its `onFocus` moves focus to the visible
  control (so `form.reportValidity()` focuses the right element).
- Notable: Enter performs the form's implicit submission by clicking the default submitter
  (`getDefaultFormSubmitter`) unless a consumer `preventDefault`s it during propagation;
  `uncheckedValue` renders an `<input type="hidden">` while unchecked; `visuallyHiddenInput`
  is `position: absolute` with no offsets (stays at its static position next to the
  control) and 1 px, so the validation bubble anchors near the control without inflating
  scroll areas; the input gets an id so Chrome does not warn (BU#2114); data attributes
  `data-checked`, `data-unchecked`, `data-indeterminate`, `data-readonly`, `data-required`,
  plus Field's `data-valid/invalid/touched/dirty/filled/focused`.
- Problems: a `span` is not labelable, so a wrapping `<label>` gave no name (BU#4122), and
  the fallback then doubled names with `aria-label` (BU#5786); Enter did not submit (BU#4677,
  BU#2117); unchecked submitted `"off"` against the HTML rule (BU#3239); stopPropagation in a
  consumer `onClick` did not stop the re-dispatched click (BU#5175); validation ran twice per
  click (BU#4902).

### Radix

- Source: `packages/react/checkbox/src/checkbox.tsx` (479 lines).
- API: `Checkbox.Root` (`<button type="button" role="checkbox">`), `Checkbox.Indicator`
  (mounted through `Presence` only while checked/indeterminate); `checked: boolean |
  "indeterminate"`, `defaultChecked`, `onCheckedChange`, `required`, `name`, `value = "on"`,
  `form`, `disabled`. Lower-level `Provider`/`Trigger`/`BubbleInput`.
- State: `useControllableState`; activation from indeterminate → `true`.
- Notable: Enter is `preventDefault()`ed ("checkboxes don't activate on enter"); a form
  `reset` listener restores the initial checked; the `BubbleInput` is rendered **only when
  the control is inside a form** (or has `form`), sized to the control and translated over it,
  sets `checked`/`indeterminate` through the native property setter and dispatches a
  synthetic `click` so React's `onChange` and form events see it; it tracks "user clicks" so
  a click the consumer stopped does not bubble twice (after #4028).
- Problems: the synthetic click reached ancestors as a second click or on programmatic
  updates (RX#3265, RX#2704, RX#667, RX#3192 infinite loop); the absolutely positioned,
  control-sized input inflated scroll areas and broke flex layouts (RX#3588, RX#2402,
  RX#867, RX#4041); Enter does not submit (RX#1595, closed as "not a bug" on the wrong
  premise); controlled updates dispatched change events (RX#4102 for Select, RX#2419 for
  Switch); `defaultChecked` of the hidden input followed `checked` (RX#2133) and then failed
  for `defaultChecked=true` after a React action (RX#4087, open); React 19 form actions reset
  the hidden input behind the component's back (RX#3444); `required` gave "An invalid form
  control is not focusable" (RX#649).

### Zag / Ark UI

- Source: `zag/packages/machines/checkbox/src/{checkbox.machine,checkbox.connect,checkbox.dom}.ts`,
  `zag/packages/utilities/dom-query/src/form.ts`; Ark
  `ark/packages/react/src/components/checkbox/*` (`Root`, `Label`, `Control`, `Indicator`,
  `HiddenInput`, `Group`).
- API: `Root` is a `<label>` (`htmlFor` = input id), `Control` is an `aria-hidden` `div`,
  `HiddenInput` is the real, visually hidden `<input type="checkbox">` and the focus target;
  `checked: boolean | "indeterminate"`, `onCheckedChange({ checked })`, `readOnly`, `invalid`,
  `required`, `name`, `value`, `form`. Ark adds `Checkbox.Group` (`value: string[]`).
- State: one `ready` state; `checked` is a bindable; `CHECKED.TOGGLE`/`CHECKED.SET` with an
  `isTrusted` guard — programmatic API changes dispatch a `click` on the input in a
  microtask, user changes don't (the native input already fired).
- Notable: `trackFormControl` = form `reset` listener + `MutationObserver` on the closest
  `<fieldset disabled>`; `trackPress` with `isValidKey: Space`; `data-state`,
  `data-focus-visible`, `data-active`, `data-hover`, `data-readonly`, `data-invalid` on every
  part; `setElementChecked` also writes the `checked` *attribute*, which is the input's
  default value (form reset target).
- Problems: the input did not start `indeterminate` (ZG#3402); triple `onChange` / toggled by
  double-click (ZG#625), a parent's `onClick` fired twice in controlled mode (ZG#633); the
  controlled vanilla adapter dropped `onCheckedChange` (ZG#3018) and React needed several
  clicks after an external change (ARK#2608); the label-wrapped hidden input is the only
  clickable thing, so `for`/`id` labels elsewhere failed (ZG#2244); page jumps when the
  off-screen input takes focus (ARK#3705); `aria-labelledby` to a missing label inside
  Field (ARK#3824); indeterminate behaved differently per framework (ARK#3174).

### Headless UI

- Source: `packages/@headlessui-react/src/components/checkbox/checkbox.tsx`,
  `internal/form-fields.tsx`.
- API: `<Checkbox>` (`<span role="checkbox" tabIndex=0>`), `checked`/`defaultChecked`/
  `onChange`, `indeterminate`, `name`, `value`, `form`, `disabled`; labelling through `Field`
  + `Label`.
- Notable: toggles on Space **keyup**, Enter calls `attemptSubmit` (implicit submission,
  HUI#2958); a `changing` flag for one frame so styles can skip transitions; hidden inputs
  are `<input type="hidden" hidden>` portalled into a `FormFieldsProvider` target (no layout
  impact, but also no native validation); form `reset` restores `defaultChecked`.
- Problems: Chrome warns that `<label for>` points at a non-labelable span (HUI#3876, open);
  uncontrolled `onChange` ran before the hidden input updated, so submitting from it sent the
  old value (HUI#3760); disabled checkbox was still tabbable (HUI#3212).

### Ariakit

- Source: `packages/ariakit-react-components/src/checkbox/{checkbox,checkbox-store,checkbox-check}.tsx`.
- API: `Checkbox` renders a **visible native** `<input type="checkbox">` by default (consumer
  styles it); with `render` it becomes `role="checkbox"` and Enter clicks it
  (`clickOnEnter: !nativeCheckbox`); `checked: boolean | "mixed"`; `CheckboxProvider`/store
  with `value: boolean | string | string[]` for groups; `CheckboxCheck` indicator.
- Problems: Firefox Space toggled twice (AK#368); swapping the rendered element at runtime
  kept stale props (`role`, `type`) because the tag was read once (AK#6336).

### Reka UI / Bits UI / Kobalte

- **Reka** (`packages/core/src/Checkbox/CheckboxRoot.vue`, `CheckboxGroupRoot.vue`):
  `<button role="checkbox">` + `VisuallyHiddenInput` sibling when it is a form control
  ("to avoid the nested-interactive violation"); `trueValue`/`falseValue`; group `max`
  (blocked items become `aria-disabled` but stay focusable). Problems: no `input` event like a
  native checkbox, so `@input` on a form never fired (RK#1209); hidden input invalid markup
  inside forms (RK#2384, open); hidden input showed no browser message (RK#1383); `aria-label`
  computed by `document.querySelector('[for=…]')` on every render (RK#2318).
- **Bits UI** (`lib/bits/checkbox/checkbox.svelte.ts`, `components/checkbox-input.svelte`):
  `<button role="checkbox">`, hidden input rendered only when `name` is set; Enter
  `preventDefault`ed (BITS#1894 asks for native implicit submission); separate
  `indeterminate` prop since the RFC BITS#885 ("no way to toggle into indeterminate").
  Problems: a click toggled twice (BITS#1670); label click stopped toggling (BITS#787);
  required had no native validation until a hidden input was added (BITS#444).
- **Kobalte** (`packages/core/src/checkbox/*`): React Aria port — `div` root, visually hidden
  `Input` is the focus target, `Control`, `Indicator`, `Label`, `Description`,
  `ErrorMessage`; presentational `indeterminate`. Problems: mousedown on the control blurred
  the input (KB#50, KB#230); focus ring after a click inside a Popover (KB#39); focusing the
  off-screen input scrolled `<html>` (KB#452).

## Accessibility

- **Which element is the checkbox.** The native-input family satisfies the first rule of
  ARIA, but the element AT and test tools interact with is a 1×1 clipped input: VoiceOver's
  cursor box is a dot in the corner (RA#9687), touch exploration and TalkBack activation hit a
  1 px target (TalkBack does not click visually hidden elements reliably, AT note §1.2 J,
  RA#3047), Playwright/Cypress clicks by role fail (RA#8755), and focusing it can scroll the
  page (ARK#3705, KB#452). The ARIA family exposes the element the user sees and touches.
  accessibility.md §10, testing.md (d) and the `hidden-content` spec already chose "the
  visible control is the accessible one; the native input is `aria-hidden`, `tabIndex=-1`".
  We keep that and make the control a **native `<button>`**, which is labelable (`<label for>`
  names it and forwards clicks, no JS, no Chrome warning — unlike Base UI's/HUI's span,
  BU#4122, HUI#3876), focusable, disabled by `<fieldset disabled>`, and keyboard-operable before
  hydration.
- **Name.** `<label for={controlId}>` when the control is labelable; `aria-labelledby` only
  when the control was substituted by a non-labelable element; a consumer `aria-label` is used
  as-is and never concatenated with a wrapping label (BU#5786). Never point
  `aria-labelledby` at an unrendered label (ARK#3824).
- **State.** `aria-checked` is always explicit (`"true" | "false" | "mixed"`). The hidden
  input mirrors checked/indeterminate as DOM properties, but it is `aria-hidden`, so AT never
  sees two checkboxes (the duplicated-role problem of hidden selects, testing.md "Reado" §2,
  and the unnamed-input problem, ARK#3792).
- **Keyboard.** Space only (press-interactions already makes role `checkbox` Space-only).
  Enter never toggles (RA#6398) and, inside a form, performs implicit submission like a
  native checkbox (HUI#2958, BU#4677, BU#2117, BITS#1894; RX#1595 closed it on the wrong
  premise).
- **AT quirks.** VO + Safari reads a native `indeterminate` input as unchecked (RA#4004,
  WebKit bug; also on MDN's example) — `aria-checked="mixed"` on our button is what VO reads,
  so the ARIA family avoids it. NVDA leaves focus mode on checkboxes inside grid cells
  (nvaccess/nvda#11413, AT note) — a collection concern, not standalone. Screen-reader
  activation is a bare `click` (AT note cause A): our press module turns it into one `PRESS`.
  The virtual cursor moving focus must not toggle (invariant `focus-does-not-commit`).
- **Focus ring.** Pointer and label presses never show `data-focus-visible` (RA#10299,
  RA#3675, KB#39); Safari does not focus a button on click — press interactions focus the
  control on press so `data-focus` and keyboard follow-up work (KB#230, KB#50).
- **Errors.** `aria-invalid` + error text through `aria-describedby` (AT note: no
  `aria-errormessage`). When native validation focuses the hidden input, focus is moved to
  the control with a visible ring so the user sees which field failed.
- **Forced colors.** The checkmark and dash must be real glyphs (`currentColor` SVG or text),
  never background images or colour-only fills; checked/mixed use `Highlight`/`HighlightText`
  (RA#4029). The control's border must survive forced colors (theme-accessibility spec).
- **Target size.** The theme's control is ≥ 24×24 CSS px or uses `--rind-hit-area`; the
  Label is part of the hit area, which is the usual way to meet 2.5.8.
- **Motion.** No JS motion; the theme's check animation uses duration tokens.
- **Native platform.** `<input type="checkbox">` is used only as the hidden form field
  (native-platform §14). `ElementInternals` is avoided (no custom element to attach to).

## Bug history

| Library | Issue | Symptom | Root cause | Fix / status | Lesson for rind-ui |
|---|---|---|---|---|---|
| Radix | [#3265](https://github.com/radix-ui/primitives/issues/3265), [#2704](https://github.com/radix-ui/primitives/issues/2704), [#667](https://github.com/radix-ui/primitives/issues/667) | A parent row's `onClick` fires on a controlled `checked` update, or twice per click; `stopPropagation` does not help | The bubble input dispatches a synthetic bubbling `click` | Closed; reworked several times (user-click tracking, #4028) | Never dispatch a synthetic `click`; ancestors see exactly the user's one click |
| Zag | [#633](https://github.com/chakra-ui/zag/issues/633) | Parent `onClick` twice in controlled mode | Same, `click` re-dispatched to the input | Fixed | Same |
| Base UI | [#5175](https://github.com/mui/base-ui/issues/5175) | Consumer `stopPropagation` in `onClick` ineffective | Click re-dispatched to the hidden input | Fixed (ported Radix's fix) | Same |
| Radix | [#4102](https://github.com/radix-ui/primitives/issues/4102), [#2419](https://github.com/radix-ui/primitives/issues/2419) | Form `change` fires on programmatic / initial values | Hidden input dispatches on every value change | Fixed for Checkbox (#4028), then Select | Only user-initiated changes dispatch events; programmatic ones are silent like native |
| Reka | [#1209](https://github.com/unovue/reka-ui/issues/1209) | `@input` on the form never fires for checkboxes | Hidden input dispatches only `click` | Closed as "same as Radix" | Dispatch `input` then `change`, the events a native checkbox fires |
| Headless UI | [#2958](https://github.com/tailwindlabs/headlessui/issues/2958) | Enter does not submit the form | Span control has no implicit submission | Fixed (`attemptSubmit`) | Enter performs implicit submission |
| Base UI | [#4677](https://github.com/mui/base-ui/issues/4677), [#2117](https://github.com/mui/base-ui/issues/2117) | Enter does not submit; Enter in a field checked the box | Missing implicit submission; label/Enter routing | Fixed (default submitter click) | Same; Enter never toggles |
| Radix | [#1595](https://github.com/radix-ui/primitives/issues/1595) | Enter on a focused checkbox does not submit | Enter `preventDefault`ed; closed "native doesn't do it" | Closed, not fixed | The premise was wrong — test against native in all engines |
| React Aria | [#6398](https://github.com/adobe/react-spectrum/issues/6398) | Enter toggles a RAC checkbox | The label's second `usePress` accepted Enter | Fixed | Keyboard rules per role in one place; the Label has no key handling |
| Bits UI | [#1670](https://github.com/huntabyte/bits-ui/issues/1670) | A mouse click unchecks and re-checks instantly | Double toggle (control + label/input path) | Fixed | Exactly one toggle per activation (virtual-parity invariant) |
| Ariakit | [#368](https://github.com/ariakit/ariakit/issues/368) | Firefox: Space checks and unchecks immediately | Keyboard handler + native click both toggled | Fixed | One activation source per key press |
| Zag | [#625](https://github.com/chakra-ui/zag/issues/625), [#515](https://github.com/chakra-ui/zag/issues/515) | Toggles only on double click; label stops working after an outside double click | Three `onChange`s per click; press state stuck | Fixed | Label and control share one press path, model-tested |
| Radix | [#512](https://github.com/radix-ui/primitives/issues/512) | Controlled checkbox in a plain `<label>` gets "stuck" | Control click handler raced the label's native activation | Fixed | Consumer-wrapping labels are a tested scenario |
| Bits UI | [#787](https://github.com/huntabyte/bits-ui/issues/787) | Clicking the label doesn't toggle | Label not associated with the control | Fixed | Label part wires `for` itself |
| Base UI | [#4122](https://github.com/mui/base-ui/issues/4122), [#5786](https://github.com/mui/base-ui/issues/5786) | No name inside a wrapping `<label>`; then name doubled with `aria-label` | `span` is not labelable; JS fallback ignored `aria-label` | Fixed | A native button gets the name natively; never synthesise a second name |
| Headless UI | [#3876](https://github.com/tailwindlabs/headlessui/issues/3876) | Chrome Issues: label `for` matches no labelable element | Control is a span | Open | Control is a native button |
| Ark | [#3824](https://github.com/chakra-ui/ark/issues/3824) | `aria-labelledby` points at a missing label | IDREF set unconditionally | Fixed | Relations only to rendered parts (react-adapter spec) |
| Radix | [#983](https://github.com/radix-ui/primitives/issues/983) | `form.reset()` doesn't uncheck | No `reset` listener | Fixed (Checkbox), Switch later (RX#3177) | Reset is a machine event for every form-associated control |
| Radix | [#3444](https://github.com/radix-ui/primitives/issues/3444), [#4087](https://github.com/radix-ui/primitives/issues/4087) | After a React 19 form action, FormData is empty while the box looks checked; `defaultChecked` re-render shows unchecked | React resets uncontrolled fields after an action; hidden input and component state diverge | #3444 closed, #4087 open | The form's `reset` event is the only signal; after any reset the input is re-synced from the machine |
| Radix | [#2133](https://github.com/radix-ui/primitives/issues/2133) | Hidden input's `defaultChecked` changes with `checked`, so "dirty" detection fails | `checked` attribute written on every change | Fixed | The `checked` content attribute is the reset default; only the property mirrors state |
| Radix | [#3588](https://github.com/radix-ui/primitives/issues/3588), [#2402](https://github.com/radix-ui/primitives/issues/2402), [#867](https://github.com/radix-ui/primitives/issues/867) | Page or scroll container gets huge / scrollbars appear; input misplaced in flex | Control-sized absolute input translated over the button | Closed (CSS workarounds) | 1 px absolute input with no offsets: no layout or scroll impact |
| Ark / Kobalte | [ARK#3705](https://github.com/chakra-ui/ark/issues/3705), [KB#452](https://github.com/kobaltedev/kobalte/issues/452) | Page jumps when checking inside a scroll area | The off-screen hidden input takes focus and is scrolled into view | Closed (add `position: relative`) | The hidden input never takes focus; its static position is next to the control |
| Radix | [#649](https://github.com/radix-ui/primitives/issues/649) | `required` submit: "An invalid form control with name='' is not focusable" | Hidden input not focusable for the validation UI | Fixed | Hidden input stays focusable by script (`tabIndex=-1`, not `display:none`) and forwards focus |
| Reka / Bits | [RK#1383](https://github.com/unovue/reka-ui/issues/1383), [BITS#444](https://github.com/huntabyte/bits-ui/issues/444) | No browser validation message for `required` | No (or `display:none`) native input | Fixed | Native constraint validation through the hidden input |
| React Aria | [#7317](https://github.com/adobe/react-spectrum/issues/7317) | `isRequired` doesn't block submission | Hook default `validationBehavior: "aria"` | Closed (documented) | `required` always means native constraint validation |
| Base UI | [#3239](https://github.com/mui/base-ui/issues/3239) | Unchecked box submits `"off"` | Opinionated companion value | Fixed (`uncheckedValue` opt-in) | Unchecked submits nothing unless `uncheckedValue` is set |
| Zag | [#3402](https://github.com/chakra-ui/zag/issues/3402) | Hidden input not `indeterminate` on first render | Property only set on change | Fixed | Mirror `indeterminate` from the first commit (it has no attribute) |
| Ark | [#3174](https://github.com/chakra-ui/ark/issues/3174) | Indeterminate can't be toggled in React, toggles in Vue | Per-framework interpreters | Fixed | One machine; indeterminate → checked |
| Ark / Zag | [ARK#2608](https://github.com/chakra-ui/ark/issues/2608), [ZG#3018](https://github.com/chakra-ui/zag/issues/3018) | Controlled checkbox stops calling `onCheckedChange` after an external change | Bindable compared against the internal value | Fixed | Controlled proposals compare against the resolved value (machine-runtime) |
| Headless UI | [#3760](https://github.com/tailwindlabs/headlessui/issues/3760) | `onChange` runs before the hidden input updates; `form.requestSubmit()` from it sends the old value | Callback before DOM sync | Fixed | The hidden input is synced before change callbacks observe the form |
| React Aria | [#9687](https://github.com/adobe/react-spectrum/issues/9687), [#8755](https://github.com/adobe/react-spectrum/issues/8755) | VO focus box is a dot; Cypress can't click the checkbox by role | Accessible element is a 1×1 hidden input | Open / closed | The visible control is the accessible element |
| React Aria / Kobalte | [RA#10299](https://github.com/adobe/react-spectrum/issues/10299), [RA#3675](https://github.com/adobe/react-spectrum/issues/3675), [KB#39](https://github.com/kobaltedev/kobalte/issues/39) | Focus ring after a mouse click on the label / inside a popover | Programmatic `focus()` of the input after a label press | Fixed / workaround | Label activation is classified `pointer`; no ring |
| Kobalte | [#230](https://github.com/kobaltedev/kobalte/issues/230), [#50](https://github.com/kobaltedev/kobalte/issues/50) | After a click the checkbox has no focus / loses `data-focus` | Mousedown blurred the input; Safari doesn't focus on click | Fixed | Press focuses the control in every engine |
| React Aria | [#4004](https://github.com/adobe/react-spectrum/issues/4004) | VO + Safari reads an indeterminate checkbox as unchecked | WebKit maps native `indeterminate` badly | Closed (browser bug) | `aria-checked="mixed"` on the exposed control |
| Ariakit | [#6336](https://github.com/ariakit/ariakit/issues/6336) | After swapping `render` between `<input>` and `<div>`, no role and no toggling | Rendered tag read once after mount | Fixed | Connect re-reads the rendered tag on every commit (`button-like-element`) |
| Base UI | [#2114](https://github.com/mui/base-ui/issues/2114) | Chrome warns the hidden input has no id or name | Unnamed input | Fixed | Hidden input always has an id |

## Known pitfalls

- **Synthetic events from the hidden input** are the single largest bug class (Radix, Zag,
  Base UI, Reka): `click` reaches ancestors, programmatic updates look like user changes, and
  frameworks disagree on which event they derive `onChange` from (React: `click` for
  checkboxes; Vue/vanilla/HTMX: `input`/`change`). We pick native semantics: user change →
  `input` + `change`; no `click`; programmatic → nothing.
- **Two sources of truth.** Base UI makes the input the truth, Radix/Zag mirror the
  component into it. Both broke when something else (React 19 action reset, browser form
  reset, bfcache restore) wrote the input. Ours: the machine is the truth, the input is
  re-synced from the snapshot after every commit and after every `reset`.
- **Label wiring** breaks four ways: not labelable (span), double toggle (label activation +
  handler), focus ring after a label click, and the hidden input becoming the label's target
  when it precedes the control. Rendering the hidden input *after* the control and relying on
  the native label → button activation, with the forwarded click classified as `pointer`,
  avoids all four.
- **Hidden input placement** must not affect layout or scrolling (Radix, Ark, Kobalte) yet
  must sit near the control for the validation bubble and focus scroll.
- **Enter**: Space-only toggling and implicit submission are both native; most libraries got
  one of them wrong at some point.
- **Indeterminate** as part of `checked` vs a separate prop: Radix/Zag/Ark/Reka use
  `boolean | "indeterminate"`; RA/Base/HUI/Bits/Kobalte a separate prop (Bits switched,
  BITS#885). See Decisions.

## Testing notes

- jsdom implements `indeterminate`, form `reset`, `requestSubmit` and constraint validation
  (`checkValidity`), but not the validation bubble or the focus it triggers on submit; the
  "invalid focuses the control" path is a browser-mode test (`form.requestSubmit()`).
- Label activation and implicit submission are browser behaviours: jsdom forwards label
  clicks (synthetic `click`), but implicit submission on Enter is not implemented in jsdom —
  that test runs in browser mode only.
- Event-parity check needs a listener on the hidden input counting `input`/`change` and a
  listener on an ancestor counting `click`.
- Playwright `getByRole("checkbox", { name })` must match exactly one element (the hidden
  input is `aria-hidden`): the generic "exactly one anchor" invariant covers it (ark#3792).
- Driver must expose: `toggle()`, `check()`, `uncheck()` (pointer, keyboard, virtual via
  pointer, touch), `clickLabel()` (pointer; no keyboard twin — keyboard users toggle the
  control), queries `checkedState()`, `isDisabled()`, `isReadOnly()`, `isRequired()`,
  `isInvalid()`, `description()`, `formValue()` (name, value, submitted or not — read from the
  hidden input's `checked` *property*).

## Decisions

### Parts

| Part | Element | Notes |
|---|---|---|
| `Root` | `div` | Provides the machine; state `data-*` for styling the row; renders `HiddenInput` as its last child automatically (Radix/Base: nobody forgets it; Ark's explicit part is often forgotten). |
| `Control` | `button` | `type="button"`, `role="checkbox"`, `aria-checked`; button-like element (`add-button`). |
| `Indicator` | `span` | `aria-hidden="true"`, always mounted, `data-state` (the theme or consumer shows a check or a dash); no presence dependency. |
| `Label` | `label` | `for` = Control id (`control-label`). |
| `Description` | `div` | `aria-describedby` from the Control only while rendered. |
| `HiddenInput` | `input type="checkbox"` | Rendered by Root, never by the consumer; `aria-hidden`, `tabIndex=-1`, input variant of visually hidden (`hidden-form-input`). |

Error message UI and validation display are Field's (Non-goal here); the Checkbox takes
`invalid` and `required` and wires `aria-invalid`/`aria-required`.

### Machine

```ts
type CheckedState = boolean | "indeterminate"
type CheckboxEvent =
  | { type: "TOGGLE"; modality: Modality }   // Control PRESS (and Label press when the control is not labelable)
  | { type: "RESET" }                        // hidden-form-input: the form's reset event
  | { type: "FOCUS"; modality: Modality } | { type: "BLUR" }
  | { type: "INPUT.SYNCED" }                 // hidden-form-input effect: user change dispatched
states: unchecked | checked | indeterminate  // bound to controllable("checked")
```

- `checked`/`defaultChecked`/`onCheckedChange(checked, details)` with `CheckedState`, bound to
  the states (machine-runtime controllables). One value, not two props: the state space is
  three states, and a separate `indeterminate` prop allows `checked=true + indeterminate`,
  which has no `aria-checked` value; Reado migrates from Ark, which uses the same union.
  BITS#885's complaint ("can't toggle into indeterminate") is answered by `onCheckedChange`
  never *producing* `"indeterminate"` from a user action — the type of the callback's value is
  `boolean`.
- `TOGGLE`: unchecked → checked, checked → unchecked, indeterminate → checked; guard
  `canToggle` (not disabled, not read-only). Action `recordUserChange` stores the proposed
  value in context (`pendingUserValue`) so the hidden input knows the next sync is a user
  change, also when a controlled parent applies it later; `$reverted` clears it.
- `RESET`: guarded transitions to the state of the default captured at creation (frozen like
  every controllable default; RX#4087 shows what "following" the default leads to).
- `FOCUS`/`BLUR` are internal transitions setting `focused`; connect derives
  `data-focus-visible` from the environment's modality.

### `data-*` attributes

- All parts: `data-scope="checkbox"`, `data-part`, `data-instance`.
- Root, Control, Indicator, Label: `data-state="checked|unchecked|indeterminate"`,
  `data-disabled`, `data-readonly`, `data-required`, `data-invalid`.
- Control (and mirrored on Root): `data-focus`, `data-focus-visible`; Control: `data-pressed`
  (press in progress), `data-hover`.
- HiddenInput: `data-part="hidden-input"` only.

### Contract

`locate: (name) => ({ role: "checkbox", name })`; actions `toggle`, `check`, `uncheck`
(pointer: click Control; keyboard: Space on Control; touch: tap; virtual derived),
`clickLabel` (pointer only, keyboard `none` with reason); queries listed in Testing notes;
`states: { unchecked: { checkedState: false }, checked: { checkedState: true },
indeterminate: { checkedState: "indeterminate" } }`; `events: { TOGGLE: "toggle", RESET:
"skip" (driver test with a reset button), FOCUS/BLUR: "skip" }`; traits `form-associated`.
Per-component invariants: `aria-checked` equals the state, Enter never changes it, the
Label's text is the accessible name when rendered.

### Shared capabilities introduced here

- `hidden-form-input` (`core/dom/hidden-input.ts`): used by Checkbox, Switch, Checkbox
  Group, later Radio Group, Select, Slider, Number Input… Mirrors value as properties,
  dispatches `input`+`change` for user changes only, form `reset` → `RESET`, focus/`invalid`
  forwarding, `uncheckedValue`, implicit submission helper, `form-associated` trait.
- `control-label` (`core/components/shared/control-label.ts`): Label and Description wiring
  for a labelable control; label activation counts as one pointer press.

### Deliberately different from the others, and why

1. **Native `<button role="checkbox">` as the control** — the visible element is the
   accessible one (RA#9687, RA#8755, TalkBack), and unlike a span it is labelable (BU#4122,
   HUI#3876) and fieldset-disableable.
2. **The machine is the source of truth** and the hidden input is re-synced after every
   commit and reset (RX#3444, RX#2133) — not Base UI's "input is the truth".
3. **Native event semantics**: `input` + `change` for user changes only, never `click`
   (RX#3265, RX#4102, RK#1209). React's synthetic `onChange` on an ancestor `<form>` therefore
   does not fire (React derives it from `click`); `onCheckedChange` or a native `change`
   listener does. Documented trade-off.
4. **Enter = implicit submission**, never toggle (HUI#2958, BU#4677, RA#6398).
5. **Hidden input always rendered** (not only inside a form, as Radix and Bits do) so SSR
   output, validation and `form` attribute work without a mount-time check.
6. **Model-tested event parity**: the `form-associated` invariant counts `change` events
   against user-initiated steps on every path — no library tests this.

## Open questions

- React users who rely on `<form onChange>` (synthetic) lose checkbox changes. If Reado or
  early adopters need it, the React adapter could add a framework-specific bridge; decide
  after migration feedback, not now.
- `uncheckedValue` for Switch and Checkbox Group children: shared behaviour, but should a
  group child ever submit an unchecked value? (checkbox-group note.)
- Field integration (validation display, `data-valid/invalid/touched/dirty`) waits for the
  Field change; Checkbox exposes `invalid` until then.
