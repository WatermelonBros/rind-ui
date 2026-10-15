# Toggle — research

Status: done · Wave: 1

A two-state button (`aria-pressed`) — Bold, Mute, Favourite. Built on Button's
`button-like-element` capability and the press interactions of `add-a11y-foundations`.
Toggle Group is a separate, later component; this note only makes sure Toggle can be
owned by a group later.

Cross-cutting notes applied: [accessibility.md](accessibility.md) (§1.4 native element,
§5 press, rule 6), [assistive-tech-and-a11y-testing.md](assistive-tech-and-a11y-testing.md)
(causes A, K), [native-platform.md](native-platform.md) (no native toggle primitive).

## Pattern

- WAI-ARIA APG: [Button](https://www.w3.org/WAI/ARIA/apg/patterns/button/) — the
  *toggle button* variant.
- Roles and attributes: `role="button"` (native `<button>`), `aria-pressed="true|false"`
  always present (an absent `aria-pressed` makes it a plain button). ARIA also allows
  `aria-pressed="mixed"` for a button controlling several items that disagree.
  APG: "it is critical the label on a toggle does not change when its state changes"
  — "Mute" stays "Mute"; the state is carried by `aria-pressed`, not by the name.
- Keyboard: Space and Enter toggle. Nothing else.
- When to use which (APG + accessibility.md §1.5):
  - **Toggle (`aria-pressed`)**: an action-like command whose state is "applied or
    not" (Bold, Mute, Pin). Lives in toolbars; is not a form field.
  - **Switch (`role="switch"`)**: a setting that is on/off and takes effect
    immediately (Wi-Fi, Dark mode); spoken "on/off".
  - **Checkbox**: a choice that is submitted or that belongs to a list of choices;
    has `mixed`; spoken "checked/not checked". Form field.

## How the others built it

### Radix (`packages/react/toggle/src/toggle.tsx`, 67 lines)

- API: `Toggle.Root` (`button`), `pressed` / `defaultPressed` / `onPressedChange(pressed)`.
- `type="button"`, `aria-pressed`, `data-state="on|off"`, `data-disabled`; toggles in
  `onClick` unless `disabled`. `useControllableState`.
- Notable: the smallest correct implementation; activation on `click` means AT clicks
  work.
- Problems: `data-state` collides when composed with another primitive through
  `asChild` (radix#602, open since 2021; reka#1407); `onPressedChange` gets no event or
  reason.

### Base UI (`packages/react/src/toggle/Toggle.tsx`)

- API: `Toggle` (`button`, `nativeButton` default true), `pressed` / `defaultPressed`,
  `onPressedChange(pressed, details)` with `details.cancel()`, `value` for
  `ToggleGroup`, `disabled`. `form` and `type` are swallowed ("never participates in
  form validation", "cannot change button type").
- State attributes: **`data-pressed` = on**, `data-disabled`. In a group it renders a
  `CompositeItem` (roving focus) and the group owns the value.
- Notable: `onPressedChange` runs before the group commits so `cancel()` vetoes both;
  `useButton` gives non-native rendering role/keyboard.
- Problems: no `focusableWhenDisabled` on Toggle, so a disabled toggle cannot show the
  tooltip explaining why (base-ui#5834, open); `aria-pressed="mixed"` requested
  (base-ui#952, open); falsy `value` broke group membership (base-ui#3465).

### React Aria (`react-aria/src/button/useToggleButton.ts`, `react-stately/src/toggle/useToggleState.ts`, RAC `ToggleButton.tsx`)

- API: `ToggleButton`, `isSelected` / `defaultSelected` / `onChange(isSelected)`,
  everything `useButton` takes (usePress, `elementType` a/div/span/input).
- `onPress: chain(state.toggle, props.onPress)` — toggle on usePress's press, so all
  of usePress's mouse/touch/keyboard/virtual handling applies.
- Attributes: `data-selected` = on, **`data-pressed` = press in progress**,
  `data-hovered`, `data-focus-visible`. In a `ToggleButtonGroup` `id` is the key.
- Problems: `data-hovered` while the group is disabled (RA#9445); forced-colors hover
  state invisible (RA#4052, RA#4054); requests for `pending` (RA#7256) and form
  `name`/`value` (RA#4403, RA#1264).

### Zag / Ark (`zag/packages/machines/toggle/src/*`, `ark/packages/react/src/components/toggle/*`)

- Anatomy `root`, `indicator`. Machine: single `idle` state, `pressed` bindable,
  events `PRESS.TOGGLE`, `PRESS.SET`.
- Root: `type="button"`, `aria-pressed`, `data-state="on|off"` **and** `data-pressed`
  (= on). `onClick` toggles unless `defaultPrevented`/disabled.
- **Indicator** part: Ark renders `children` when pressed, `fallback` otherwise —
  icon swap without changing the accessible name. Worth copying.
- Problems: state naming debated (zag#597: `isPressed` vs `isToggled`); the machine is
  stateless (state in context), so its graph has one node.

### Reka UI (`packages/core/src/Toggle/Toggle.vue`) / Bits UI (`bits/toggle/toggle.svelte.ts`)

- Same as Radix: `button`, `aria-pressed`, `data-state="on|off"`, toggle on click.
- Reka renders a `VisuallyHiddenInput type="checkbox"` when inside a form with `name`
  (not in a group) — the only library giving Toggle form participation; sibling, not
  nested, to avoid `nested-interactive`.
- Bits: `pressed` is always a boolean (bits#834 refuses `undefined`).

### Kobalte (`packages/core/src/toggle-button/toggle-button-root.tsx`)

- `ToggleButton.Root` on `Button.Root`; `pressed` / `defaultPressed` / `onChange`;
  `aria-pressed`, **`data-pressed` = on** (same collision as Base UI).

### Headless UI, Ariakit

- No Toggle. Headless UI points to `Switch`; Ariakit to `Button` + `aria-pressed` or
  `Checkbox render={<button />}` (Ariakit's checkbox can render as a button and gets
  `aria-pressed`). ariakit#7353 (open) proposes Toggle/ToggleGroup.

## Accessibility

- **Name/role/state** (4.1.2): native button, name from content or `aria-label`
  (icon-only), `aria-pressed` explicit `true`/`false`. The name must not depend on the
  state; an Indicator part lets the icon change instead.
- **Announcements**: none of our own. NVDA/JAWS speak "toggle button, pressed / not
  pressed" and speak the new state when it changes on the focused element; VoiceOver
  (macOS) speaks "toggle button, selected / unselected" (wording varies by version; iOS
  "selected"). No Announcer use (rule 23).
- **Keyboard**: Enter and Space via press-interactions (repeat ignored, one activation
  per key press, Space activates on keyup). Tab order: native.
- **AT press** (cause A): activation bound to `click` through press, so VO+Space, NVDA
  browse-mode Enter and TalkBack double-tap toggle exactly once (virtual parity).
- **Focus alone never toggles** (cause C).
- **Disabled**: native `disabled` removes it from the tab order; a toggle explained by a
  tooltip needs `focusableWhenDisabled` (base-ui#5834) — provided by
  `button-like-element`.
- **`aria-pressed="mixed"`**: allowed by ARIA, but meant for a button that controls
  several items; AT wording is uneven and a mixed Checkbox covers the "select all"
  case. Not in v1.
- **Forced colors** (cause K): the pressed state must not be a background colour only —
  theme adds a border/inner outline and maps to `Highlight`/`HighlightText`
  (RA#4052/#4054 show the hover/state cue disappearing in HCM). Focus ring is the shared
  outline.
- **Target size**: 24×24 CSS px in the theme (2.5.8); icon toggles use
  `--rind-hit-area`.
- Native primitive: none. `<input type=checkbox>` would carry the wrong semantics
  (checkbox, not toggle button) and Safari's `<input switch>` is a switch.

## Bug history

| Library | Issue | Symptom | Root cause | Fix / status | Lesson for rind-ui |
|---|---|---|---|---|---|
| Radix | [#602](https://github.com/radix-ui/primitives/issues/602) | `data-state` of one primitive wins when Dialog/Tooltip/Toggle triggers are composed with `asChild` | Two components write the same `data-state` on one element; Slot merge order | open | The contract and invariants read `aria-pressed`, never `data-state`; `aria-pressed` is accessibility-critical in mergeProps (dev warning on override) |
| Reka | [#1407](https://github.com/unovue/reka-ui/issues/1407) | Toggle inside a Tooltip trigger: tooltip's `data-state="closed"` overwrites `on/off` | Same as radix#602 | open; proposed `data-tooltip-state` | Same; noted as an open question for composition in general |
| Base UI | [#5834](https://github.com/mui/base-ui/issues/5834) | Disabled Toggle cannot be focused, so its explanatory tooltip never opens for keyboard users | Toggle always uses native `disabled`; no `focusableWhenDisabled` | open | `focusableWhenDisabled` comes from `button-like-element`; scenario |
| Base UI | [#952](https://github.com/mui/base-ui/issues/952) | Request for `aria-pressed="mixed"` | ARIA allows it; semantics only for multi-item controls | open | Non-goal in v1; mixed Checkbox covers "select all" |
| Base UI | [#3465](https://github.com/mui/base-ui/issues/3465) | Toggle with a falsy `value` never pressed inside a group | Truthiness check instead of `!== undefined` | fixed | When the group arrives, membership by key presence, never truthiness |
| Base UI | [#1084](https://github.com/mui/base-ui/issues/1084) | Non-native render lost the disabled styling hook | Only `disabled` set, no `data-disabled` | fixed | `data-disabled` always, whatever the element (`button-like-element`) |
| Radix | [#721](https://github.com/radix-ui/primitives/issues/721), [#2254](https://github.com/radix-ui/primitives/issues/2254) | Un-pressing a controlled single ToggleGroup item needs two clicks | Consumer maps "none" to `undefined`, which silently flips the component to uncontrolled | fixed by docs (use `""`) | Controlled mode is frozen at creation with a dev warning (machine-runtime); `pressed` is `boolean`, never `undefined` once controlled; scenario |
| Radix | [#1525](https://github.com/radix-ui/primitives/issues/1525) | `onClick` on Toolbar ToggleItem fires twice | Handler composed twice through nested Slot wrappers | fixed (#1526) | Consumer handlers run once (mergeProps); virtual-parity invariant counts activations |
| Bits UI | [#834](https://github.com/huntabyte/bits-ui/issues/834) | Binding `pressed` to an object map without initial values errors | `pressed` must be boolean | wontfix | `pressed` typed `boolean`; uncontrolled default `false` |
| Zag | [#597](https://github.com/chakra-ui/zag/issues/597) | Confusion over `isPressed` naming | "Pressed" means both "being pressed" and "on" | kept | We separate them: `data-pressed` = press in progress, `data-state="on"` = on |
| React Aria | [#9445](https://github.com/adobe/react-spectrum/issues/9445) | `data-hovered` on a toggle disabled through its group | Hover ignored only the toggle's own `isDisabled` | fixed | Hover and press read the resolved disabled (own, fieldset, later group) |
| React Aria | [#4052](https://github.com/adobe/react-spectrum/issues/4052), [#4054](https://github.com/adobe/react-spectrum/issues/4054) | State/hover change invisible in Windows High Contrast | Colour-only cue | fixed in styles | Theme: non-colour pressed cue, system colours under forced colors |
| React Aria | [#7256](https://github.com/adobe/react-spectrum/issues/7256) | Async toggle needs a pending state | Button had `isPending`, ToggleButton not | added | Follow Button's pending design later; not in Toggle v1 |
| React Aria | [#4403](https://github.com/adobe/react-spectrum/issues/4403), [#1264](https://github.com/adobe/react-spectrum/issues/1264) | Want `name`/`value` submitted with the form | A `type=button` is never submitted | not done | Non-goal; a form value is a Checkbox/Switch job. Reka's hidden input is the only precedent |
| Ark | [#2946](https://github.com/chakra-ui/ark/issues/2946) | Switch ignores Enter (built on checkbox) | Checkbox semantics: Space only | by design | Toggle is a button: Enter **and** Space; scenario |
| Ariakit | [#7353](https://github.com/ariakit/ariakit/issues/7353) | No Toggle; apps hand-roll `aria-pressed` | — | open | Ship it; the hand-rolled version is where `aria-pressed` gets dropped when false |

The history is short: the pattern is simple and every library gets the ARIA right. The
bugs are in **composition** (data-state collisions, double handlers), **controlled
mode** (`undefined` as a value) and **naming of "pressed"**.

## Known pitfalls

- "Pressed" is overloaded: Base UI and Kobalte put `data-pressed` on the on state, RA
  uses it for press-in-progress. A theme ported between them styles the wrong thing.
- Changing the label with the state ("Mute" → "Unmute") is the most common authoring
  error (APG warns); it doubles the information and confuses voice-control users.
- `aria-pressed` omitted when false (hand-rolled toggles) turns it into a plain button.
- A disabled native button swallows pointer events, so tooltips on it never open.

## Testing notes

- Machine trivial; the value is in the contract: locate by `role: "button"` + exact
  name. Because the anchor is re-located by name after every step, a name that changes
  with the state fails the generic "exactly one anchor match" invariant for free.
- Virtual modality: bare `click` must toggle once (invariant `virtual-parity`).
- Keyboard: Space and Enter both; held Space toggles once.
- Composition: a story/test that renders the Toggle as a Tooltip trigger (once Tooltip
  exists) asserts `aria-pressed` survives.

## Decisions

- **Parts**: `Root` (`button`, via `button-like-element`), `Indicator` (`span`,
  `aria-hidden="true"`, renders children when on and an optional `fallback` when off —
  Ark). No hidden input.
- **Machine**: states `off` / `on`, bound to controllable `pressed`
  (`pressed`/`defaultPressed`/`onPressedChange(pressed, details)`); events `PRESS`
  (from press-interactions, with `modality`), `FOCUS`/`BLUR` (focus context for
  `data-focus*`). `details.reason === "PRESS"`, `cancel()` vetoes. Real states (not
  Zag's single `idle`) so the graph has two nodes and model tests cover both edges.
- **`data-*`**: Root `data-scope="toggle"`, `data-part="root"`, `data-state="on|off"`,
  plus `button-like-element`'s `data-disabled`, `data-focus`, `data-focus-visible`,
  `data-pressed` (press in progress), `data-hover`. Indicator: `data-state`,
  `data-disabled`.
- **Contract**: locate `{ role: "button", name }`; actions `setPressed(pressed)`
  (pointer click / keyboard Space / touch tap, only when it differs; done: `isPressed()
  === pressed`), `activateWithEnter(pressed)` (keyboard-only); queries `isPressed`,
  `isDisabled`; states `off: { isPressed: false }`, `on: { isPressed: true }`; event
  `PRESS → setPressed(!ctx.pressed)`.
- **Deliberately different**: `data-state` for on/off and `data-pressed` reserved for
  press-in-progress (vs Base UI/Kobalte); a two-state machine (vs Zag's stateless one);
  `focusableWhenDisabled` (vs Base UI); no form participation (vs Reka); the name is
  required to be state-independent and checked by the contract.

## Open questions

- Composition collisions (`data-state`, `data-scope` when two parts share one element,
  radix#602): a framework-wide question for `mergeProps`/`render`, to settle with the
  first trigger composition (Tooltip). Toggle's own correctness rests on `aria-pressed`.
- `aria-pressed="mixed"` and `pending`: revisit with Toggle Group and Button's pending
  state respectively.
