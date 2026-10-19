## Why

Hover Card (Preview Card, Link Preview, Hovercard, PreviewTrigger) is shipped by
eight libraries and is the base of the AI Citation primitive. Most libraries make
it pointer-only (Radix even forces `tabindex="-1"` on its content), and its bug
history is dominated by child layers (Select, Menu, Tooltip) closing the card,
pointer leave closing it while focus is inside, and missing grace areas. With
`hover-intent` (from `add-tooltip`) and `non-modal-tab-order` (from
`add-popover`) specified, Hover Card is mostly composition.

Research: [docs/research/hover-card.md](../../../docs/research/hover-card.md) ·
[tooltip](../../../docs/research/tooltip.md) · [popover](../../../docs/research/popover.md) ·
cross-cutting [accessibility](../../../docs/research/accessibility.md) ·
[assistive-tech-and-a11y-testing](../../../docs/research/assistive-tech-and-a11y-testing.md) ·
[native-platform](../../../docs/research/native-platform.md) (§3 `interestfor`).

**Depends on** `add-foundations`, `add-a11y-foundations`,
`add-overlay-infrastructure`, `add-floating-positioning`, and on `add-tooltip`
(`hover-intent`) and `add-popover` (`non-modal-tab-order`).

## What Changes

- A `hover-card` component (machine, connect, contract, React parts `Root`,
  `Trigger` (an `a`), `Positioner`, `Content`, `Arrow`, shared `Portal`).
- Opens on pointer hover after a delay and on keyboard focus of the trigger after
  the same delay; never on touch, pointer focus, screen-reader cursor focus or
  layer-initiated focus.
- Keyboard-reachable: Tab from the trigger enters the content, Escape closes it
  (via `non-modal-tab-order` and the layer stack).
- Stays open while focus is inside, while the trigger has keyboard focus, and
  while a descendant layer is open; closes on leaving the hover zone, blur,
  Escape, outside press.
- Non-modal `dialog` named by the trigger; trigger `aria-haspopup="dialog"`,
  `aria-expanded`, `aria-controls`.
- Contract (`hoverCardContract`) and driver; stories, theme stylesheet, docs page.

## Capabilities

### New Capabilities

- `hover-card`: the Hover Card component — parts, opening/closing rules, keyboard
  access, ARIA and `data-*` per part, contract and driver.

### Modified Capabilities

None. It reuses `hover-intent` (`add-tooltip`) and `non-modal-tab-order`
(`add-popover`) unchanged, and the infrastructure capabilities as specified.

## Non-goals

- Opening on touch (React Aria's long press): it replaces the platform's link
  long-press menu; revisit with Citation, whose trigger is not a link.
- A disclosure button next to the trigger (Ariakit `HovercardDisclosure`).
- Sharing the tooltip delay group (React Aria does); multiple/detached triggers;
  modal mode; text-selection containment.
- `aria-describedby` from the trigger to the card.
- Native `interestfor`.
- Framework adapters other than React; fx.

## Impact

- New code: `packages/core/src/components/hover-card/*`,
  `packages/react/src/hover-card/*`, driver in `@rind-ui/testing`,
  `packages/theme/src/hover-card.css`, stories, docs page.
- No new runtime dependency.
- `docs/components.md`: Hover Card status → `spec`.
