## Why

A "show password" toggle lets users check what they typed and removes the need for
confirm-password fields (GOV.UK's result). It looks trivial and is routinely built wrong: Zag's
toggle reacts only to `pointerdown` and sits outside the tab order, so keyboard and
screen-reader users cannot use it; Zag and Radix change the toggle's name with its state;
revealed passwords stay visible after submit and are saved as plain-text autocomplete entries
(GOV.UK, radix#4157); revealed text is sent to enhanced-spellcheck services unless
`spellcheck` is off. Two libraries ship it (Ark, Radix) and Reado's vault unlock uses a plain
password input.

Research: [password-input](../../../docs/research/password-input.md) ·
[text-field](../../../docs/research/text-field.md) · [toggle](../../../docs/research/toggle.md) ·
[field](../../../docs/research/field.md) · [accessibility](../../../docs/research/accessibility.md) §5, §7

Depends on: `add-foundations`, `add-a11y-foundations` (`press-interactions` press without
focus, `interaction-modality`, `announcer`, `i18n-messages`), `add-text-field` (`text-field`
machine and parts; the builder requested in design.md), `add-field`, `add-button`
(`button-like-element`), `add-toggle` (the stable-name and explicit `aria-pressed` rules),
`add-pin-input` (the injected-style helper it requests), `add-theme-system`.

## What Changes

- A public **Password Input** component: Text Field's parts (`Root`, `Label`,
  `Description`, `ErrorMessage`, `Input`) plus `VisibilityTrigger` and `Indicator`.
- Controllable `visible` (`visible` / `defaultVisible` / `onVisibleChange`); the input's
  `type` follows it; it returns to hidden on every form submit and on a form reset.
- `VisibilityTrigger`: a tabbable toggle button with `aria-pressed`, a constant name
  ("Show password"), `aria-controls`, activation through press interactions; a pointer press
  keeps focus and the caret in the input.
- Input defaults for passwords: `autoComplete="current-password"` (or `new-password`),
  `spellCheck=false`, `autoCorrect="off"`, `autoCapitalize="none"`; Edge's native reveal
  button hidden while the trigger is mounted.
- A polite "Password shown"/"Password hidden" announcement when the toggle was pressed while
  focus stayed in the input.
- Contract and driver (`getPasswordInput`), model-based tests, theme (family `field`),
  stories, docs page.

## Capabilities

### New Capabilities

- `password-input`: the Password Input component — anatomy, visibility state and its
  resets, the visibility trigger's semantics and focus behaviour, input attributes,
  announcements, data attributes, contract, theme.

### Modified Capabilities

None. The Text Field machine builder needed here is requested from `add-text-field` (design.md).

## Non-goals

- Strength meters, rules lists, Caps Lock warnings, "generate password".
- Revealing for a limited time or per character (mobile-style last-character reveal).
- Confirm-password matching (Form's cross-field `validate`).
- Framework adapters other than React; fx.

## Impact

- `packages/core`: `components/password-input/` (preset on the Text Field machine, connect,
  contract, messages).
- `packages/react/src/password-input/`, `@rind-ui/testing` (`getPasswordInput`),
  `@rind-ui/theme/password-input.css`, stories, docs.
- Reado: `molecules/VaultBar.tsx` password field → `PasswordInput` (its Enter handler stays).
- No new runtime dependency.
