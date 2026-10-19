## Why

Multi-step flows (checkout, onboarding, long forms) need an indicator and navigation that
assistive technology understands as an ordered sequence. The two headless implementations
get the basics wrong:
- Zag uses tab semantics with invalid ownership (zag#1791), and its triggers submitted forms
  (zag#3259).
- Reka's linear mode lets a click on the next step skip its validation (reka#2437), and it
  counted unmounted steps (reka#2777).
- Neither moves focus or announces anything when the step changes.

Research: [stepper](../../../docs/research/stepper.md) ·
[accessibility](../../../docs/research/accessibility.md)

Depends on: `add-foundations`, `add-a11y-foundations` (announcer, focus), `add-theme-system`.

## What Changes

- A public **Stepper** in `@rind-ui/core` (machine, connect, contract, messages, meta) and
  `@rind-ui/react` (parts `Root`, `List`, `Item`, `Trigger`, `Indicator`, `Title`,
  `Description`, `Separator`, `Content`, `PrevTrigger`, `NextTrigger`, `Progress`).
- Semantics: an ordered list with `aria-current="step"`. Steps the user can reach are
  buttons, the others plain text; each step's name includes its status.
- A controllable, cancellable `step` (reasons `next`, `prev`, `select`). `linear`
  (back freely, forward only through Next), plus disabled and completed steps.
- On the user's step change, focus moves to the step's content region and
  "Step 2 of 4: Shipping" is announced.
- `getStepper` driver, theme stylesheet, site examples, docs page.

## Impact

- New capability `stepper`. Updates the roadmap row "Steps" to Stepper.
