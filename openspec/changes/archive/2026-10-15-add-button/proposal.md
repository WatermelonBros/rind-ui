## Why

Button is the simplest pressable component and the base of the whole boolean/press
family: Toggle, Switch and Checkbox controls, and every trigger later, are
button-like elements with the same element, substitution and disabled rules. Five of
the libraries we studied got one of those rules wrong (default `type`, links given
`role="button"`, disabled links still tabbable, focused buttons disabled into
`<body>`), so the rules are specified once here, on top of `add-a11y-foundations`'
press interactions.

Research: [button](../../../docs/research/button.md) ·
[accessibility](../../../docs/research/accessibility.md) §1.4, §5 ·
[assistive-tech-and-a11y-testing](../../../docs/research/assistive-tech-and-a11y-testing.md) cause A ·
[native-platform](../../../docs/research/native-platform.md) §3

Depends on: `add-foundations` (machine runtime, `render` substitution, contracts,
drivers, `testMachine`) and `add-a11y-foundations` (press interactions, modality and
focus attributes, announcer, messages).

## What Changes

- A public **Button** component: machine (`idle` / `pending`), connect, React part,
  contract and driver, stories, theme stylesheet, docs page.
- `onPress` / `onPressStart` / `onPressEnd` callbacks with modality, fired once per
  activation from every input (pointer, keyboard, touch, assistive technology).
- A **pending** state that keeps focus, ignores activation, keeps hover and focus
  events, prevents (implicit) form submission and announces itself politely through
  the Announcer.
- The **shared `button-like-element` capability**: default native `<button
  type="button">`, `type` only on native buttons, `render` substitution (links keep
  link semantics; generic elements get role, `tabIndex` and keyboard activation),
  disabled vs `focusableWhenDisabled`, disabled `<fieldset>` reflection, keyboard
  rules per role delegated to press interactions, and the shared `data-*` attributes.
  It is specified once here and reused by `add-toggle`, `add-checkbox` (and through it
  `add-switch` and `add-checkbox-group`) and every later trigger part.

## Capabilities

### New Capabilities

- `button`: the Button component — activation callbacks, pending state, parts and
  `data-*`, messages, contract and driver.
- `button-like-element`: the element, substitution, disabled and keyboard rules every
  button-like part in rind-ui follows (shared).

### Modified Capabilities

None.

## Non-goals

- Toggle buttons (`aria-pressed`) — `add-toggle`. Menu buttons, disclosure triggers —
  their components.
- Button groups / toolbars (roving focus) — Toolbar and Toggle Group changes.
- A Link component; `href` on Button is just `render={<a href>}`.
- Reading React's `useFormStatus` automatically into `pending` (documented recipe
  only).
- Invoker commands (`commandfor` / `command`) behaviour — attributes pass through only
  (native-platform §3).
- Visual loading indicators (spinners) — consumer content.
- Framework adapters other than React; fx.

## Impact

- New: `packages/core/src/components/button/` (`button.machine.ts`,
  `button.connect.ts`, `button.contract.ts`, `button.messages.ts`) and the shared
  `packages/core/src/components/shared/button-like.ts` (connect helper used by every
  button-like part); `packages/react/src/button/`; `getButton` driver export in
  `@rind-ui/testing`; `packages/theme/src/button.css`; stories and docs page.
- No new dependencies.
