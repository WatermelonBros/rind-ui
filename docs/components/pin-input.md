# Pin Input

A fixed-length code (verification code, PIN) entered in **one native text input** drawn over presentational slots. Typing, paste, SMS and password-manager autofill, IME and screen readers all work as they do for one ordinary field. The Root is a Field, so labelling, description and validation work like any Field.

```tsx
import { PinInput } from "@rind-ui/react"

<PinInput.Root length={6} name="code" onValueComplete={verify}>
  <PinInput.Label>Verification code</PinInput.Label>
  <PinInput.Control>
    <PinInput.Input />
    {[0, 1, 2, 3, 4, 5].map((i) => (
      <PinInput.Slot key={i} index={i} />
    ))}
  </PinInput.Control>
  <PinInput.Description>Sent by SMS.</PinInput.Description>
  <PinInput.ErrorMessage />
</PinInput.Root>
```

## API

<!-- api:pin-input -->

## Anatomy

| Part | `data-part` | Element |
|---|---|---|
| `PinInput.Root` | `root` | `<div>`; a Field when not inside one. |
| `PinInput.Label` / `Description` / `ErrorMessage` | `label` / `description` / `error-message` | The Field's parts. |
| `PinInput.Control` | `control` | `<div>`, the positioning context for the input and the slots. |
| `PinInput.Input` | `input` | The one `<input>`; covers the Control and receives every pointer event. |
| `PinInput.Slot` | `slot` | `<div aria-hidden="true">` per position, with an `index` from 0 to `length - 1`. |

The number of Slots must equal `length`; a mismatch logs a development warning naming both numbers. Anything else inside the Control (a decorative separator such as `<span data-part="separator" aria-hidden="true">–</span>`) is yours to style. Slots expose `data-index`, `data-filled`, `data-active`, `data-caret` (the empty active slot) and `data-masked`.

## Why one input

Several inputs, one per digit, break what users and platforms expect: autofill fills one box, paste needs custom splitting, the screen reader announces six fields, and moving focus between boxes fights IME and the back button. A single input keeps all of that native, and the slots only show the value. The input is invisible and absolutely positioned over the slots, so a press anywhere lands on it.

## Autofill and password managers

The input has `autocomplete="one-time-code"` by default, so iOS and Android offer the code from a message. A password manager or a script that sets the input's `value` and dispatches a bubbling `input` event is read from the native event and applied (`onValueChange` with reason `AUTOFILL`). Set `autoComplete="off"` for a PIN that must not be offered or saved. The input is never given a visible autofill background; the slots show the state.

## Paste rules

A paste, drop or autofill is normalised before it is applied:

1. Whitespace, `-` and `.` are dropped, so "123-456" is "123456".
2. Characters are filtered by `validationType` (`numeric` default, `alphanumeric`, `alpha`) or `pattern`, after Unicode NFKC (full-width digits become ASCII) and your `sanitize`.
3. The result is truncated to `length`.
4. A full code (at least `length` characters) **replaces** the whole value. A shorter one is **inserted at the caret**, replacing the selection.

Typing a rejected character is refused before it is applied and calls `onValueInvalid(text)`. Deleting, cutting, undo and shortcuts are never refused.

## Caret model

The value is always contiguous from the first slot: there are no holes. The caret is collapsed and sits between 0 and the value's length. Pressing a slot puts the caret at that slot (pressing past the value puts it at the end). Typing before a filled slot replaces its character and moves on; typing the character the slot already holds only moves on; typing at the end appends. Backspace, Delete, arrows and ⌘/Ctrl+Backspace keep their native behaviour. The active slot is the one at the caret, or the last slot when the code is full. During an IME composition nothing is filtered or written until it ends.

## Accessibility

- Exactly one `textbox` is exposed, named by the Label; Tab stops on it once. Slots are `aria-hidden` and have no pointer events.
- The Description and the error message are linked with `aria-describedby`, as for any Field.
- `mask` renders the input as `type="password"` and shows `maskChar` in filled slots.
- The current value is read by the screen reader from the input itself, so there is no live region to keep in sync.

## WebOTP recipe

Browsers that support WebOTP can read the code from an SMS. It is consumer code that sets the value:

```tsx
function SmsCode() {
  const [code, setCode] = useState("")

  useEffect(() => {
    if (!("OTPCredential" in window)) return
    const abort = new AbortController()
    navigator.credentials
      .get({ otp: { transport: ["sms"] }, signal: abort.signal } as CredentialRequestOptions)
      .then((credential) => {
        if (credential && "code" in credential) setCode(String(credential.code))
      })
      .catch(() => {}) // dismissed or unsupported: the user types it
    return () => abort.abort()
  }, [])

  return (
    <PinInput.Root length={6} value={code} onValueChange={setCode}>
      {/* Label, Control, Input and six Slots */}
    </PinInput.Root>
  )
}
```

## Styling

Style the `data-*` attributes above: `data-complete`, `data-composing`, `data-focus-visible`, `data-disabled`, `data-readonly` and `data-invalid` on every part, and the slot attributes. The Control is `position: relative`; lay the slots out with flex or grid and give the input `position: absolute; inset: 0; opacity: 0`.

## Testing

Contract actions and queries are listed in the API above. Use the driver:

```tsx
import { getPinInput } from "@rind-ui/testing"

render(<VerificationForm />)
const code = getPinInput(screen, { name: "Verification code" })
await code.fill("123456")
expect(await code.value()).toBe("123456")
expect(await code.isComplete()).toBe(true)
expect(await code.slots()).toHaveLength(6)
```

## Tested with

<!-- tested-with:pin-input -->
_No manual screen-reader pass recorded yet._
<!-- /tested-with -->
