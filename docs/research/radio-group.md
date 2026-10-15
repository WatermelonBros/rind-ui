# Radio Group — research

Status: done · Wave: 1

Builds on [collections.md](collections.md) (static item registration, roving focus, one
tab stop, disabled items, single selection), the Checkbox work (`add-checkbox`:
`hidden-form-input`, `control-label`), `add-button` (`button-like-element`) and the
cross-cutting notes [accessibility.md](accessibility.md),
[assistive-tech-and-a11y-testing.md](assistive-tech-and-a11y-testing.md) and
[native-platform.md](native-platform.md). [Segmented Control](segmented-control.md) reuses
this machine.

Sources read (local clones, 2026-10-14):

| Library | Files |
|---|---|
| Zag / Ark | `zag/packages/machines/radio-group/src/{radio-group.machine,radio-group.connect,radio-group.dom}.ts` |
| Radix (Reka, Bits) | `radix/packages/react/radio-group/src/{radio-group,radio}.tsx`; `bits-ui/src/lib/bits/radio-group/radio-group.svelte.ts`; `reka-ui/packages/core/src/RadioGroup/*` |
| React Aria (Kobalte) | `react-aria/src/radio/{useRadioGroup,useRadio}.ts`, `react-stately/src/radio/useRadioGroupState.ts` (`git show HEAD:`); `kobalte/packages/core/src/radio-group/*` |
| Base UI | `base-ui/packages/react/src/radio/root/RadioRoot.tsx`, `radio-group/RadioGroup.tsx` |
| Headless UI | `headlessui/packages/@headlessui-react/src/components/radio-group/radio-group.tsx` |
| Ariakit | `ariakit-react-components/src/radio/{radio,radio-group}.tsx` |

## Pattern

- WAI-ARIA APG: [Radio Group](https://www.w3.org/WAI/ARIA/apg/patterns/radio/) (and the
  "radio group contained in a toolbar" variant in the same page and the
  [Toolbar](https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/) example).
- Roles and attributes: `radiogroup` named by `aria-labelledby` (visible label) or
  `aria-label`; optional `aria-describedby`; `aria-required`, `aria-invalid`,
  `aria-readonly`, `aria-disabled` and `aria-orientation` are allowed on `radiogroup`
  (ARIA 1.2). Each `radio` has `aria-checked="true|false"` and a name (from content or
  `aria-labelledby`).
- Keyboard (standalone group):

  | Key | Behaviour |
  |---|---|
  | Tab / Shift+Tab | Into the group: the checked radio; none checked → the first radio. Out of the group |
  | Space | Check the focused radio if unchecked |
  | Right / Down | Focus **and check** the next radio, wrapping |
  | Left / Up | Focus **and check** the previous radio, wrapping |

  All four arrows work whatever the visual orientation. Inside a toolbar: arrows **only
  move** focus (no wrap at the ends), Space checks, Enter optionally checks — the group is
  part of the toolbar's single tab stop.
- Native `<input type="radio" name>`: the browser implements the same keyboard (arrows
  check; checked radio is the tab stop; with none checked Chrome/Firefox put Tab on the
  first and Shift+Tab on the last), `required`, form value, reset and fieldset disabling.

## How the others built it

| | Zag/Ark | Radix/Reka/Bits | React Aria/Kobalte | Base UI | Headless UI | Ariakit |
|---|---|---|---|---|---|---|
| Focusable element | visually hidden native `input[type=radio]` inside a `label` | `button[role=radio]` + "bubble" input | visually hidden native input inside `label` | `span[role=radio]` + hidden input | `div[role=radio]` + hidden inputs | native input (or `role=radio` element) |
| Arrow behaviour | the browser's | roving focus, then `click()` on focus if an arrow key is held | own handler, all four arrows, RTL for horizontal | composite; selects on focus after an arrow | own handler, all four | composite; click on focus after a keyboard `move` |
| Orientation | default vertical | `orientation` **restricts** arrows (RX#3622) | data only | data | — | — |
| No value: tab stop | first enabled input (`input:not(:disabled)`) | roving default | all radios tabbable until one is focused (native Shift+Tab-to-last, RA#4329) | first radio, not the checked one (BU#1740) | first option | first |
| Required | `required` on inputs, `aria-required` | late (RX#1413) | `aria-required` + native validation option | late (BU#2226) | — | native |
| Read-only | disables the inputs | — | `aria-readonly` | `readOnly` | — | — |
| Form reset | `trackFormControl` → default | — | `useFormReset` | yes | late (HUI#2851) | native |

### Zag.js / Ark UI

- Source: `radio-group.machine.ts` (one `idle` state; context `value`, `focusedValue`,
  `focusVisibleValue`, `hoveredValue`, `activeValue`, `indicatorRect`), `radio-group.connect.ts`.
- Notable: native inputs give keyboard, form and validity for free; `trackFormControl`
  handles fieldset disabling and form reset; a group `Indicator` (CSS variables from the
  checked item's offset rect) is what Ark's Segment Group renders.
- Problems: clicking the label focuses the hidden input, which scrolls the page
  ([ZG#3239](https://github.com/chakra-ui/zag/issues/3239), [ARK#1502](https://github.com/chakra-ui/ark/issues/1502));
  `data-focus-visible` lost while arrowing ([ZG#2629](https://github.com/chakra-ui/zag/issues/2629));
  `readOnly` still changed the value ([ZG#2675](https://github.com/chakra-ui/zag/issues/2675));
  hidden inputs not locatable by role and name ([ARK#3792](https://github.com/chakra-ui/ark/issues/3792)).

### Radix (and Reka UI, Bits UI)

- Source: `radio-group.tsx` on `RovingFocusGroup`; `radio.tsx` with a `BubbleInput`.
- Notable: Enter is prevented ("radio groups don't activate items on enter keypress");
  selection follows focus only when a document-level flag says an arrow key is down.
- Problems: the flag races the deferred focus move, so fast keys move focus without
  checking ([RX#4094](https://github.com/radix-ui/primitives/issues/4094), open); focusing an
  item programmatically checked it ([RX#938](https://github.com/radix-ui/primitives/issues/938));
  `orientation` disables two arrows, against APG ([RX#3622](https://github.com/radix-ui/primitives/issues/3622), open);
  button + input both exposed → "1 of 8" for four radios
  ([RX#1694](https://github.com/radix-ui/primitives/issues/1694)); input nested inside the
  button → axe "nested-interactive" ([RK#1597](https://github.com/unovue/reka-ui/issues/1597));
  Bits selected on pointer focus ([BITS#2097](https://github.com/huntabyte/bits-ui/issues/2097))
  and on dialog autofocus ([BITS#1198](https://github.com/huntabyte/bits-ui/issues/1198)).

### React Aria (and Kobalte)

- Source: `useRadioGroup` (arrow handler with a tree walker over radio inputs, all four
  arrows, horizontal arrows flipped in RTL unless vertical), `useRadio` (native input,
  label press, `useFormReset`, `useFormValidation`).
- Notable: the native-input approach done carefully; group-level `aria-required`,
  `aria-invalid`, `aria-readonly`; validation behaviour `aria` vs `native`.
- Problems: AT support for read-only and invalid radios is poor (RA#2581, RA#2580, open);
  VoiceOver iOS says "invalid data" on every radio of a required group before any
  interaction (RA#9809, open); the VoiceOver focus ring lands on the tiny hidden input
  (RA#9687, open); arrows walked into non-radio focusables inside the group (RA#2379,
  RA#3447, RA#6496); form `onChange` not bubbling (RA#3799, open).

### Base UI

- Source: `RadioRoot.tsx` (`span[role=radio]`, hidden input beside it, `name` only on the
  input), `RadioGroup.tsx` (composite).
- Problems: first radio rather than the checked one is the tab stop (BU#1740); a disabled
  group still takes focus (BU#4174, open); an ignored arrow arms "select the next radio
  that takes focus" (BU#5626); Space did nothing (BU#5042); SSR markup unlabelled and with
  no tab stop (BU#5597, open); no `name` without a value (BU#3338) vs native "no entry"
  (BU#2447); a wrapping `<label>` does not name a `span` control (BU#4122); `left: 0`
  visually-hidden input overflows in RTL (BU#5635).

### Headless UI

- Source: `radio-group.tsx` (`div[role=radio]`, `FormFields` hidden inputs).
- Problems: unreachable when nothing is checked (HUI#378); Enter does not submit the
  form as a native radio would (HUI#394); form reset ignored (HUI#2851); disabled fieldset
  ignored (HUI#1802).

### Ariakit

- Source: `radio.tsx` — native input by default; a non-native element gets `role=radio`;
  on focus after a keyboard `move` it replays a real `click()` so React sees a change
  event (AK#6345); unique default `name` per store (AK#3833: radios in two groups
  otherwise formed one browser group).
- Problems: infinite dialog loop when `change` opens an alert during arrow navigation
  (AK#3771); custom elements did not check on arrows (AK#1761).

## Accessibility

Applies [accessibility.md](accessibility.md) §2 (group labelling), §4, §5, §6, §8, §10
and the AT note's causes A, C, J, K.

- **Arrow keys select; focus does not** (cause C, invariant 13). Checking is the
  consequence of a keyboard `NAVIGATE`; a `focus` with no key — screen-reader cursor,
  programmatic focus, dialog autofocus, pointer focus — changes nothing (RX#938,
  BITS#1198, BITS#2097, BU#5626). Doing it in the machine on the logical move removes
  the document-flag race (RX#4094).
- **All four arrows**, always (APG, RX#3622); horizontal arrows mirrored in RTL; Home/End
  are not part of the pattern and are not bound (native radios ignore them).
- **Wrap always** (APG and native); no `loop` option.
- **Space checks, Enter does not** (Radix, APG); the control follows
  `button-like-element`'s per-role activation (radio: Space only). Enter performs the
  form's implicit submission, as a native radio does (`hidden-form-input`, HUI#394).
- **One tab stop**: the checked enabled radio, else the first enabled radio (APG,
  HUI#378, BU#1740, BITS#1568). With no enabled radio the collections fallback applies:
  the `radiogroup` itself is the stop and carries `aria-disabled`. Native disabled radios
  are not focusable (BU#4174); we keep the group discoverable (APG "focusability of
  disabled controls" for composites, Base UI's answer in BU#4174) and consistent with
  every other composite and the `composite-roving` invariant.
- **Names**: the group is named by the Label part (`aria-labelledby`; `span`, since
  `radiogroup` is not labelable — RA). Each control is named by its item label
  (`control-label`), never by its value (RK#2860).
- **No duplicate exposure** of the hidden input (RX#1694, RK#1597): it is a sibling of
  the control, `aria-hidden`, `tabIndex=-1`, never focused by us, and only form
  validation may target it (then focus is forwarded to the control — BITS#1727).
- **Required / invalid / read-only**: `aria-required`, `aria-invalid` (+ ErrorMessage in
  `aria-describedby`) and `aria-readonly` on the `radiogroup`; known AT gaps (RA#2580,
  RA#2581, RA#9809) go to the manual protocol; `aria-invalid` only when the consumer says
  so, never from `required` alone.
- **No deselect**: a checked radio stays checked when pressed again (native; RA#4971,
  RX#1336 asked and were declined). Clearing is a programmatic action.
- **Inside a toolbar**: APG move-only behaviour. Out of scope until `add-toolbar`; the
  machine keeps "check on arrow" behind one guard so Toolbar can switch it (RX#2146,
  Kobalte#579).
- **Forced colors** (cause K, RX#2993, RA#4151): the indicator dot is `currentColor` /
  `Highlight`, the ring a border — never a background-only state.
- **Target size**: the clickable item (label + control) at least 24×24 CSS px.
- **Native platform**: native radios were weighed (they give keyboard, validity, reset
  and autofill). We follow Checkbox/Switch instead (button control + `hidden-form-input`)
  because the native path's real bugs are about the hidden input being the focused
  element: scroll jumps (ZG#3239, ARK#1502, BITS#1987), the VO focus ring on a 1px input
  (RA#9687), role/name locating (ARK#3792), Safari focus quirks (Zag's `isSafari()` focus
  calls). Keyboard is ours anyway (four arrows, RTL, no-focus-commit). Constraint
  validation still comes from real `input[type=radio][required]` elements sharing a name.

## Bug history

Method: `gh search issues` on the ten repositories with "radio in:title", "radiogroup",
"radio group form", "radio required", "radio arrow", "radio disabled", "radio focus",
"radio screen reader", "radio controlled value" (Radix 7 × 40; the others 2 × 100).
About 260 hits, 75 relevant, 50 read.

| Library | Issue | Symptom | Root cause | Fix / status | Lesson for rind-ui |
|---|---|---|---|---|---|
| Radix | [#938](https://github.com/radix-ui/primitives/issues/938) closed | Programmatic focus checks the radio | Selection on `focus` | Fixed: only after arrow keys | Only keyboard `NAVIGATE` checks; scenario |
| Bits | [#1198](https://github.com/huntabyte/bits-ui/issues/1198), [#924](https://github.com/huntabyte/bits-ui/issues/924) closed | Dialog autofocus / tabbing in selects the first radio | Same | Fixed | Same; tab-in never checks |
| Bits | [#2097](https://github.com/huntabyte/bits-ui/issues/2097) closed | Pointer *down* already selects | Select-on-focus fired for pointer focus | Fixed | Pointer selects on `PRESS` (release) only |
| Base UI | [#5626](https://github.com/mui/base-ui/issues/5626) closed | An ignored arrow (with a modifier) makes the next focused radio selected | "Arm on keydown, select on focus" flag | Fixed | Selection is part of the move itself, no flags |
| Radix | [#4094](https://github.com/radix-ui/primitives/issues/4094) open | Fast arrows move focus without checking | Flag cleared on keyup before deferred focus | Open | Same; synchronous move + check |
| Radix | [#3622](https://github.com/radix-ui/primitives/issues/3622) open | `orientation` disables Up/Down or Left/Right | Roving group restricts arrows | Open | All four arrows; orientation is data only |
| Radix | [#1694](https://github.com/radix-ui/primitives/issues/1694) closed | VoiceOver: "1 of 8" for 4 radios | Button and bubble input both exposed | Fixed | Hidden input `aria-hidden`, out of the tab order; scenario |
| Reka | [#1597](https://github.com/unovue/reka-ui/issues/1597) open | axe: nested interactive controls | Input rendered inside the button | Open | Hidden input is a sibling of the control |
| Headless UI / Base UI / Bits | [HUI#378](https://github.com/tailwindlabs/headlessui/issues/378), [BU#1740](https://github.com/mui/base-ui/issues/1740), [BITS#1568](https://github.com/huntabyte/bits-ui/issues/1568) | Unreachable with nothing checked / wrong tab stop / disabled+selected unreachable | Tab stop rule | Fixed | Collections tab-stop rule; scenarios |
| Base UI | [#4174](https://github.com/mui/base-ui/issues/4174) open | Disabled group still focusable | Composite focusable-when-disabled default | Open (maintainer: discoverability) | Disabled group = one stop on the root with `aria-disabled`; radios never focusable |
| Base UI | [#5597](https://github.com/mui/base-ui/issues/5597) open | SSR HTML: group unlabelled, every radio `tabindex=-1` | Label and roving index resolved in layout effects | Open | Ids and the tab stop are derived during render (SSR scenario) |
| Base UI | [#5042](https://github.com/mui/base-ui/issues/5042) closed | Space does not check | Keyboard path missing for non-native control | Fixed | Space via press, per role |
| Radix / Base UI | [RX#1413](https://github.com/radix-ui/primitives/issues/1413), [BU#2226](https://github.com/mui/base-ui/issues/2226) closed | `required` not exposed | Only on the hidden input / missing | Fixed | `aria-required` on the group + `required` on hidden inputs |
| Bits | [#1727](https://github.com/huntabyte/bits-ui/issues/1727) closed | Invalid submit warns "aria-hidden element retained focus" | Browser focuses the hidden required input | Fixed | `invalid` on a hidden input forwards focus to the control (`hidden-form-input`) |
| Base UI | [#2447](https://github.com/mui/base-ui/issues/2447), [#3338](https://github.com/mui/base-ui/issues/3338) | Empty submission differs from native (`""` vs no entry; no `name`) | One hidden input with an empty value | Fixed / open | One hidden radio per item sharing `name`: native form data |
| Headless UI / Bits | [HUI#2851](https://github.com/tailwindlabs/headlessui/issues/2851), [BITS#1942](https://github.com/huntabyte/bits-ui/issues/1942) | Form reset ignored | No `reset` listener | HUI fixed; Bits open | Reset returns to `defaultValue` |
| Headless UI | [#1802](https://github.com/tailwindlabs/headlessui/issues/1802) closed | Not disabled inside a disabled `fieldset` | Ancestor fieldset not tracked | Fixed | Fieldset disabling applies |
| Ariakit | [#3833](https://github.com/ariakit/ariakit/issues/3833) (in source) | Two groups behave as one | Same default `name` | Unique default | Default name derived from the root id |
| Zag / Ark / Bits | [ZG#3239](https://github.com/chakra-ui/zag/issues/3239), [ARK#1502](https://github.com/chakra-ui/ark/issues/1502), [BITS#1987](https://github.com/huntabyte/bits-ui/issues/1987) | Clicking an item scrolls the page | Hidden input receives focus | `preventScroll` / fixes | The hidden input never takes focus |
| React Aria | [#9687](https://github.com/adobe/react-spectrum/issues/9687) open | VoiceOver focus ring drawn on a 1px corner | Focused element is the hidden input | Open | The visible control is the focused element |
| Ark | [#3792](https://github.com/chakra-ui/ark/issues/3792) closed | Playwright cannot find a radio by role and name | Hidden input unnamed | Fixed | Control has role `radio` and a name; drivers locate it |
| Zag | [#2675](https://github.com/chakra-ui/zag/issues/2675) closed; RA [#9425](https://github.com/adobe/react-spectrum/issues/9425) open | Read-only group still changes / fires press | Native radios have no `readOnly` | Disable inputs | Read-only: focus moves, nothing checks |
| React Aria | [#2581](https://github.com/adobe/react-spectrum/issues/2581), [#2580](https://github.com/adobe/react-spectrum/issues/2580) open | Read-only / invalid radios not announced (VO, NVDA, TalkBack) | AT support | Open | `aria-*` on the group; manual-protocol entries |
| React Aria | [#9809](https://github.com/adobe/react-spectrum/issues/9809) open | VO iOS: "invalid data" on each radio before interaction | Native `required` invalid until checked | Open | `aria-invalid` only when the consumer marks it; `required` validity via hidden inputs |
| React Aria | [#2379](https://github.com/adobe/react-spectrum/issues/2379), [#3447](https://github.com/adobe/react-spectrum/issues/3447), [#6496](https://github.com/adobe/react-spectrum/issues/6496) closed | Arrows jump to other focusables inside the group | DOM tree walker | Fixed | Navigation over registered radios only |
| Reka | [#2860](https://github.com/unovue/reka-ui/issues/2860) closed | `aria-label` falls back to the value | Fallback name | Fixed | Name only from the label part or consumer props |
| Zag | [#2629](https://github.com/chakra-ui/zag/issues/2629) closed | No `data-focus-visible` when arrowing | Focus-visible computed once on entry | Fixed | Connect computes it per focused item (modality) |
| React Aria / Radix | [RA#4971](https://github.com/adobe/react-spectrum/issues/4971), [RX#1336](https://github.com/radix-ui/primitives/issues/1336) closed | Requests to uncheck by clicking again | Native semantics forbid | Declined | No deselect; clearing is programmatic |
| Radix / Kobalte | [RX#2146](https://github.com/radix-ui/primitives/issues/2146), [KB#579](https://github.com/kobaltedev/kobalte/issues/579) | Want "move without selecting" (toolbar) | APG toolbar variant | Declined / open | Toolbar change switches one guard |
| Radix / React Aria | [RX#2993](https://github.com/radix-ui/primitives/issues/2993), [RA#4151](https://github.com/adobe/react-spectrum/issues/4151) closed | Radios invisible in forced colors | Background-only styling | Docs / fixed | Theme: `ButtonText` ring, `Highlight` dot |
| Headless UI | [#394](https://github.com/tailwindlabs/headlessui/issues/394) closed | Enter does not submit the form (native does) | Non-native control | Documented | Enter = implicit submission (`hidden-form-input`), never a check |
| Base UI | [#5635](https://github.com/mui/base-ui/issues/5635) closed | Hidden input overflows the document in RTL | Physical `left: 0` | Logical props | `hidden-form-input` uses the visually-hidden input variant; RTL scenario |

## Known pitfalls

1. Selecting on `focus` (Radix, Bits, Base UI) instead of on the keyboard move.
2. Hidden input exposed, nested inside the control, or focused (count doubling, axe,
   scroll jumps, VO ring).
3. Tab stop with nothing checked / disabled checked / disabled group.
4. `orientation` that disables arrows.
5. Form parity: empty submission, `required`, reset, fieldset.
6. Read-only and invalid states with poor AT support.

## Testing notes

- Driver: `check(name)` (pointer: press; keyboard: arrows until checked; virtual: bare
  click), `focusRadio(name)` is not offered (arrows check by design); queries
  `radios()`, `checked()`, `focusedRadio()`, `isDisabled(name)`, `isRequired()`,
  `isInvalid()`, `isReadOnly()`, `formValue()` (via `FormData` of the owning form).
- Argument classes: no value, first disabled, checked disabled, all disabled, read-only,
  required, RTL horizontal.
- jsdom: form submission and constraint validation work on hidden inputs; arrows are ours
  (RA#7358 showed happy-dom's native radio keyboard gaps — we do not depend on them).

## Decisions

- **Parts**: `Root` (`div[role=radiogroup]`), `Label` (`span`), `Description`,
  `ErrorMessage`; `Item` (wrapper `div`, renders the hidden radio input last), `ItemControl`
  (`button[role=radio]` via `button-like-element`), `ItemIndicator` (decorative, mounted
  when checked), `ItemLabel`, `ItemDescription` (wired by `control-label`).
- **Machine**: states `idle` / `focused`; events `NAVIGATE` (checks, unless read-only),
  `PRESS` (checks), `FOCUS` / `BLUR` (highlight only), `COLLECTION.CHANGE`, `RESET`
  (form), `$sync` / `$reverted`. Controllable `value: string | null`; `selectionMode:
  "single"`, never deselects by user action.
- **Props**: `value`, `defaultValue`, `onValueChange`, `name`, `form`, `required`,
  `disabled`, `readOnly`, `invalid`, `orientation` (data only, default `vertical`).
- **`data-*`**: root `data-orientation`, `data-disabled`, `data-readonly`,
  `data-required`, `data-invalid`; item, control, indicator, label `data-key`,
  `data-state="checked|unchecked"`, `data-disabled`, `data-readonly`, `data-invalid`,
  `data-highlighted`, `data-focus`, `data-focus-visible`, `data-pressed`, `data-hover`.
- **Contract**: anchor `radiogroup` by name; actions `check`; queries above; traits
  `composite-roving`, `selectable` (`aria-checked`), `directional`; no part commits on
  focus.
- **Deliberately different**: button control + `hidden-form-input` (vs native inputs in
  Zag/RA/Ariakit), selection on the logical move
  (no keydown flags), `orientation` never restricts arrows.

## Open questions

- Radio group inside Toolbar: specified with `add-toolbar`.
