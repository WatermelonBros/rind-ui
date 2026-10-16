## Why

Numbers are the form input with the most locale and interaction traps: decimal and group
separators, currency, percent, units, Arabic/Persian/Hindi digits, full-width IME digits,
typed text that is not yet a number, clamping and snapping, press-and-hold steppers that
must not take focus on touch, iOS keypads without a minus key. Five libraries ship it and
their bug history (45 entries in the research note) repeats the same failures: the typed
text and the number drift apart (zag#3444, base-ui#5424), Enter submits a stale value
(react-spectrum#9671), touch scrolls change the value (react-spectrum#8472), held keys
flood the screen reader (react-spectrum#4157). Reado uses five native `type=number` inputs
that it will migrate.

Research: [number-input](../../../docs/research/number-input.md) ·
[text-field](../../../docs/research/text-field.md) · [field](../../../docs/research/field.md) ·
[accessibility](../../../docs/research/accessibility.md) §5–§7, §9 ·
[assistive-tech-and-a11y-testing](../../../docs/research/assistive-tech-and-a11y-testing.md) causes G, I, J ·
[native-platform](../../../docs/research/native-platform.md) §8, §14

Depends on: `add-foundations`, `add-a11y-foundations` (`press-interactions` press without
focus and touch cancel, `keyboard-interactions` logical keys and IME guard,
`interaction-modality`, `announcer`, `i18n-messages` locale and number formatting,
`a11y-quirks`, `platform-and-preferences`), `add-field` (`field`, `field-control`,
`field-validation`), `add-text-field` (Root-as-Field), `add-checkbox` (`hidden-form-input`),
`add-button` (`button-like-element`), `add-slider` (step snapping and decimal rounding),
`add-progress` (`valued` trait expectations), `add-theme-system`.

## What Changes

- A public **Number Input** component: `Root` (a Field when not inside one), `Label`,
  `Description`, `ErrorMessage`, `Control`, `Input`, `IncrementTrigger`, `DecrementTrigger`,
  and an automatic hidden `<input type="number">` for forms and range/step validity.
- Value `number | null` (`value` / `defaultValue` / `onValueChange`), `onValueCommit` once
  per interaction, `onInputValueChange(text)` while typing. Typing never changes the value;
  blur and Enter commit (parse, clamp and snap with `commitBehavior: "snap"`, or keep and
  validate with `"validate"`).
- `role="spinbutton"` with `aria-valuenow/min/max/valuetext`; keyboard ArrowUp/Down,
  Shift+Arrow and PageUp/PageDown (large step), Home/End only with a bound, Enter commit
  before implicit submission; IME-safe; optional wheel (`allowWheel`).
- Steppers: out of the tab order, `aria-disabled` at a bound, named "Increase {label}",
  press without focus, press-and-hold auto-repeat (`spinOnPress`, `spinDelay`,
  `spinInterval`), touch steps on release and cancels on scroll.
- Locale-aware typing filter, paste, parsing and formatting through a new shared capability
  **`number-parsing`** (numbering systems, currency, percent, units, accounting, mobile
  keypad separators).
- Announcements only where the AT cannot see the change (stepper presses from touch or
  assistive technology, commits that rewrote the typed text), polite and keyed.
- `field-control` implementation, contract and driver (`getNumberInput`), model-based tests,
  theme stylesheet (family `field`), stories, docs page.

## Capabilities

### New Capabilities

- `number-input`: the Number Input component — anatomy, value and commit model, keyboard,
  steppers and press-and-hold, wheel, ARIA and announcements, form and Field integration,
  data attributes, contract, theme.
- `number-parsing`: locale-aware parsing, partial-input validation and formatting of numbers
  typed by users, shared by Number Input and later numeric fields (Color Channel Field,
  numeric Editable).

### Modified Capabilities

None. Additions needed in other changes are listed in design.md under "Requests to other
changes".

## Non-goals

- Scrub areas / pointer-lock dragging (Base UI, Zag) and a ValueText part.
- Live formatting while typing (react-spectrum#6156), masks, expression evaluation
  (base-ui#2152), scientific notation input (base-ui#414).
- `bigint` or arbitrary-precision values; values outside ±`Number.MAX_SAFE_INTEGER`.
- Alt+Arrow small step (Base UI, Zag).
- Framework adapters other than React; fx.

## Impact

- `packages/core`: `components/number-input/` (machine, connect, contract, messages),
  `i18n/number-parser.ts` (`number-parsing`), first use of the shared step math requested
  from `add-slider`.
- `packages/react/src/number-input/`, `@rind-ui/testing` (`getNumberInput`),
  `@rind-ui/theme/number-input.css`, stories, docs.
- **New runtime dependency** `@internationalized/number` (the parser React Aria, Zag, Reka and
  Kobalte use) for `@rind-ui/core`: allowed by decision record 0009 (accepted 2026-10-14);
  added in task 0.2 with a tree-shaking size check.
- Reado: `settings/fields.tsx`, `AnywhereDialog.tsx` and `BrowserPanel.tsx` `type=number`
  inputs migrate (draft-on-blur becomes `onValueCommit`; the zoom field uses `style:
  "percent"`).
