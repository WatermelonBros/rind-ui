## Why

Reado's settings panel is a drawer, and bottom sheets are how mobile users expect
overlays to work. A drawer is a Dialog plus a gesture — and the gesture is where every
library still ships bugs: scroll fights with drag on iOS, swipes that dismiss visually
but never close, controlled drawers that jump back open, velocity that depends on the
screen's refresh rate, per-frame re-renders that lag on cheap phones, and snap points
that only a finger can change. The Dialog is specified in `add-dialog`; this change adds
the drawer on the same machine, and the swipe gesture module that Toast reuses.

Research this change is based on:
[drawer](../../../docs/research/drawer.md) (main note: sources, Bug history,
Accessibility, decisions) · [dialog](../../../docs/research/dialog.md) ·
[overlay-infrastructure](../../../docs/research/overlay-infrastructure.md) ·
[native-platform](../../../docs/research/native-platform.md) ·
[accessibility](../../../docs/research/accessibility.md) ·
[assistive-tech-and-a11y-testing](../../../docs/research/assistive-tech-and-a11y-testing.md)

**Depends on** `add-foundations` (runtime, controllable values, contracts, drivers,
`testMachine`, React adapter), `add-a11y-foundations` (press, modality, messages, ids,
platform, reduced motion, a11y invariants), `add-overlay-infrastructure` (layer stack,
dismiss, focus containment, inert, scroll lock, presence, portal, overlay traits) and
**`add-dialog`** (the dialog machine builder, connect rules, parts and contract helpers
this change presets). It must be applied after all four. `add-toast` depends on this
change for the `swipe-gesture` capability.

## What Changes

- `@rind-ui/core`: the `drawer` machine, a preset of the Dialog machine (kind `drawer`,
  states `closed | open`), adding swipe-to-dismiss as an ordinary cancelable close
  request with reason `SWIPE`, a controllable `snapPoint` with snap points along the
  drawer's axis, a Handle that changes the snap point by press or keyboard, edge
  placement (`side`, logical sides resolved with the direction), nested-drawer metrics
  and the background indent; connect and contract.
- `@rind-ui/core/dom`: `swipe.ts`, the shared swipe gesture (axis lock, scroll
  arbitration, pointer capture, damping, input-rate-independent velocity, change-of-mind
  cancel, composed-path targets), writing continuous movement as CSS custom properties
  and sending only discrete events; `drawer-stack.ts`, a per-document registry of open
  drawers for nested metrics and the indent.
- `@rind-ui/testing`: a drag input for both adapters; the `drawer` driver
  (`getDrawer`) and model-based tests with the Dialog's traits.
- `@rind-ui/react`: `Drawer.Root`, `Trigger`, `Backdrop`, `Positioner`, `Content`,
  `Title`, `Description`, `CloseTrigger` (Dialog's parts), `Handle`, `Indent`,
  `IndentBackground`.
- Theme stylesheet, stories, docs page; `docs/research/drawer.md` done.

## Capabilities

### New Capabilities

- `drawer`: the Drawer component — parts, placement, swipe dismissal, snap points and
  the Handle, nesting and the indent, keyboard inset, ARIA and `data-*` attributes,
  messages, and its contract and driver.
- `swipe-gesture`: the shared swipe gesture used by Drawer and Toast — when a swipe
  starts, how it competes with scrolling, how movement is exposed, how a release is
  measured and reported, and the drag input the test adapters provide for it.

### Modified Capabilities

None. The capabilities this builds on are introduced by unarchived changes; additions
this change needs from `add-dialog` are listed in design.md under "Requests to other
changes".

## Non-goals

- Re-specifying the Dialog (`add-dialog`) or the overlay modules: open state, focus,
  naming, Escape, outside press, inert, scroll lock, presence and portal behave as
  specified there.
- Opening by swiping from a screen edge (Base UI / Ark `SwipeArea`) — competes with OS
  edge gestures; deferred.
- Base UI's full `VirtualKeyboardProvider` (re-aligning the focused field, pinning
  WebKit's reveal scroll); only the keyboard inset is exposed.
- `CloseWatcher` / Android back gesture (deferred with the Dialog, native-platform.md).
- `modal: "trap-focus"` (deferred in add-overlay-infrastructure).
- Velocity-driven "swipe strength" transition scaling (Base UI) — the theme's duration
  tokens are enough until a consumer asks.
- Framework adapters other than React; fx.

## Impact

- New code: `packages/core/src/components/drawer/{drawer.machine,drawer.connect,drawer.contract,drawer.messages,snap-points}.ts`,
  `packages/core/src/dom/{swipe,drawer-stack}.ts`, `packages/react/src/drawer/*`,
  `packages/testing` (drag input in both adapters, driver export),
  `packages/theme/src/drawer.css`, `apps/storybook/stories/drawer.stories.tsx`,
  generated docs page.
- Public API: `drawer` machine/connect/contract and `trackSwipe` in core, `Drawer` parts
  in React, `getDrawer` and `Part.drag` in testing.
- No new runtime dependency.
