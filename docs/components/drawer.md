# Drawer

A panel docked to an edge of the screen that slides in over the page and can be dragged away. It is a Dialog with a side, a swipe gesture and optional snap points: modal by default, everything outside is inert, the page does not scroll and Tab stays inside. Focus moves in on open and returns to the opener on close. The content is `role="dialog"`, named by its title.

```tsx
import { Drawer } from "@rind-ui/react"

<Drawer.Root>
  <Drawer.Trigger>Filters</Drawer.Trigger>
  <Drawer.Portal>
    <Drawer.Backdrop />
    <Drawer.Positioner>
      <Drawer.Content>
        <Drawer.Handle />
        <Drawer.Title>Filters</Drawer.Title>
        <Drawer.Description>Narrow the results.</Drawer.Description>
        <label>Name <input /></label>
        <Drawer.CloseTrigger>Done</Drawer.CloseTrigger>
      </Drawer.Content>
    </Drawer.Positioner>
  </Drawer.Portal>
</Drawer.Root>
```

Only `Root` and `Content` are required. `Portal`, `Backdrop`, `Positioner`, `Handle`, `Indent` and `IndentBackground` are optional. Parts render when the drawer first opens and unmount after their exit animation; `keepMounted` keeps them in the document, hidden. Everything the Dialog does (naming, focus, controlled use, reasons, forms) works the same here; see the [Dialog](dialog.md) guide. The extra close reason is `swipe`.

## API

<!-- api:drawer -->

## Dialog or Drawer

Use a Dialog for a decision or a short task that needs the user's full attention in the middle of the page. Use a Drawer for content that belongs to an edge: a filter panel, a navigation menu, a detail view, an action sheet on a phone. Both are modal layers with the same focus and dismissal rules; the Drawer adds the swipe and snap points.

## Sides

`side` is `"bottom"` (default), `"top"`, `"left"` or `"right"`. The logical sides `"inline-start"` and `"inline-end"` follow the text direction: in a right-to-left locale `inline-start` docks to the right. The resolved physical side is on `data-side` of the positioner and the content, and the swipe that dismisses is always toward that edge.

## Gesture alternatives

Dragging is never the only way to act (WCAG 2.5.1 pointer gestures, 2.5.7 dragging movements). Every drawer can be closed without a drag:

- A `Drawer.CloseTrigger` button. Render one: when the gesture is the only way out, a development warning says so, because touch screen readers cannot drag.
- Escape (`closeOnEscape`) and a press on the backdrop (`closeOnInteractOutside`).
- With two or more snap points the `Drawer.Handle` is a button: each press moves to the next point and the last wraps to the first. It is named by `messages.expand` or `messages.collapse`, depending on the direction of the next move.

A swipe starts anywhere on the content except inside an element marked `data-rind-no-swipe` (a map, a slider, a code block). The handle always starts one. `closeOnSwipe={false}` keeps the drag for snap points alone; `swipeThreshold` and `swipeVelocityThreshold` tune when a release dismisses.

## Snap points and the handle

`snapPoints` lists the resting sizes: a fraction of the viewport (`0.4`), or a length (`"320px"`, `"20rem"`). The drawer opens at `defaultSnapPoint` (the first by default); a release settles on the nearest point, or the neighbouring one with `snapToSequentialPoints`. `snapPoint` / `onSnapPointChange` control it. The content has `data-snap-point` (the index) and `data-expanded` at the largest point, and the machine writes `--rind-drawer-snap-offset`, the distance hidden beyond the edge.

```tsx
<Drawer.Root snapPoints={[0.3, 0.6, 1]}>
  …
  <Drawer.Content><Drawer.Handle /> …</Drawer.Content>
</Drawer.Root>
```

Without snap points the handle is decorative (`aria-hidden`) and only starts the swipe.

## Nested drawers and the indent

A drawer opened from inside another is its child: Escape and a press on the child's backdrop close only the child, and closing the parent closes the child first. The parent content has `data-has-nested` and `data-nested-swiping`; `--rind-drawer-frontmost-size` is the size of the frontmost child, so the parent can recede behind it.

Wrap the page in `Drawer.Indent` (inside `Drawer.IndentBackground`) to scale it down while a modal drawer is open. `data-active` is set on both parts, and the scale follows the drag through `--rind-drawer-swipe-progress`, with no render per frame.

## Keyboard inset

On a top or bottom drawer, `--rind-drawer-keyboard-inset` on the positioner is the height of the on-screen keyboard (from the visual viewport), so a focused field is not covered. The theme pads the positioner with it; with your own styles, use it as padding or as a bottom offset.

## Styling

Style the `data-*` attributes above, or import `@rind-ui/theme/drawer.css`: backdrop, docked positioner and content per side, slide in and out (from the release position after a swipe), transitions off while dragging, the handle with a 24 px hit area, indent scaling, `overscroll-behavior: contain`, no motion under reduced motion, and forced-colors borders, with `--rind-drawer-*` tokens.

Variables written by the machine: `--rind-drawer-swipe-x`, `--rind-drawer-swipe-y` and `--rind-drawer-swipe-progress` (0 at rest, 1 at the point of dismissal) while dragging; `--rind-drawer-snap-offset` and `--rind-drawer-size` (the measured size) on the content.

## Testing

Contract actions: `open()`, `close()`, `swipe(direction, distance)`, `pressHandle()`, `pressEscape()`, `pressOutside()`, `tab()`, `shiftTab()`, `waitForUnmount()`. Queries: `isOpen`, `isModal`, `title`, `description`, `hasFocus`, `isTopmost`, `closeReason`, `snapPoint`, `side`, `isSwiping`. The drawer is located through its trigger (`trigger` defaults to `name`).

```tsx
import { getDrawer } from "@rind-ui/testing"

render(<Filters />)
const drawer = getDrawer(screen, { name: "Filters" })
await drawer.open()
await drawer.swipe("down", 300)
expect(await drawer.closeReason()).toBe("swipe")
```

`swipe` drags the content by `distance` pixels over a slow, deliberate movement, by touch or by mouse. Pass `modal: false` for a non-modal drawer. `testMachine(drawerContract, …)` (or `nonModalDrawerContract`) runs the machine graph against your own wrapper, including the swipe event.

## Tested with

<!-- tested-with:drawer -->
_No manual screen-reader pass recorded yet._
<!-- /tested-with -->
