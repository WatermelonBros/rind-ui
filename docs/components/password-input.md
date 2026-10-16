# Password Input

A [Text Field](text-field.md) for secrets with a visibility toggle that every input method can operate. The toggle keeps one name, keeps the caret where the user left it, and the password is hidden again on every form submit and reset. Value, IME handling and Field integration are Text Field's.

```tsx
import { PasswordInput } from "@rind-ui/react"

<PasswordInput.Root name="password">
  <PasswordInput.Label>Password</PasswordInput.Label>
  <PasswordInput.Input />
  <PasswordInput.VisibilityTrigger>
    <PasswordInput.Indicator />
  </PasswordInput.VisibilityTrigger>
  <PasswordInput.ErrorMessage />
</PasswordInput.Root>
```

## API

<!-- api:password-input -->

## Anatomy

| Part | `data-part` | Element |
|---|---|---|
| `PasswordInput.Root` | `root` | `<div>`; a Field when not inside one. |
| `PasswordInput.Label` / `Description` / `ErrorMessage` | `label` / `description` / `error-message` | The Field's parts. |
| `PasswordInput.Input` | `input` | `<input type="password">`, `type="text"` while shown. |
| `PasswordInput.VisibilityTrigger` | `visibility-trigger` | `<button>` in the Tab order. |
| `PasswordInput.Indicator` | `indicator` | `<span aria-hidden>` icon slot. |

`ClearTrigger` and `CharacterCount` are Text Field's parts, if you want them.

## Visibility

`visible` / `defaultVisible` / `onVisibleChange(visible, { reason })` control it. The reasons are `PRESS`, `SUBMIT` and `RESET`. A disabled field cannot be toggled; a read-only one can.

Style the icon from the Indicator's `data-state` (`visible` or `hidden`). It is the same on Root, Input and trigger.

## Form resets

- **Submit.** The form's `submit` event hides the password, prevented or not. The input is `type="password"` before the browser builds the form data, so a password manager never stores the clear text.
- **Reset.** A `reset` hides it unless a listener prevents it.
- A controlled `visible` gets a proposal (`false`); the parent decides.

## Trigger semantics

The trigger is a toggle button: `aria-pressed` holds the state and its name is always "Show password" (`messages.toggleLabel`).

- Changing the label with the state ("Hide password") plus `aria-pressed` makes a screen reader say it twice, and it reads as a contradiction.
- It stays in the Tab order: without it a keyboard user has no way to reveal the text.
- A mouse or pen press keeps focus and the caret in the input. A touch press moves no focus.
- When focus stays in the input, a polite "Password shown" / "Password hidden" is announced. The password itself never is.

## Privacy notes

- `spellcheck="false"`, `autocorrect="off"` and `autocapitalize="none"` in both states, so revealed text never reaches a spellcheck service.
- `autoComplete` defaults to `current-password`. Use `new-password` on sign-up and reset forms; any value passes through.
- Edge's own reveal button is hidden while a trigger is mounted.

## Password managers

Managers draw a badge at the inline end of the input. Leave room for it and for the trigger: reserve space with padding on the input, and do not let the trigger cover it.

## Accessibility notes

- The Label names the input. A password input has no ARIA role, so the contract locates it by its exact name.
- Field state (`disabled`, `invalid`, `required`) reaches the input and the trigger.

## Styling

Style the `data-*` attributes above. The theme package ships `@rind-ui/theme/password-input.css`.

## Testing

Contract actions: `type`, `fill`, `clear`, `blur`, `toggleVisibility`, `submitForm`, `resetForm`. Queries: `value`, `isVisible`, `inputType`, `toggleName`, `isInvalid`, `isDisabled`, `isComposing`.

```tsx
import { getPasswordInput } from "@rind-ui/testing"

render(<LoginForm />)
const password = getPasswordInput(screen, { name: "Password" })
await password.fill("hunter2")
await password.toggleVisibility()
expect(await password.inputType()).toBe("text")
expect(await password.toggleName()).toBe("Show password")
await password.submitForm()
expect(await password.isVisible()).toBe(false)
```

## Tested with

<!-- tested-with:password-input -->
_No manual screen-reader pass recorded yet._
<!-- /tested-with -->
