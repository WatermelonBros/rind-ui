## Why

Dialog is rind-ui's first public component and the one Reado uses most (every
`Modal` and `Drawer` in Reado is an Ark `Dialog`). It is also where the other
headless libraries keep shipping component-level bugs on top of their overlay
plumbing: dangling `aria-labelledby`/`aria-describedby`, hard errors for a missing
title, a dialog opened from a menu item that closes or loses focus, forms whose
submit is cancelled because the dialog unmounted first, non-modal dialogs that
still block the page. The overlay mechanics are already specified in
`add-overlay-infrastructure`; this change specifies the Dialog on top of them.

Research this change is based on:
[dialog](../../../docs/research/dialog.md) (main note: sources, Bug history,
Accessibility, decisions) ·
[overlay-infrastructure](../../../docs/research/overlay-infrastructure.md) ·
[native-platform](../../../docs/research/native-platform.md) (Recommendation:
JS-managed `role="dialog"`, not `showModal()`) ·
[accessibility](../../../docs/research/accessibility.md) ·
[assistive-tech-and-a11y-testing](../../../docs/research/assistive-tech-and-a11y-testing.md)

**Depends on** `add-foundations` (machine runtime, controllable values and change
details, contracts, drivers, `testMachine`, React adapter), `add-a11y-foundations`
(press, interaction modality, messages, element ids, quirks, a11y invariants) and
`add-overlay-infrastructure` (layer stack, dismissable layer, focus containment,
outside inert, scroll lock, presence, portal, overlay testing traits). It must be
applied after all three. `add-alert-dialog` depends on this change.

## What Changes

- `@rind-ui/core`: the `dialog` machine (`closed | open`), connect and contract,
  using the overlay effect for everything layer-related; a typed set of open/close
  reasons; `modal` (default `true`); parentage that skips menus and popovers, so a
  dialog opened from a menu item survives the menu closing.
- Dialog-level defaults: Escape closes; outside press closes a modal dialog,
  never a non-modal one; initial focus follows the overlay default (first
  tabbable, container on touch) with `initialFocus` also accepting the `title`
  and `content` parts; focus returns to the trigger that opened it, or to the
  element focused before a programmatic open.
- Naming and description wired only to rendered parts, merged with consumer
  ids; a development warning (never an error) when the dialog has no accessible
  name; no warning for a missing description.
- Close parts that submit a form close the dialog only after the form's `submit`
  event; non-modal dialogs render no backdrop and leave the page interactive.
- `@rind-ui/react`: `Dialog.Root`, `Trigger`, `Backdrop`, `Positioner`, `Content`,
  `Title`, `Description`, `CloseTrigger` (Ark's part names, so Reado's `Modal.tsx`
  and `Drawer.tsx` migrate by changing imports), used with the generic `Portal`.
- `@rind-ui/testing`: the `dialog` driver (`getDialog`) and model-based tests with
  the `layer`, `modal`, `restores-focus` and `presence` traits.
- Theme stylesheet, stories (default, nested, form inside, non-modal, opened from
  a menu-like trigger, long content), docs page.
- `docs/research/dialog.md` gains Bug history and Accessibility and is marked done.

## Capabilities

### New Capabilities

- `dialog`: the Dialog component — parts and their ARIA and `data-*` attributes,
  open/close behaviour and reasons, modal and non-modal modes, focus defaults,
  naming, forms inside dialogs, nesting, mounting, and its contract and driver.

### Modified Capabilities

None. The capabilities this builds on are introduced by unarchived changes; this
change uses them and does not restate them.

## Non-goals

- Alert Dialog (`add-alert-dialog`, which reuses this machine as a preset).
- Drawer and its gestures (its own research note and change; this machine must not
  need forking for it).
- Native `<dialog>.showModal()`, `closedby`, invoker commands, `CloseWatcher` /
  Android back button (native-platform.md).
- Re-specifying anything owned by `add-overlay-infrastructure`: Escape routing,
  outside-press rules, Tab containment, recovery, restore fallback chain, inert,
  scroll lock, presence timing, portal targets.
- Multiple triggers carrying a payload into the dialog (Base UI `handle`/`payload`);
  detached triggers outside the Root.
- A visually hidden dismiss button for touch screen readers — only added as a
  quirk entry if device testing shows it is needed.
- Framework adapters other than React; fx.

## Impact

- New code: `packages/core/src/components/dialog/{dialog.machine,dialog.connect,dialog.contract,dialog.messages}.ts`,
  `packages/react/src/dialog/*`, `packages/testing` driver export,
  `packages/theme/src/dialog.css`, `apps/storybook/stories/dialog.stories.tsx`,
  generated docs page.
- Public API: `dialog` machine/connect/contract in core, `Dialog` parts in React,
  `getDialog` in testing.
- No new runtime dependency.
