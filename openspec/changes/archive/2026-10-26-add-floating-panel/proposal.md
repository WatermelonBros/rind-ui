## Why

A non-modal window inside the page that the user moves, resizes, minimises and maximises: an
inspector, a chat, a picture-in-picture tool. Zag/Ark ship one; react-rnd and react-draggable are
the building blocks people use otherwise. Their history: no keyboard resize, Escape that closes in
the middle of a drag, bounds wrong under borders, zoom or a window resize, buttons in the header
that start a drag on touch, a hard-coded English close name. rind-ui has the non-modal Dialog
graph, the layer stack and the pointer lifecycle to compose one.

Research: [floating-panel](../../../docs/research/floating-panel.md) ·
[dialog](../../../docs/research/dialog.md) · [splitter](../../../docs/research/splitter.md)

Depends on: `add-dialog` (non-modal open/close, layer stack, focus restore), `add-slider`
(`trackPointer`), `add-theme-system`.

## What Changes

- A public **Floating Panel** in `@rind-ui/core` and every framework package: parts `Root`,
  `Trigger`, `Portal`, `Positioner`, `Content`, `Header`, `DragTrigger`, `Title`, `Description`,
  `Control`, `StageTrigger`, `CloseTrigger`, `Body`, `ResizeTrigger`.
- Open and close are the Dialog machine's, non-modal (composed by the parts); a rect machine
  (`idle | moving | resizing`) owns position, size and stage, sees only the start and the end of a
  drag (per-move position goes through CSS variables), clamps to a boundary keeping `minVisible`
  pixels on screen, and moves and resizes by keys on the DragTrigger.
- `dom/rect-bounds.ts` (clamp rules); `getFloatingPanel` driver; `floating-panel.css`; site
  example; docs page.

## Capabilities

### New Capabilities

- `floating-panel`: anatomy, open/close, rect and boundary, move, resize, keyboard, stages,
  focus, data attributes, messages, contract, theme.

### Modified Capabilities

None.

## Non-goals

- Docking, tiling, snapping, tabs, a taskbar, persistence (`onPositionChange` is the hook), a
  modal mode (Dialog), `lockAspectRatio`.

## Impact

- New: `packages/core/src/components/floating-panel/`, `packages/core/src/dom/rect-bounds.ts`,
  framework parts, driver, theme file, site example and skin, `docs/components/floating-panel.md`.
- Modified: `families.ts` (`floating-panel` in `panel`).
