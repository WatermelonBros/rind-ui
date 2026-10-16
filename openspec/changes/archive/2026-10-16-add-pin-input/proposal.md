## Why

Verification codes are typed, pasted, filled from SMS (`autocomplete="one-time-code"`) and
filled by password managers; WCAG 2.2 3.3.8 requires all of that to work. Five libraries
ship a pin/OTP input; four render one `<input>` per character and their bug history is a
list of the same failures: iOS SMS autofill writes the wrong digits (zag#2118, radix#3641),
password managers fill nothing (reka-ui#2210), pastes are truncated or overflow (zag#470,
radix#3550), Tab is trapped (reka-ui#2943), screen readers hear six edit fields. The
single-input design (`input-otp`, Bits UI) avoids these by construction but has visual
limits (input-otp#32, #31) that a headless library can fix with slot geometry.

Research: [pin-input](../../../docs/research/pin-input.md) ·
[text-field](../../../docs/research/text-field.md) · [field](../../../docs/research/field.md) ·
[accessibility](../../../docs/research/accessibility.md) §1.1 (3.3.8), §6 ·
[native-platform](../../../docs/research/native-platform.md) §14

Depends on: `add-foundations`, `add-a11y-foundations` (`keyboard-interactions` IME guard,
`interaction-modality`, `hidden-content`, `i18n-messages`, `platform-and-preferences`),
`add-field` (`field`, `field-control`, `field-validation`), `add-text-field` (Root-as-Field),
`add-theme-system`.

## What Changes

- A public **Pin Input** component: `Root` (a Field when not inside one), `Label`,
  `Description`, `ErrorMessage`, `Control`, **one** native `Input` overlaying the slots, and
  presentational `Slot` parts (`aria-hidden`).
- Value: a string of at most `length` characters, controllable, contiguous (no holes);
  `onValueComplete`, `autoSubmit`.
- Filtering (`validationType` numeric/alphanumeric/alpha or a per-character `pattern`,
  `sanitize`), paste and autofill normalisation (whitespace and separators stripped,
  truncated), IME-safe, full-width digits normalised.
- Caret model: collapsed caret, typing over a filled slot replaces it, a press on a slot
  places the caret there (by geometry), deletions are native.
- `autocomplete="one-time-code"`, `inputmode`, `maxlength`, anchored `pattern`, `required`
  on the one input, which is the form control; Enter never prevented.
- Slot `data-*` (`data-filled`, `data-active`, `data-caret`, `data-masked`), contract and
  driver (`getPinInput`), model-based tests, theme (family `field`), stories, docs page.

## Capabilities

### New Capabilities

- `pin-input`: the Pin Input component — anatomy, value, filtering, paste and autofill, caret
  and slot model, completion, keyboard, ARIA, form and Field integration, data attributes,
  contract, theme.

### Modified Capabilities

None. Additions needed in other changes are listed in design.md under "Requests to other
changes".

## Non-goals

- One native input per slot (rejected in design).
- WebOTP (`navigator.credentials.get({ otp })`): a docs recipe that sets `value`.
- Countdown/resend timers, separators as parts (consumer markup between slots).
- Framework adapters other than React; fx.

## Impact

- `packages/core`: `components/pin-input/` (machine, connect, contract, messages, `slot-model.ts`).
- `packages/react/src/pin-input/`, `@rind-ui/testing` (`getPinInput`),
  `@rind-ui/theme/pin-input.css`, stories, docs.
- Uses the injected-style helper requested from `add-a11y-foundations` (transparent selection
  and autofill paint on the overlay input).
- No new runtime dependency. Reado does not use a pin input today.
