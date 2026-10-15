# Password Input — research

Status: done · Wave: 2 (Password Input in Ark/Zag; Password Toggle Field in Radix)

A Text Field (`add-text-field`) with a visibility toggle. Read [text-field.md](text-field.md),
[field.md](field.md) and [toggle.md](toggle.md) (the toggle's name must not change with its
state). Cross-cutting: [accessibility.md](accessibility.md) §1.1 (3.3.8: paste and password
managers must work), §5 (press without focus), §7 (Announcer); [native-platform.md](native-platform.md)
(no native "reveal" control outside Edge). Reado: `molecules/VaultBar.tsx` unlocks the vault
with a plain `<input type="password" autoComplete="off">` and Enter.

## Pattern

- No APG pattern; accessibility.md §1.5 maps the toggle to the
  [Disclosure](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/) row, but what it does
  is a two-state button: the [Button pattern](https://www.w3.org/WAI/ARIA/apg/patterns/button/)'s
  toggle button (`aria-pressed`) with a constant name, as rind-ui's Toggle.
- `<input type="password">` has **no ARIA role** (HTML-AAM: exposed as a protected text field;
  Testing Library's `getByRole("textbox")` does not match it); switching `type` to `text`
  is the only reliable way to reveal (GOV.UK, below).
- `autocomplete="current-password"` / `"new-password"` (WCAG 1.3.5; password managers rely
  on it), `passwordrules` (Safari) passes through.

## How the others built it

### Ark UI / Zag (`zag/packages/machines/password-input/src/*`)

- One `idle` state; controllable `visible`; parts Root, Label, Control, Input,
  VisibilityTrigger, Indicator. Input `autoComplete` (default `current-password`),
  `autoCapitalize="off"`, `spellCheck=false`, `type` from `visible`, `data-state`
  visible/hidden, optional password-manager ignore attributes (`data-1p-ignore`,
  `data-lpignore`, `data-bwignore`, `data-form-type`, `data-protonpass-ignore`).
- Trigger: `type=button`, **`tabIndex=-1`**, `aria-controls`, **`aria-expanded`**, label
  that changes ("Show password"/"Hide password"), toggles on **`pointerdown`** only — so no
  keyboard path and no screen-reader click (cause A). Hides on form `submit` and `reset`.
- Problems: ark#3930 (Svelte adapter ignored the Field context: invalid/disabled/readOnly
  /required lost).

### Radix (`password-toggle-field/src/password-toggle-field.tsx`)

- Parts Root (provider), Input, Toggle, Slot, Icon. Toggle is a real, **tabbable** button
  toggling on `click` (keyboard and AT work), `aria-controls` after hydration (`aria-hidden`
  and `tabIndex=-1` before, since it does nothing yet), default `aria-label` that changes
  with the state ("Show password"/"Hide password") unless the button has text. After a
  pointer click it focuses the input and restores the selection saved on blur, in the next
  frame. Input: `autoComplete` `current-password`/`new-password`, `autoCapitalize="off"`,
  `spellCheck=false`. Hides on form `reset` (unless prevented) and on every `submit`,
  "to prevent the browser from remembering the input's value", citing GOV.UK.
- Problems: radix#4157 (controlled `visible` not reset on submit/reset under React 19.2:
  `useEffectEvent` stale — a React bug), radix#3606 (misspelt `onVisiblityChange` kept as an
  alias), radix#2212 (the request).

### Others

- React Aria, Base UI, Reka, Bits, Kobalte, Headless UI, Ariakit ship none (Base UI#4787 is a
  discussion; ariakit#664 a request closed by an example). Material UI shows it as an input
  adornment example.

### GOV.UK ("Simple things are complicated: making a show password option", 2021)

- A `type=button` so Enter does not submit; JavaScript-only (hidden without it); revealing =
  changing `type`; **back to `password` on submit**, because a revealed value can be saved as
  a text autocomplete suggestion (`autocomplete="off"` rejected as unreliable); `aria-live`
  on the input was dropped (it read the password aloud); instead a hidden live region says
  the password is shown or hidden; `aria-controls` only as an enhancement; result: confirm-
  password fields removed.

## Accessibility

- **Toggle semantics.** One mechanism: `aria-pressed` with a constant name
  (`messages.toggleLabel`, "Show password") — rind-ui's Toggle rule (stable names, explicit
  `aria-pressed`), not Zag's `aria-expanded` (nothing expands) nor a changing label (Zag,
  Radix), and never both (a changing name plus `aria-pressed` reads "Hide password, toggle
  button, pressed").
- **Reachability.** The toggle is in the tab order: unlike a stepper or a clear button there
  is no keyboard alternative (WCAG 2.1.1). It activates through press interactions (click,
  Enter, Space, AT click) — never `pointerdown` only (Zag, cause A).
- **Focus and caret.** A mouse/pen press does not take focus: focus and caret stay in the
  input (or move to it with the caret where it was); a touch press does not move focus (no
  keyboard pops); a keyboard or AT activation leaves focus on the toggle. Changing `type`
  can reset the selection in some engines, so the selection is captured before and restored
  after the change, in the same frame (Radix restores a selection saved on blur, a frame
  later).
- **Announcements.** With focus on the toggle the AT speaks the new pressed state. When the
  toggle was pressed while focus stayed in the input, a polite announcement
  `messages.visibilityAnnouncement(visible)` ("Password shown" / "Password hidden") says
  what happened (GOV.UK) — never the password itself.
- **Privacy.** `spellCheck=false` and `autoCorrect="off"`, `autoCapitalize="none"` stay on
  while visible: browsers' enhanced spellcheck services send field text to a server, which
  exposed revealed passwords (the 2022 "spell-jacking" report on Chrome Enhanced Spellcheck
  and Edge Microsoft Editor). Visibility resets to hidden on submit and on reset.
- **Platform reveal buttons.** Edge (Chromium) draws its own reveal eye (`::-ms-reveal`) in
  password inputs; with our toggle that is two eyes. Hidden through the injected style rule
  while a VisibilityTrigger is mounted.
- **Password managers.** Their badges sit at the inline end of the input, where the toggle is;
  the theme leaves space (`--rind-password-input-trigger-*`). Modal `inert` blocking their
  iframes is overlay-infrastructure's keep-visible rule (RA#9174, outside-inert spec).
- **Forced colors / target**: icon in `currentColor`, 24×24 hit area.

## Bug history

| Library | Issue | Symptom | Root cause | Fix / status | Lesson for rind-ui |
|---|---|---|---|---|---|
| Ark | [ark#3930](https://github.com/chakra-ui/ark/issues/3930) | Field `invalid/disabled/readOnly/required` not applied | adapter did not read the Field context | fixed | `field-control` binding through the Text Field it is built on |
| Radix | [radix#4157](https://github.com/radix-ui/primitives/issues/4157) | controlled `visible` stays `true` after submit/reset | stale effect callback (React 19.2) | closed (React bug) | effects read live props (machine-runtime "stale reads"); a model step for submit with a controlled parent |
| Radix | [radix#3606](https://github.com/radix-ui/primitives/issues/3606) | misspelt callback prop | API typo | fixed with alias | `onVisibleChange` from the controllable convention, type-checked |
| Radix | source (`password-toggle-field.tsx`) | toggle `aria-hidden`/`tabIndex=-1` before hydration | handler not attached yet | design | our server render is already correct; parts are interactive after hydration only, as every button |
| Zag | source (`password-input.connect.ts`) | toggle works only with a mouse | `onPointerDown`, `tabIndex=-1` | design | press interactions + tab stop |
| Zag/Radix | source | name changes with state | label swap | design | stable name + `aria-pressed` |
| RA | [RA#9174](https://github.com/adobe/react-spectrum/issues/9174) | 1Password button in a modal not clickable | modal `inert` on extension nodes | dup of RA#8952 | covered by `outside-inert` keep-visible rule |
| Ariakit | [ariakit#863](https://github.com/ariakit/ariakit/issues/863) | dialog blocks 1Password | outside interaction blocked | closed | same |
| Reka | [Reka#2210](https://github.com/unovue/reka-ui/issues/2210) | password manager autofill fails on a multi-input control | autofill targets one field | closed | one native input; never split a credential |
| GOV.UK | blog (2021) | revealed password saved as autocomplete text | `type=text` on submit | hide on submit | hide on submit and reset |
| Platform | "spell-jacking" (otto-js, 2022) | revealed passwords sent to spellcheck services | `spellcheck` on a `type=text` field | `spellcheck=false` | keep `spellCheck=false` |
| Platform | Edge `::-ms-reveal` | two reveal buttons | native reveal in Edge | — | hide the native reveal while our trigger is mounted |

## Known pitfalls

- Pointer-only toggles (cause A) and toggles outside the tab order.
- Label + pressed state double meaning.
- Selection lost on `type` change; focus stolen from the input by a mouse press (keyboard
  closes on mobile).
- Forgetting to hide on submit (browser autocomplete stores the text).
- Field context not reaching the input (ark#3930).

## Testing notes

- `type` property and `aria-pressed` after each step; selection range before/after a pointer
  toggle (browser mode); submit and reset steps with a controlled parent; announcement only
  for the input-focused case.
- The driver locates the instance by the input's accessible name (no role); the toggle by
  role `button` inside the instance.

## Decisions

- **Built on Text Field**: same machine definition through the builder requested from
  `add-text-field` (preset: controllable `visible`, events `VISIBILITY.TOGGLE`,
  `VISIBILITY.HIDE`, a form-listening effect). Parts: Text Field's (`Root`, `Label`,
  `Description`, `ErrorMessage`, `Input`) plus `VisibilityTrigger` and `Indicator`
  (`aria-hidden`, `data-state`). No ClearTrigger, no CharacterCount by default (both remain
  available from Text Field, unchanged).
- **Input**: `type` `password`/`text`, `autoComplete` `current-password` default
  (`new-password` opt-in), `autoCapitalize="none"`, `autoCorrect="off"`, `spellCheck=false`.
- **Trigger**: button-like, tabbable, `aria-pressed`, `aria-controls`, constant name, press
  without focus for pointer/touch.
- **Hide** on submit (always) and reset (unless prevented); `readOnly` may still reveal,
  `disabled` may not.
- **`data-*`**: `data-state="visible|hidden"` on Root, Input, VisibilityTrigger, Indicator,
  plus Text Field's attributes.
- **Contract**: anchor = input's accessible name; actions `toggleVisibility`, `type`,
  `fill`; queries `isVisible`, `value`, `inputType`; trait `field-associated`.
- **Deliberately different**: `aria-pressed` + stable name (vs label swap / `aria-expanded`),
  tabbable trigger (vs Zag), caret restored in the same frame.

## Open questions

- Caps Lock indicator (`getModifierState("CapsLock")`) as a `data-caps-lock` attribute —
  out of scope until asked.
