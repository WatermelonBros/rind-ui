# Floating Panel

A non-modal window the user can move, resize, minimise and maximise over the page: a tool palette, a chat, notes, an inspector. It is a dialog (named by its Title, Escape closes it, focus returns to the Trigger) that never blocks the page and never closes on an outside press. The rect stays inside its boundary.

## When to use

- **Use it for** a secondary tool kept open while working on the page, that the user places where it does not cover what they need.
- **Over a home-made draggable div**: it is a real non-modal dialog (name, Escape, focus return), the move handle is a button with the keyboard twin of every drag (arrows move, Alt+arrows resize, Enter maximises), a drag is committed once on release (no state churn per frame), Escape mid-drag puts the panel back without closing it, minimising never hides the focus, and at least 48 px always stay reachable inside the boundary with the header never above its top.
- **Don't use it for** a task that needs an answer before going on ([Dialog](dialog.md)), a panel attached to an edge ([Drawer](drawer.md)), or content next to its trigger ([Popover](popover.md)).

```tsx
import { FloatingPanel } from "@rind-ui/react"

<FloatingPanel.Root defaultPosition={{ x: 24, y: 24 }} defaultSize={{ width: 320, height: 240 }}>
  <FloatingPanel.Trigger>Notes</FloatingPanel.Trigger>
  <FloatingPanel.Positioner>
    <FloatingPanel.Content>
      <FloatingPanel.Header>
        <FloatingPanel.DragTrigger>⠿</FloatingPanel.DragTrigger>
        <FloatingPanel.Title>Notes</FloatingPanel.Title>
        <FloatingPanel.Control>
          <FloatingPanel.StageTrigger stage="minimized">–</FloatingPanel.StageTrigger>
          <FloatingPanel.StageTrigger stage="maximized">□</FloatingPanel.StageTrigger>
          <FloatingPanel.CloseTrigger>×</FloatingPanel.CloseTrigger>
        </FloatingPanel.Control>
      </FloatingPanel.Header>
      <FloatingPanel.Body>…</FloatingPanel.Body>
      <FloatingPanel.ResizeTrigger axis="se" />
    </FloatingPanel.Content>
  </FloatingPanel.Positioner>
</FloatingPanel.Root>
```

**The boundary** is the Positioner's containing block (its content box): put the Positioner inside a positioned element to keep the panel there. Without one (or portalled to the body) it is the viewport. A resize of the boundary re-clamps the panel (reason `boundary`).

## API

<!-- api:floating-panel -->

## Anatomy

| Part | `data-part` | Element |
|---|---|---|
| `FloatingPanel.Root` | `root` | `<div>`; holds the open state and the rect. |
| `FloatingPanel.Trigger` | `trigger` | `<button>`; opens and closes the panel. |
| `FloatingPanel.Positioner` | `positioner` | `<div>`; placed by `--rind-floating-panel-x`, `-y`, `-width`, `-height` (px). |
| `FloatingPanel.Content` | `content` | `<div role="dialog">` (non-modal), named by the Title. |
| `FloatingPanel.Header` | `header` | `<div>`; the title bar. |
| `FloatingPanel.DragTrigger` | `drag-trigger` | `<button>` "Move panel", described by a hint; drag it to move. |
| `FloatingPanel.Title` | `title` | `<h2>`; names the panel. |
| `FloatingPanel.Description` | `description` | `<p>`; describes the panel. |
| `FloatingPanel.Control` | `control` | `<div>`; groups the stage and close triggers. |
| `FloatingPanel.StageTrigger` | `stage-trigger` | `<button>` for `stage` `minimized` or `maximized` ("Minimise", "Maximise"); from there it restores ("Restore"). `data-stage-target` is where a press goes. |
| `FloatingPanel.CloseTrigger` | `close-trigger` | `<button>`; closes the panel. |
| `FloatingPanel.Body` | `body` | `<div>`; the content; hidden and inert while minimised. |
| `FloatingPanel.ResizeTrigger` | `resize-trigger` | `<div>` on an edge or corner (`axis`: `n`, `s`, `e`, `w`, `ne`, `nw`, `se`, `sw`); a pointer handle, hidden from assistive technology. |
| `FloatingPanel.Portal` | — | Renders the panel elsewhere (default: the body). |

Every part carries `data-state` (`open`, `closed`), `data-stage` (`default`, `minimized`, `maximized`), `data-dragging`, `data-resizing` and `data-disabled`.

## Keyboard

| Key | Action |
|---|---|
| Arrow keys | On the DragTrigger: move by `step` (10 px). |
| Shift + arrows | Move by `largeStep` (50 px). |
| Alt + arrows | Resize from the south-east corner (Shift: by `largeStep`). |
| Enter, Space | On the DragTrigger: maximise, or restore. |
| Escape | During a drag: put the panel back (it stays open). Otherwise: close the panel. |

The arrows are mirrored in right-to-left layouts.

## Accessibility notes

- **A non-modal dialog**: `role="dialog"` named by the Title, no `aria-modal`; the page stays usable and an outside press does not close it.
- **One focusable handle**: the DragTrigger is a button with the keyboard twin of every pointer drag; the resize handles are pointer-only and `aria-hidden`.
- **Stages**: minimising hides the Body (`hidden`, `inert`) and moves focus out of it to the DragTrigger; stage buttons are named by what they will do.
- **Focus**: opening moves focus into the panel, closing returns it to the Trigger (the Dialog's rules).

## Testing

```tsx
import { getFloatingPanel } from "@rind-ui/testing"

render(<Editor />)
const panel = getFloatingPanel(screen)
await panel.open()
await panel.moveBy(40, 20) // keys on the DragTrigger
expect(await panel.position()).toEqual({ x: 64, y: 44 })
await panel.via("pointer").minimize()
expect(await panel.stage()).toBe("minimized")
```

Contract actions: `open`, `close`, `moveBy`, `resizeBy`, `minimize`, `maximize`, `restore`. Queries: `isOpen`, `position`, `size`, `stage`, `isDragging`.

## Tested with

<!-- tested-with:floating-panel -->
_No manual screen-reader pass recorded yet._
<!-- /tested-with -->
