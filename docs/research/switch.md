# Switch — research

Status: done · Wave: 1

Switch is a two-state on/off control. It shares almost everything with
[Checkbox](checkbox.md): the hidden form input (`hidden-form-input`) and label wiring
(`control-label`) are specified once in `add-checkbox`; the control element rules
(`button-like-element`) once in `add-button`. This note covers what is specific to the
switch pattern and records the decisions `add-switch` builds on.

## Pattern

- WAI-ARIA APG: [Switch](https://www.w3.org/WAI/ARIA/apg/patterns/switch/) (examples:
  `div[role=switch]`, `button[role=switch]`, `input[type=checkbox][role=switch]`).
- Roles and attributes: `role="switch"`; `aria-checked="true" | "false"` (no `mixed`:
  ARIA 1.2 defines switch's `aria-checked` as boolean only, a `mixed` value is treated as
  `false`); accessible name from visible label (`aria-labelledby` or native `<label>`);
  optional `aria-describedby`; `aria-readonly` is allowed on `switch` (ARIA 1.2);
  `aria-required` / `aria-invalid` for form use. Thumb and track are decoration
  (`aria-hidden`).
- Keyboard: **Space** toggles (required). **Enter** toggles (optional in APG). Tab moves
  focus to/away. APG also says the **label must not change** when the state changes
  ("Mute" must not become "Unmute") — state is in `aria-checked`, the name stays.
- APG guidance on choice of widget: a switch means "on/off, takes effect immediately"
  (a setting); a checkbox means "selected or not", often submitted later and may be
  mixed; a toggle button (`aria-pressed`) means "this action is active" (Bold, Mute) and
  its name is a verb/command. rind-ui documents this table on all three docs pages.

## How the others built it

### Radix

- Source: `radix/packages/react/switch/src/switch.tsx` (445 lines).
- API: `Switch.Root` (a `button role="switch"`) + `Switch.Thumb` (`span`); since 1.5
  also `Provider`/`Trigger`/`BubbleInput` parts. `checked`/`defaultChecked`/
  `onCheckedChange(boolean)`, `name`, `value` (default `"on"`), `form`, `required`,
  `disabled`.
- State: `useControllableState`; `data-state="checked|unchecked"`, `data-disabled`.
- Form: `BubbleInput` (`input type=checkbox aria-hidden tabIndex=-1`) rendered after the
  button only when inside a form, absolutely positioned over the button with
  `translateX(-100%)`; it sets `checked` through the native setter and dispatches a
  `click` so React's `onChange` fires; form `reset` listener restores the initial value.
- Keyboard: native `button` — **Enter and Space both toggle**.
- Problems: the bubble input's layout trick inflates scroll areas and breaks in RTL
  (#3588, #4041, #3235, #867); reset not supported before #3177; a change event on the
  form for an initial `checked` (#2419); `flushSync` warning when the bubble input mounts
  during a dismissing popover (#4121); repeated requests for a `mixed` switch (#2896,
  declined).

### Base UI

- Source: `base-ui/packages/react/src/switch/root/SwitchRoot.tsx`, `thumb/SwitchThumb.tsx`.
- API: `Switch.Root` (`span role="switch"`, or native button with `nativeButton`) +
  `Switch.Thumb`. Props add `readOnly`, `uncheckedValue`, `inputRef`, Field integration.
- The hidden `input type=checkbox` is the **source of truth**: a click on the root calls
  `preventDefault` and re-dispatches a click with modifiers on the input; the input's
  `onChange` drives `onCheckedChange(checked, details)` with `cancel()`. The input
  redirects its own `focus` to the root (native validation focus), stops its click from
  reaching ancestors, and gets `id` so a `<label for>` works when the root is a `span`.
  `uncheckedValue` renders an `<input type=hidden>` while unchecked.
- `data-checked` / `data-unchecked`, `data-disabled`, `data-readonly`, `data-required`,
  Field states (`data-valid`, `data-touched`, `data-dirty`, `data-filled`, `data-focused`).
- Keyboard: `useButton` with a non-native element — Enter and Space both click.
- Problems: a `span` is not labelable, so a wrapping `<label>` gave no name (#4122,
  fixed by `aria-labelledby`); two hidden inputs and `name` on the button (#2762);
  validation ran twice per interaction (#4902); Firefox focus-ring after pointer focus
  (#5130, browser behaviour); `focusableWhenDisabled` requested (#5139, open).

### React Aria / RAC

- Source: `react-aria/src/switch/useSwitch.ts`, `toggle/useToggle.ts`,
  `react-aria-components/src/Switch.tsx` (via `git show HEAD:`).
- A real `<input type="checkbox" role="switch">`, visually hidden inside a `<label>`;
  the visible track/thumb are children rendered with state. `useToggle` handles label
  press separately (`preventDefault` on the label click, toggle in `onPress`, focus the
  input) so label clicks toggle once and show press state. `useFormReset`,
  `useFormValidation`; `data-selected`, `data-pressed`, `data-hovered`, `data-focused`,
  `data-focus-visible`, `data-disabled`, `data-readonly`.
- Keyboard: native checkbox — **Space only**; Enter performs the form's implicit
  submission.
- Problems: ChromeVox does not announce the new value after a mouse click (#5791 — the
  APG example fails the same way, AT-side); hidden input `checked` attribute looked
  stale to consumers inspecting the DOM (#5844: the attribute is the default, the
  property is live); tooltip on a switch (#7768, open).

### Zag / Ark UI

- Source: `zag/packages/machines/switch/src/{switch.machine,switch.connect,switch.anatomy}.ts`.
- Anatomy `root` (`label`), `label`, `control` (`aria-hidden`), `thumb` (`aria-hidden`),
  plus hidden input. The visually hidden `input type=checkbox` is the focusable element
  (`aria-labelledby` → label); `trackPress` with `isValidKey: key === " "`;
  `trackFormControl` (form reset + `fieldset[disabled]` via MutationObserver);
  programmatic changes dispatch a `click` on the input in a microtask.
- Keyboard: **Space only**; Enter is "reserved for form submission" (ark#2946).
- Problems: parent `onClick` fired twice in controlled mode (zag#633); first click
  ignored in Firefox on first load (zag#2491); controlled vanilla switch never fired
  `onChange` (zag#3018); `aria-labelledby` pointing at a missing label inside Field
  (ark#3824); `data-focus-visible` missing when it is the first element in a dialog
  (zag#2763); forced colors: invisible in Firefox high contrast (ark#3421).

### Headless UI

- Source: `headlessui/packages/@headlessui-react/src/components/switch/switch.tsx`.
- `Switch` renders `button role="switch" tabIndex=0`, `Switch.Group` + `Switch.Label`
  (label click calls `switch.click()` + `focus()` and `preventDefault`s the native
  forwarding), `Switch.Description`. Form: `FormFields` hoists `<input type=hidden>`
  (no native validation), `onReset`.
- Keyboard: Space on keyup toggles; **Enter calls `attemptSubmit`** (implicit
  submission); `keypress` prevented so Enter never clicks.
- Problems: `onChange` ran before the hidden input updated (#3760); consumers expected
  `type="submit"` to submit (#2935, #3343); Safari ⌘N blocked after clicking (#3291,
  gone in later Safari); cannot stop propagation (#2970); click inside a PopoverPanel
  closed it (#3188).

### Reka UI / Bits UI / Kobalte

- Reka `Switch/SwitchRoot.vue`: `button role=switch`, `@keydown.enter.prevent` toggles,
  `VisuallyHiddenInput`; Enter toggles. Bits `bits/switch/switch.svelte.ts`: button,
  Enter and Space toggle; hidden input was tabbable (bits#1238); a rewrite toggled on
  pointerdown and broke wrapping labels (bits#789 — activation must be on release).
  Kobalte `switch/switch-input.tsx`: visually hidden `input role=switch` like RA, Space
  only; focus did not stay after clicking (kobalte#230).

### Ariakit

No Switch. The agreed design in ariakit#4323 (open) is a native checkbox with
`role="switch"` that owns focus and forms, inside a visible `span`. Today users render
`Checkbox` with `role="switch"`.

## Accessibility

- **Roles/AT support.** `role=switch` is spoken as "switch, on/off" by current tier-1 AT
  (VO macOS/iOS, NVDA, JAWS, TalkBack). Older NVDA/JAWS and Narrator fell back to
  "toggle button pressed" or "checkbox checked" — acceptable degradations because
  `aria-checked` still carries the state. ChromeVox misses mouse-driven changes (RA#5791,
  same on the APG example). The manual protocol (AT note §2.8) checks the role and state
  wording per AT and records the versions.
- **Name.** From `Label` via native `<label for>` on the `button` (labelable), never
  `aria-label` replacing a visible label (2.5.3). The name must be identical in both
  states (APG) — a per-component invariant.
- **Keyboard.** Space toggles on keyup (press semantics, one toggle per press, repeats
  ignored). Enter does **not** toggle; inside a form it performs implicit submission —
  the same as a native `<input type=checkbox switch>`, a native checkbox, RA, Zag/Ark,
  Kobalte and Headless UI, and the same rule `add-checkbox` gives the Checkbox Control.
  Radix, Base UI, Reka and Bits toggle on Enter; we choose native parity because a
  Switch inside a settings form must not swallow Enter-to-submit.
- **Announcements.** None of our own. The state change is spoken by AT from
  `aria-checked` on the focused control; no live region.
- **Focus.** `data-focus-visible` only after keyboard/virtual focus (rule 12); label
  click toggles without a ring.
- **Forced colors.** The thumb disappears when it is a background colour (ARK#3421,
  RX#2993-class). Theme: track gets a 1 px `CanvasText` border, the thumb is drawn with
  `forced-color-adjust: auto` and a `ButtonText` background on `[data-state=checked]`
  plus a position change — two non-colour cues (position and border).
- **Target size.** Theme track ≥ 24×24 CSS px (2.5.8).
- **RTL.** The thumb moves to the inline end when checked: theme uses logical
  properties (`inset-inline-start`, `translate` computed with `--rind-dir` sign) so the
  `checked` thumb sits on the left in RTL. No behaviour changes with direction (no arrow
  keys).
- **Native primitive.** `<input type=checkbox switch>` ships only in Safari 17.4+
  (native-platform §8): unusable as the control; we do not emit the `switch` attribute
  on the hidden input either (it would render nothing and only Safari knows it).

## Bug history

| Library | Issue | Symptom | Root cause | Fix / status | Lesson for rind-ui |
|---|---|---|---|---|---|
| Radix | [#3588](https://github.com/radix-ui/primitives/issues/3588) | Page scroll area grows huge in a form | Bubble input absolutely positioned at the button's size | closed | Hidden input uses the visually-hidden input variant: no layout impact (`hidden-form-input`) |
| Radix | [#4041](https://github.com/radix-ui/primitives/issues/4041) | Scroll area inflated in RTL containers | `translateX(-100%)` shifts the input outside in RTL | closed (parts exposed in 1.5) | Same; scenario under `dir="rtl"` |
| Radix | [#3235](https://github.com/radix-ui/primitives/issues/3235), [#867](https://github.com/radix-ui/primitives/issues/867) | Hidden input not over the button / wrong in flex | Positioning trick depends on layout | closed | Never position the hidden input relative to the control |
| Radix | [#3177](https://github.com/radix-ui/primitives/issues/3177) | Switch does not reset on `form.reset()` | No reset listener | fixed | `RESET` event from `hidden-form-input` |
| Radix | [#2419](https://github.com/radix-ui/primitives/issues/2419) | Initial `checked` fires a form `change` | Bubble input dispatches on every value change | closed | Programmatic/initial values are silent |
| Radix | [#2896](https://github.com/radix-ui/primitives/issues/2896) | Request: indeterminate switch | — | declined | Boolean only; use Checkbox for mixed |
| Radix | [#4121](https://github.com/radix-ui/primitives/issues/4121) | `flushSync` warning when the bubble input mounts inside a dismissing popover | Input mounted lazily on form detection | fixed | Hidden input always rendered, no mount-time detection |
| Base UI | [#4122](https://github.com/mui/base-ui/issues/4122) | No accessible name from a wrapping `<label>` | `span` control is not labelable; input is `aria-hidden` | fixed (aria-labelledby) | Default control is a native `button` (labelable); substituted non-labelable control falls back to `aria-labelledby` (`control-label`) |
| Base UI | [#2762](https://github.com/mui/base-ui/issues/2762) | Two hidden inputs, `name` on the button | `name` forwarded to both | fixed | `name` only on the hidden input; exactly one form entry |
| Base UI | [#4902](https://github.com/mui/base-ui/issues/4902) | Validation runs twice per toggle | Change handled on control and input | fixed | One `TOGGLE` per activation (virtual-parity invariant) |
| Base UI | [#5130](https://github.com/mui/base-ui/issues/5130) | No focus ring in Firefox after pointer focus + keyboard toggle | Firefox `:focus-visible` heuristic | closed (browser) | `data-focus-visible` from our modality tracker, not `:focus-visible` |
| Base UI | [#5139](https://github.com/mui/base-ui/issues/5139) | Disabled switch not discoverable | No `focusableWhenDisabled` | open | Supported via `button-like-element` |
| Zag/Ark | [ark#2946](https://github.com/chakra-ui/ark/issues/2946) | Enter does not toggle (docs said it does) | Switch built on checkbox; Enter reserved for submit | by design | Decide explicitly: Enter submits, documented |
| Zag | [#633](https://github.com/chakra-ui/zag/issues/633) | Parent `onClick` runs twice (controlled) | Synthetic click dispatched on the input bubbles | fixed | Never dispatch a synthetic `click` |
| Zag | [#2491](https://github.com/chakra-ui/zag/issues/2491) | First click ignored in Firefox on first load | Pointer/press tracking set up late | fixed | Press handlers are props from connect, present from first render |
| Zag | [#3018](https://github.com/chakra-ui/zag/issues/3018) | Controlled vanilla switch never fires `onChange` | Per-framework bindable equality | fixed | One controllable in the runtime (foundations) |
| Ark | [#3824](https://github.com/chakra-ui/ark/issues/3824) | `aria-labelledby` points at a missing label | Unconditional IDREF | wontfix (render a label) | Relations only to rendered parts (react-adapter "Unrendered part") |
| Ark | [#3421](https://github.com/chakra-ui/ark/issues/3421) | Switch invisible in Firefox high contrast | Track/thumb drawn with backgrounds only | fixed in theme | Forced-colors scenario in theme |
| Headless UI | [#3760](https://github.com/tailwindlabs/headlessui/issues/3760) | `onChange` fires before the hidden input changes | Callback before DOM sync | fixed | Hidden input reflects the value before `change` is dispatched |
| Headless UI | [#2935](https://github.com/tailwindlabs/headlessui/issues/2935), [#3343](https://github.com/tailwindlabs/headlessui/issues/3343) | `type="submit"` switch does not submit | Switch keeps `type=button` | closed | Control's `type` is accessibility-critical (`button`); dev warning on override |
| Bits UI | [#789](https://github.com/huntabyte/bits-ui/issues/789) | Toggled on pointerdown; wrapping label broke | Activation on press-down | fixed | Activation on release (press-interactions) + label scenario |
| Bits UI | [#1238](https://github.com/huntabyte/bits-ui/issues/1238) | Hidden input reachable with Tab | Missing `tabIndex=-1` | fixed | `form-associated` trait: hidden input never tabbable |
| Kobalte | [#230](https://github.com/kobaltedev/kobalte/issues/230) | Focus lost after clicking the switch | Hidden input focus model | fixed | Pressing the control focuses it (native button) |
| RA | [#5791](https://github.com/adobe/react-spectrum/issues/5791) | ChromeVox silent on mouse toggle | AT behaviour (APG example too) | closed | Manual protocol only; no workaround |
| RA | [#5844](https://github.com/adobe/react-spectrum/issues/5844) | Hidden input "always checked" in DOM | `checked` attribute = default, property = live | closed | Documented; contract reads the property |

## Known pitfalls

- Hidden-input layout tricks (Radix) and tabbable hidden inputs (Bits) — both solved once
  in `hidden-form-input`.
- Synthetic clicks double-firing ancestor handlers (Zag #633, Radix #3265 class).
- Enter semantics differ across libraries; consumers port expectations (ark#2946).
- Label association with non-labelable `span` controls (Base UI #4122).
- Forced colors and RTL are theme bugs that surface as "the switch is broken".

## Testing notes

- Model test: two states, `TOGGLE` in pointer/keyboard/touch/virtual; virtual-parity
  catches double toggles (BU#4902, zag#633).
- Driver: `toggle()`, `clickLabel()`, `resetForm()` (clicks a reset button in the
  story), queries `isChecked`, `isDisabled`, `isReadOnly`, `isRequired`, `isInvalid`,
  `formValue` (via `hidden-form-input`'s checkedness read).
- Invariants: `form-associated` trait; per-component: `aria-checked` is never `mixed`;
  accessible name identical in both states; Thumb is `aria-hidden`.
- Forced colors and RTL: Playwright captures of the theme story.

## Decisions

- **Parts** (mirror Checkbox, so one mental model and shared modules):
  `Root` (`div`, provides the machine, renders `HiddenInput` last), `Control`
  (`button type=button role=switch`), `Thumb` (`span`, `aria-hidden`), `Label`
  (`label for=control`), `Description` (`span`/`p`), `HiddenInput` (from
  `hidden-form-input`). Not Radix's "Root is the button": it leaves no element for label,
  description and the hidden input, which is where its layout bugs come from. Not Ark's
  `label` root: the description would become part of the name, and the hidden input
  would be a second labelable descendant.
- **Machine**: states `unchecked`, `checked` bound to controllable `checked`
  (`defaultChecked`, `onCheckedChange(checked, details)`); events `TOGGLE { modality }`
  (from the Control's `PRESS`, and the Label via `control-label`), `RESET` (form reset),
  `FOCUS`/`BLUR { modality }`; guard `canToggle` (not disabled, not read-only). Enter is
  not an event: connect calls the implicit-submission helper `add-checkbox` uses.
- **`data-*`**: every part `data-scope="switch"`, `data-part`, `data-state="checked|unchecked"`,
  `data-disabled`, `data-readonly`, `data-required`, `data-invalid`; Control also
  `data-focus`, `data-focus-visible`, `data-pressed`, `data-hover`.
- **Contract**: locate `{ role: "switch", name }`; actions `toggle`, `clickLabel`,
  `resetForm`; queries above; states `unchecked`/`checked`; traits `form-associated`.
- **Deliberately different**: Space-only toggle with Enter-to-submit (native parity,
  vs Radix/Base/Reka/Bits); no synthetic click; no `mixed`; the hidden input is not the
  focus target (vs RA/Zag/Kobalte/Ariakit plan) so touch exploration and TalkBack hit the
  visible control (AT note cause J, RA#3047).

## Open questions

- Should the hidden input carry `role="switch"`? It is `aria-hidden`, so no; revisit only
  if a form library reads roles.
- NVDA/JAWS wording for `role=switch` on current versions: confirm in the first manual
  protocol pass and record in "Tested with".
