# Button — research

Status: done · Wave: 1 (first component of the boolean/press family; its
button-like element rules are reused by Toggle, Switch, Checkbox and every trigger)

Builds on [accessibility.md](accessibility.md) §1.4 (native element first, disabled vs
`focusableWhenDisabled`), §5 (press), [assistive-tech-and-a11y-testing.md](assistive-tech-and-a11y-testing.md)
cause A (an AT press is a bare `click`) and the `press-interactions`,
`interaction-modality` and `announcer` capabilities of `add-a11y-foundations`. Those
already decide *how* activation works; this note decides what a Button is on top of
them, and the element rules every button-like part shares.

## Pattern

- WAI-ARIA APG: [Button](https://www.w3.org/WAI/ARIA/apg/patterns/button/).
- Roles and attributes: native `<button>` (implicit `button` role); `role="button"`
  only when the element is not a native button or link. Name from content,
  `aria-label` / `aria-labelledby` for icon-only buttons. `aria-disabled="true"`
  when disabled but discoverable. Toggle buttons use `aria-pressed` (see
  [toggle.md](toggle.md)); menu buttons `aria-haspopup` / `aria-expanded` (their own
  components). The label must not change when a toggle's state changes (APG).
- Keyboard: Enter activates; Space activates (on keyup for native buttons). After
  activation focus normally stays on the button unless the action moves it (dialog
  opens, element removed).
- Links styled as buttons stay links: Enter only, no Space, `role="link"` semantics.

## How the others built it

Zag / Ark UI and Radix ship **no Button**. Radix's `Slot` / `asChild` and Ark's
`ark.button` factory are only element substitution; consumers render native
`<button>`s and every trigger part sets `type="button"` itself (radix#3468, where
Tooltip deliberately omits it because triggers are often anchors and `type` on `<a>`
is a MIME type).

### React Aria / React Aria Components

- Source: `packages/react-aria/src/button/useButton.ts`,
  `packages/react-aria-components/src/Button.tsx` (via `git show HEAD:`).
- API: `useButton(props, ref)` with `elementType`; RAC `Button` with `isDisabled`,
  `isPending`, `onPress*`, `type` (default `"button"`), form props passed through
  (`form`, `formAction`, `name`, `value`…).
- State: none of its own; press state from `usePress`, focus from `useFocusRing`,
  hover from `useHover`. `isPending` is a prop.
- Notable: per element type: native button gets `type`/`disabled`; anything else gets
  `role="button"`, `aria-disabled`, and for `<a>` `href` only when enabled. **Pending**:
  interactions disabled except focus/hover-ish events (`useDisableInteractions`),
  `aria-disabled="true"` while pending, `type="submit"` becomes `"button"` while pending
  to stop implicit submission, the progress bar's id is appended to `aria-labelledby`,
  and an assertive announcement of the button's name is made when pending starts or
  ends **while the button is focused**. Data attributes `data-pressed`,
  `data-hovered`, `data-focused`, `data-focus-visible`, `data-pending`,
  `data-disabled`.
- Problems: Space on `type="submit"|"reset"` calls `onPress`/`onClick` twice
  (react-spectrum#10658, open); `isPending` also kills hover, so a Tooltip on a pending
  button never opens (#9460); press ignored when tapping near the edge on Android
  because capture release moved `pointerup` outside (#8249, #7800); label wrapping a
  button doesn't activate it in Firefox (#8887 → #3613); `useFormStatus` pending not
  reflected on keyboard activation (#7543, React bug); `aria-disabled` not emitted for a
  native disabled button surprised users (#8825, by design: `disabled` is enough).

### Base UI

- Source: `button/Button.tsx`, `internals/use-button/useButton.ts`,
  `utils/useFocusableWhenDisabled.ts`.
- API: `Button` with `disabled`, `focusableWhenDisabled`, `nativeButton` (default
  `true`), `render`. Data: `data-disabled`.
- Notable: `focusableWhenDisabled` on a native button → `aria-disabled` instead of
  `disabled`, keeps `tabIndex`, and swallows every key except Tab; non-native disabled
  → `aria-disabled` + `tabIndex=-1`. Non-native: Enter clicks on keydown, Space on keyup
  (dispatching a click with the same modifiers); links get no click on Space. Dev error
  when `nativeButton` disagrees with the rendered tag. Composite (toolbar) items keep
  the native button enabled so roving focus can land on it.
- Problems: `role="button"` was applied to links rendered through `render`
  (base-ui#4021); `focusableWhenDisabled` buttons were still clickable after a
  merge-order regression (#1312); SSR missing `disabled` (#1843); `autoFocus` not
  forwarded (#5150); NVDA announced only "unavailable" for the loading example because
  the focused button was natively disabled and its changed label was never read
  (#4249); `data-focusable` debate — rejected, `data-disabled` is the one styling hook
  (#5806).

### Headless UI

- Source: `components/button/button.tsx`.
- API: `Button` with `disabled`, `autoFocus`, `type` (default `"button"`), `as`.
  Disabled comes from a surrounding `Fieldset`/`Field` too (`useDisabled`).
- Notable: hover/focus from React Aria's hooks, press from `useActivePress`; render
  props `{ disabled, hover, focus, active, autofocus }` → `data-*`.
- Problems: no `role` / keyboard handling when rendered `as` a non-button; components
  emitting `type="button"` on non-buttons (headlessui#619).

### Ariakit

- Source: `button/button.tsx`, `command/command.tsx`, `focusable/focusable.tsx`.
- API: `Button` = `Command` + `Focusable`; `accessibleWhenDisabled`,
  `clickOnEnter`, `clickOnSpace`.
- Notable: detects the native button from the ref after mount; non-native gets
  `role="button"` unless it is `<a>`; Enter fires the click from keydown (queued until
  keyup in Firefox, which otherwise blocks `target=_blank` as a popup); Space on keyup;
  losing focus before Space keyup cancels, mirroring native; ⌘ held suppresses.
- Problems: disabled `<a>` still reached by Tab (ariakit#722); disabled set
  `pointer-events: none` inline, overriding the consumer's cursor (#845);
  `useFormStatus` pending missed on keyboard click (#4540).

### Bits UI

- Source: `bits/button/components/button.svelte`.
- Notable: one component that renders `<a>` when `href` is set, else `<button>`.
  Disabled link: `href` removed, `aria-disabled`, `role="link"` (so it stays a link
  without `href`), `tabindex=-1`.

### Kobalte

- Source: `button/button-root.tsx`, `button/is-button.ts`.
- Notable: tag detection (native button, input, link); non-native and non-link get
  `role="button"` and `tabIndex=0` (removed when disabled); `type` only on native
  buttons/inputs; `aria-disabled` only on non-native.

## Accessibility

- **Native first** ([accessibility.md](accessibility.md) §1.4): a native `<button
  type="button">` gives role, focusability, Enter/Space, `disabled`, form behaviour and
  `<label for>` association for free. Connect emits only what the rendered element
  lacks. `type` defaults to `"button"` (a `<button>` inside a `<form>` is a submit
  button otherwise — radix#3468, reka-ui#3007, headlessui#178).
- **Substitution**: a link (`<a href>`) keeps link semantics (no `role="button"`,
  base-ui#4021), Enter only. A non-interactive element gets `role`, `tabIndex=0`,
  Enter/Space through press. `type` is never emitted on non-buttons (headlessui#619;
  on `<a>` it is a MIME type).
- **Disabled**: native `disabled` removes the button from the tab order and AT
  browse lists still show it as unavailable. `focusableWhenDisabled` keeps it
  focusable with `aria-disabled="true"` — needed for disabled toolbar items, buttons
  with a tooltip explaining why (react-spectrum#8539), and for state changes of a
  focused button: setting native `disabled` on the focused button drops focus to
  `<body>` and NVDA reads only "unavailable" (base-ui#4249).
- **Pending**: never natively disabled (same reason). `aria-disabled="true"`, focus
  kept, activations ignored, hover and focus still delivered (react-spectrum#9460), a
  polite announcement through the Announcer when pending starts while the button is
  focused ([accessibility.md](accessibility.md) §7.4: assertive only for errors; RA
  uses assertive). The string comes from `messages`.
- **AT activation** (AT note cause A): every activation from `click`, so VO+Space,
  NVDA browse-mode Enter and TalkBack double-tap work — the press module already
  guarantees it; Button's contract runs the `virtual` modality.
- **Focus visible**: `data-focus-visible` from the modality tracker, not
  `:focus-visible` alone; a mouse click leaves `data-focus` without a ring
  (base-ui#3759 shows users expect the native heuristic).
- **Forced colors**: the theme's ring is an `outline`; disabled uses `GrayText`, never
  only opacity.
- **Target size**: theme guarantees ≥ 24×24 CSS px; icon buttons use `--rind-hit-area`.
- Native-platform ([native-platform.md](native-platform.md)): `commandfor`/`command`
  is avoided (§3), so Button does not emit them; consumers may pass them through.

## Bug history

| Library | Issue | Symptom | Root cause | Fix / status | Lesson for rind-ui |
|---|---|---|---|---|---|
| React Aria | [#10658](https://github.com/adobe/react-spectrum/issues/10658) | Space on `type=submit/reset` fires `onPress`/`onClick` twice | Native keyup click on submit buttons plus usePress's own | open | One `PRESS` per key press for every `type` (scenario) |
| React Aria | [#9460](https://github.com/adobe/react-spectrum/issues/9460) | Tooltip never opens on a pending button | Pending disabled all interactions, hover included | acknowledged | Pending ignores activation only; hover/focus still flow (scenario) |
| React Aria | [#8249](https://github.com/adobe/react-spectrum/issues/8249), [#7800](https://github.com/adobe/react-spectrum/issues/7800) | Tap near the edge shows `:active` but no `onPress` on Android | Capture released; touch-adjusted `pointerup` lands outside | #7800 fixed (#7427); #8249 open | Activation follows the native `click` the browser delivers (press module) |
| React Aria | [#8887](https://github.com/adobe/react-spectrum/issues/8887) / #3613 | Clicking a `<label>` around a button doesn't press in Firefox | Forwarded label click not treated as a press | dup, fixed | Label-forwarded clicks are activations (virtual click path) |
| React Aria | [#7543](https://github.com/adobe/react-spectrum/issues/7543) | `useFormStatus` pending not shown on Enter | React bug with preventDefault'ed keydown + native submit | open | Submit buttons must submit through the native path; test Enter/Space submit |
| React Aria | [#10229](https://github.com/adobe/react-spectrum/issues/10229) | Vimium activation does nothing | Synthetic `click` without pointer events ignored | closed (Vimium) | Bare `click` must activate (virtual modality) |
| React Aria | [#8825](https://github.com/adobe/react-spectrum/issues/8825) | Expected `aria-disabled` on disabled button | Native `disabled` makes it redundant | by design | Emit only what the element lacks; document `focusableWhenDisabled` |
| Base UI | [#4249](https://github.com/mui/base-ui/issues/4249) | NVDA reads only "unavailable" for a loading button | Focused button natively disabled; label change unread | fixed | Pending never sets `disabled`; announce (scenario) |
| Base UI | [#4021](https://github.com/mui/base-ui/issues/4021) | Links rendered as Button get `role="button"` | Role applied to every non-button | fixed (design change) | Links keep link semantics (scenario) |
| Base UI | [#1312](https://github.com/mui/base-ui/issues/1312) | `focusableWhenDisabled` buttons still clickable | Consumer handlers ran before the disabled guard after a merge refactor | fixed | Disabled guard lives in the machine, not in handler order (scenario) |
| Base UI | [#1843](https://github.com/mui/base-ui/issues/1843) | Disabled trigger missing `disabled` in SSR | Attribute set in an effect | fixed | Disabled attributes come from connect on first render |
| Base UI | [#5150](https://github.com/mui/base-ui/issues/5150) | `autoFocus` not forwarded | Prop swallowed | fixed | Parts forward every element prop (Liskov) |
| Base UI | [#5806](https://github.com/mui/base-ui/issues/5806) | Should `data-focusable` exist? | Prop mirror, not state | rejected | One hook: `data-disabled`; no prop-mirror attributes |
| Ariakit | [#722](https://github.com/ariakit/ariakit/issues/722) | Disabled `<a>` Button still tabbable | Links have no `disabled` | fixed | Disabled link: `aria-disabled`, out of tab order, no `href` (scenario) |
| Ariakit | [#845](https://github.com/ariakit/ariakit/issues/845) | Disabled sets inline `pointer-events: none` | Style used to block clicks | fixed | Never style to disable; guard events |
| Ariakit | [#4540](https://github.com/ariakit/ariakit/issues/4540) | `useFormStatus` not updated on keyboard click | Synthetic click path bypassed React's form transition | fixed (#6066) | Same as RA#7543 |
| Radix | [#3468](https://github.com/radix-ui/primitives/issues/3468) | Buttons submit surrounding forms | No default `type` | partly (Tooltip omits on purpose) | Default `type="button"`, never on non-buttons |
| Reka UI | [#3007](https://github.com/unovue/reka-ui/issues/3007) | TooltipTrigger submits the form | Same | open | Same — shared rule for every button-like part |
| Headless UI | [#619](https://github.com/tailwindlabs/headlessui/issues/619), [#178](https://github.com/tailwindlabs/headlessui/issues/178) | `type="button"` emitted on non-buttons; Switch submitted forms | Attribute not tied to the rendered tag | fixed | `type` follows the rendered tag |

## Known pitfalls

- `type` default and non-buttons (five libraries, see table).
- Disabling a focused element loses focus (Base UI loading, every "disable while
  submitting" pattern).
- Double activation from a native synthetic click plus a library handler (RA#10658;
  the press module's "no native double activation" rule must cover submit/reset).
- Links: Space must not activate; `target=_blank` from a synthetic click is blocked as
  a popup in Firefox unless dispatched in the keyup (Ariakit `command.tsx`). Native
  Enter on a real `<a href>` is left to the browser.
- `<label>` forwarding clicks into a button (RA#8887) and Firefox differences.
- Touch: press capture/hit-testing vs Chrome's touch adjustment (RA#8249).

## Testing notes

- The press module carries the event-sequence tests; Button's tests prove the wiring:
  one `onPress` per activation in pointer, keyboard (Enter, Space, held Space),
  virtual and touch, for `type` button/submit/reset; one form submission for submit.
- Substitution matrix in browser mode: native button, `<a href>`, `<a>` disabled,
  `<div>`; each with disabled, `focusableWhenDisabled`, pending.
- Pending while focused: focus stays, one polite announcement (recording announcer),
  hover still delivered.
- Contract: locate `{ role: "button", name }` (or `link` for a link render — the driver
  is created with the role the consumer rendered). Actions `press` (pointer, keyboard
  Enter, touch, virtual), `pressSpace` (keyboard), `focus`. Queries `isDisabled`,
  `isPending`, `isFocusable`, `isFocusVisible`.

## Decisions

- **Parts**: one part, `root` (default `<button type="button">`). No Icon/Label parts —
  content is the consumer's.
- **Machine**: yes, minimal, so `testMachine` drives Button like every component and the
  focus-visible, virtual-parity and focus-does-not-commit invariants run on it:
  - states `idle` and `pending`, chosen from the `pending` prop through an `onProps`
    edge (`PENDING.CHANGE`; guards `isPending` / `not isPending`); connect reads
    `pending` from props for attributes so the first render (and SSR) is right, and the
    machine catches up on the first `setProps` (see the change's design).
  - events: `PRESS` (from press-interactions, with `modality`), `PRESS.START`,
    `PRESS.END`, `PRESS.CANCEL` (pass-through to callbacks), `FOCUS`, `BLUR`,
    `PENDING.CHANGE`.
  - `idle`: `PRESS` → action `notifyPress` (calls `onPress(details)`), guarded by
    `not isDisabled`. `pending`: `PRESS` ignored; entry `announcePending` guarded by
    `isFocused`.
  - context: `focused` (FOCUS/BLUR). No controllable value.
- **`data-*`** (root): `data-scope="button"`, `data-part="root"`, `data-instance`,
  `data-state="idle|pending"`, `data-pending`, `data-disabled`, `data-focus`,
  `data-focus-visible`, `data-pressed`, `data-hover`.
- **Props**: `type` (`"button"` default, `"submit"`, `"reset"`; only on native
  buttons), `disabled`, `focusableWhenDisabled`, `pending`, `onPress`,
  `onPressStart`, `onPressEnd`, `messages` (`pending: "Loading"`), `render`; every
  native attribute forwarded (form attributes, `autoFocus`, `commandfor`…).
- **Pending**: `aria-disabled="true"`, focusable, activations ignored, `type="submit"`
  rendered as `"button"` while pending (RA, stops implicit and double submission),
  polite announcement of `messages.pending` when entering `pending` while focused,
  hover/focus unaffected.
- **Contract**: `button` contract with actions `press` (pointer / keyboard Enter /
  touch; virtual derived), `pressWithSpace` (keyboard), `focus` (keyboard Tab
  semantics through the env) and queries `isDisabled` (`disabled` or `aria-disabled`),
  `isPending`, `isFocusVisible` (press counts are the test's own `onPress` spies, not a
  query). Traits: none beyond the generic set.
- **Shared `button-like-element` capability** defined in the Button change: default
  element, `type` rules, substitution (link vs generic), disabled /
  `focusableWhenDisabled` / fieldset, keyboard rules per role delegated to press, the
  shared `data-*`. Toggle, Switch control, Checkbox control and every later trigger
  reuse it.
- **Deliberately different**:
  - Pending is a machine state, not "disabled" (Base UI's example) — focus and
    announcements survive (base-ui#4249).
  - Pending does not block hover (RA#9460).
  - Polite, not assertive, pending announcement (our announcer rule).
  - Link substitution keeps link semantics (Base UI changed course in #4021; Kobalte,
    Ariakit, Bits agree).
  - No `isPressed` prop-mirror attribute for consumers to fake; `data-pressed` is
    press-in-progress only, everywhere.

## Open questions

- Should `pending` also be read from React's `useFormStatus` automatically for
  `type="submit"`? Leaning no (adapter-specific, RA#7543/AK#4540 show the event-path
  trap); document the one-line recipe.
- Announce the end of pending (RA does) or leave it to the consumer's visible label
  change? Proposed: start only; revisit after the NVDA/VO manual pass.
