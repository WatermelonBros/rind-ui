## Why

Tooltip is shipped by all nine libraries, used throughout Reado (wave 1, build
order step 2), and has the most-reported bug classes of any small component:
tooltips opening on focus that was not user intent (autofocus, focus restore,
window refocus, focus-caused scroll), global delay-group state that leaks or
never fires, hover logic that sticks when the page scrolls, and descriptions that
screen-reader browse modes never hear because the tooltip only exists while open.
The hover-intent and delay-group pieces it needs are also needed by Hover Card,
submenus and Navigation Menu, so they are specified once, here.

Research: [docs/research/tooltip.md](../../../docs/research/tooltip.md) (sources,
bug history, accessibility, decisions) · cross-cutting
[accessibility](../../../docs/research/accessibility.md) ·
[assistive-tech-and-a11y-testing](../../../docs/research/assistive-tech-and-a11y-testing.md)
(§1.4 Tooltip) · [native-platform](../../../docs/research/native-platform.md)
(§3 `interestfor`) · [overlay-infrastructure](../../../docs/research/overlay-infrastructure.md) ·
[floating-positioning](../../../docs/research/floating-positioning.md).

**Depends on** `add-foundations`, `add-a11y-foundations` (hover never from touch,
modality, focus-visible, press, ids, messages), `add-overlay-infrastructure`
(layer stack, dismiss, presence, portal) and `add-floating-positioning` (`popup`
preset with side `top`, contract fragment). Independent of `add-popover`; tests
compose with it once both exist.

## What Changes

- A `tooltip` component (machine, connect, contract, React parts `Root`,
  `Trigger`, `Positioner`, `Content`, `Arrow`, shared `Portal`).
- Description tooltips (`role="tooltip"`, permanent `aria-describedby`) and label
  tooltips (`aria-labelledby`, no role); the content stays mounted, hidden, while
  closed so the reference always resolves.
- Opens on hover (after a delay, mouse and pen only) and on keyboard focus
  (immediately); never on pointer focus, screen-reader cursor focus, window
  refocus, or focus moved by a layer's initial focus or focus restore.
- Always hoverable (WCAG 1.4.13), dismissible with Escape through the layer
  stack, closes on trigger press, outside press, blur, and when the trigger moves
  out from under the pointer. Never opens on touch.
- Development warnings for a natively disabled or non-focusable trigger,
  interactive content, and a name equal to the description.
- New shared capability **`hover-intent`**: open/close delays, the hover zone
  (trigger, content, descendant layers, grace area), in-transit suppression of
  other triggers, re-evaluation on scroll, leaving the document. First consumer:
  Tooltip; reused by `add-hover-card`, later submenus and Navigation Menu.
- New shared capability **`delay-group`**: one group per document, one open
  member at a time, warm window with skip delay, membership tied to the service
  lifetime. First consumer: Tooltip; reusable by Navigation Menu.
- Contract (`tooltipContract`) and driver; stories, theme stylesheet, docs page.

## Capabilities

### New Capabilities

- `tooltip`: the Tooltip component — parts, opening/closing rules, description
  and label wiring, ARIA and `data-*` per part, keyboard, touch, disabled
  triggers, composition, contract and driver.
- `hover-intent`: how a hover-opened layer decides to open and close from pointer
  movement — delays, hover zone, grace area, in-transit suppression, descendant
  layers, scroll and document-leave rules — shared by every hover-opened layer.
- `delay-group`: warm-up / cool-down shared across members of a group (one open
  at a time, skip delay, instant marking, lifetime), shared by tooltips and later
  Navigation Menu triggers.

### Modified Capabilities

None. Capabilities from unarchived changes (`machine-runtime`,
`component-contract`, `test-drivers`, `model-based-testing`, `react-adapter`,
`press-interactions`, `interaction-modality`, `a11y-invariants`, `element-ids`,
`i18n-messages`, `layer-stack`, `dismissable-layer`, `presence`, `portal`,
`floating-positioning`) are used as specified.

## Non-goals

- Toggletips (click-to-show info buttons): use Popover.
- Opening on touch (tap or long press): tooltips are pointer and keyboard only;
  documented, with the accessible alternatives.
- Following the cursor (Base UI `trackCursorAxis`), multiple or detached triggers
  per tooltip, an `aria-label` override on the content, opting out of hoverable
  content (Radix `disableHoverableContent`, Zag `interactive: false`).
- A `Provider`/`Group` part to scope delay groups: one group per document;
  delays are set per tooltip (design systems wrap Tooltip once).
- Base UI's "rest" delay (open only after the pointer stops); open question in the
  research note.
- Native `popover="hint"`, `interestfor`, the `title` attribute.
- Framework adapters other than React; fx.

## Impact

- New code: `packages/core/src/components/tooltip/*`,
  `packages/core/src/dom/hover-intent.ts`, `packages/core/src/dom/delay-group.ts`
  (+ capability types in `core/env`), `packages/react/src/tooltip/*`, driver in
  `@rind-ui/testing`, `packages/theme/src/tooltip.css`, stories, docs page.
- No new runtime dependency.
- `docs/components.md`: Tooltip status → `spec`.
