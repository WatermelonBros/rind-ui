## Context

See proposal.md for why. Segmented Control adds no behaviour of its own: the machine is
`add-radio-group`'s exported `radioGroupMachine`, the indicator is `add-tabs`'
`core/dom/selection-indicator.ts`, the segment element is `add-button`'s
`button-like-element`, form participation is `add-checkbox`'s `hidden-form-input`.
Semantics decision and bug history:
[segmented-control.md](../../../docs/research/segmented-control.md).

## Goals / Non-Goals

**Goals:**
- A separate public component (scope, parts, contract, driver, docs) with zero duplicated
  behaviour.
- The indicator bugs of Ark/Zag and React Aria impossible by construction.

**Non-Goals:**
- Any machine change; toggle or tab semantics; multiple selection (proposal).

## Decisions

### Radio semantics, Radio Group's machine

The research note's evidence (both shipping implementations are radio groups; "one of N"
is lost with toggle buttons, base-ui#3525; radio roles demand radio keys, radix#4119)
fixes the semantics. Reusing the machine — not wrapping the Radio Group *component* (Ark,
Kobalte) — keeps the scope, parts and data attributes our own (Ark leaked
`data-scope="radio-group"`, ark#2629) while every behavioural rule stays in one place.

### Machine (from `add-radio-group`)

```
   idle ⇄ focused (FOCUS / BLUR)
focused: NAVIGATE [isKeyboard ∧ ¬readOnly ∧ checksOnMove] → navigate, selectHighlighted
         NAVIGATE                                         → navigate
root:    PRESS [¬readOnly] → highlight, select, focusControl
         COLLECTION.CHANGE → repairCollection · FORM.RESET → resetToDefault
         $sync:value / $reverted
```

The machine's `INDICATOR.MEASURE { box, cause }` event (declared by `add-radio-group`
for this purpose, stored in context, never read by Radio Group's connect) carries the
indicator measurement, so connect derives the custom properties from state like every
other attribute (react-spectrum#10570 came from imperative styles).

### Connect (`segmented-control.connect.ts`)

- `root`: radio-group root props (role, ARIA states, keydown with orientation `both`)
  with `data-scope="segmented-control"`, default `orientation: "horizontal"`, `position:
  relative` is left to the theme (headless).
- `item`: radio-group item-control props (`role="radio"`, `aria-checked`, roving
  `tabIndex`, press) on the single segment element, plus the hidden-input props rendered
  by the part as a sibling; ids from `itemId("segmented-control", root, "item", key)`.
- `label`: radio-group label props.
- `indicator`: `selection-indicator` props (six custom properties, `data-resizing`,
  `hidden`, `aria-hidden`).
- Development warning for a segment with no text content and no `aria-label`.

### Shared modules

`core/components/radio-group` (machine), `core/dom/selection-indicator.ts`,
`core/collection` (`composite.ts`, `navigation.ts`, `selection.ts`), `core/dom`
(`item-registry.ts`, `press.ts`, `modality.ts`, `keyboard.ts`, `focus-safely.ts`),
`hidden-form-input`, `core/ids.ts`.

### Contract

Event mapping as Radio Group's (`$sync:value` and `COLLECTION.CHANGE` → prop steps,
`FORM.RESET` and `INDICATOR.MEASURE` → `{ skip: "…" }`).

Same shape as Radio Group's with names fitting the control (`select`, `segments`,
`selected`, `focusedSegment`, `isDisabled`, `formValue`), scope `segmented-control`,
traits `composite-roving`, `selectable`, `directional`. Argument classes: no value,
disabled segment, read-only, required.

### Parts (React)

`SegmentedControl.Root` (`useMachine(radioGroupMachine)` + indicator effect),
`SegmentedControl.Label`, `SegmentedControl.Item` (registers via `use-collection-items`,
renders the hidden input as its next sibling inside a fragment), `SegmentedControl.Indicator`.
Thin.

### Theme

Component tokens `--rind-segmented-control-*` (tier 3 of decision 0007, proposed), each defaulting to a semantic token; the stylesheet reads only those. `packages/theme/src/segmented-control.css`: pill container, indicator background from the
custom properties with a transform/size transition, `[data-resizing]` and reduced motion
→ no transition, selected segment border under forced colors, 24 px minimum segment
height, focus ring from `base.css`.

## Risks / Trade-offs

- [Consumers expecting arrows to only move focus (toggle-group habit)] → documented;
  Toggle Group and Tabs (manual) are linked from the docs.
- [Indicator measurements depend on layout, which the oracle cannot compute] →
  `INDICATOR.MEASURE` is excluded from generated paths (it is an environment event); its
  scenarios are browser tests.
- [Dependency on `add-tabs` for the indicator module] → the module is generic
  (`selection-indicator` capability); whichever of the two lands first ships it.

## Migration Plan

Reado: replace `@ark-ui/react` `SegmentGroup` with `SegmentedControl` during the wave-1
migration; `ItemText` + `ItemControl` + `ItemHiddenInput` collapse into `Item`;
`--left/--width` variables become `--rind-indicator-left/width`.

## Open Questions

None that change the specs.
