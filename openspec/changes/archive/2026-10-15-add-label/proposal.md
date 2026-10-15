## Why

Five of the nine libraries ship a standalone Label, and every form control needs the same
label behaviour: a native `<label>` where the control is labelable, focus forwarding where it
is not, and no text selection on a double click. The bug history shows each library getting
the small details wrong (an invented `role="label"`, a selection guard that broke nested
inputs, links made unclickable, popups opened by a label). This change specifies the Label
and its interaction rules once, so `control-label` (`add-checkbox`) and `Field.Label`
(`add-field`) share them.

Research: [label](../../../docs/research/label.md) ·
[accessibility](../../../docs/research/accessibility.md) §2 ·
[assistive-tech-and-a11y-testing](../../../docs/research/assistive-tech-and-a11y-testing.md) §1.2 A ·
[checkbox](../../../docs/research/checkbox.md) (label activation)

Depends on: `add-foundations` (contracts, drivers, react adapter), `add-a11y-foundations`
(`interaction-modality`, `press-interactions`, `element-ids`) and `add-checkbox`
(`control-label`: one activation per label click, label clicks are pointer presses).

## What Changes

- A public **Label** component: one part, `Root`, rendering a native `<label>`. It accepts
  `htmlFor`, wraps controls for implicit association, and forwards every native attribute.
- **Shared capability `label-interaction`**, specified here once and used by the Label,
  `control-label` and `Field.Label`:
  - the guarded double-click text-selection rule;
  - no cancelled clicks, so links and buttons inside a label keep working;
  - focus-only forwarding when the target is not labelable;
  - a development warning for a `for` that points at a missing or non-labelable element;
  - a "label focuses, never opens" rule for popup triggers.
- The label **contract and driver** (`getLabel`), plus stories, a theme stylesheet and a docs
  page.

## Capabilities

### New Capabilities

- `label`: the Label component: anatomy, native association, attributes, contract, theme.
- `label-interaction`: the interaction rules every rind-ui label follows (selection guard,
  click pass-through, focus forwarding for non-labelable targets, the popup-trigger rule,
  development warnings).

### Modified Capabilities

None. `control-label` (`add-checkbox`) should adopt `label-interaction`. That request is
listed in design.md under "Requests to other changes".

## Non-goals

- Labels bound to a control's state (`data-disabled`, `data-invalid` on the label): those are
  `control-label` and `Field.Label`.
- Required indicators. A visible `*` is the consumer's markup; `aria-hidden` on it is
  documented.
- Setting `aria-labelledby` on a consumer's element: Label never mutates other elements.
- Framework adapters other than React; fx.

## Impact

- `packages/core`: `components/label/` (connect, contract, messages: none) and
  `components/shared/label-interaction.ts`.
- `packages/react/src/label/`, `@rind-ui/testing` (`getLabel`, a `clickLabel` adapter input
  that replays the browser's label activation), `@rind-ui/theme/label.css`, stories, docs.
- No new runtime dependency.
