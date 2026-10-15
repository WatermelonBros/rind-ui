## Why

Toolbars, editors and media controls need a two-state button (Bold, Mute, Pin) that
screen readers announce as "toggle button, pressed". Seven of nine libraries ship one;
hand-rolled versions drop `aria-pressed` when false, change the label with the state,
or break when composed with a tooltip. Toggle is also the item Toggle Group and
Toolbar build on, so it comes right after Button in wave 1.

Research: [toggle](../../../docs/research/toggle.md) ·
[accessibility](../../../docs/research/accessibility.md) ·
[assistive-tech-and-a11y-testing](../../../docs/research/assistive-tech-and-a11y-testing.md) ·
[native-platform](../../../docs/research/native-platform.md)

Depends on: `add-foundations` (machine runtime, controllable values, contracts,
drivers, `testMachine`), `add-a11y-foundations` (press interactions, modality and
focus-visible, invariants) and `add-button` (the shared `button-like-element`
capability: native `<button type="button">`, `render` substitution, disabled and
`focusableWhenDisabled`, keyboard activation per role, focus/press/hover attributes).

## What Changes

- A public **Toggle** component: machine (`off` / `on`, controllable `pressed`),
  connect, React parts `Toggle.Root` and `Toggle.Indicator`, contract and driver
  (`getToggle`), stories, theme stylesheet and docs page.
- `aria-pressed` always explicit; activation only through press events (pointer,
  touch, Enter, Space, assistive-technology click), exactly once per activation.
- An accessible name that does not change with the state, enforced by the contract
  (the anchor is re-located by name after every step) and a development warning; the
  `Indicator` part swaps icons instead.
- `data-state="on|off"`; `data-pressed` keeps its press-in-progress meaning from
  `add-a11y-foundations`.

## Capabilities

### New Capabilities

- `toggle`: the Toggle component — anatomy, pressed state and its control, ARIA and
  keyboard behaviour, data attributes, contract, theme expectations.

### Modified Capabilities

None. Button-like behaviour is specified once in `add-button`'s `button-like-element`
and only referenced here.

## Non-goals

- Toggle Group (single/multiple selection, roving focus) — its own change; Toggle is
  designed so a group can own `pressed` through the controlled props.
- Form participation (`name`/`value`, hidden input) — a submitted value is a Checkbox
  or Switch job (Reka is the only library that does it).
- `aria-pressed="mixed"` (base-ui#952) and a `pending` state (RA#7256).
- Toolbar integration; framework adapters other than React; fx.

## Impact

- New: `packages/core/src/components/toggle/` (`toggle.machine.ts`,
  `toggle.connect.ts`, `toggle.contract.ts`), `packages/react/src/toggle/`,
  `packages/theme/src/toggle.css`, Storybook stories, docs page, `getToggle` in
  `@rind-ui/testing`.
- No new dependencies.
