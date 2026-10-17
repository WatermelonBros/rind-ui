# Context Menu

A Menu opened from a region of the page instead of a button: a right click, a long press on touch, or the context-menu key on the keyboard opens `role="menu"` at the point of the gesture. It is modal by default (the page behind is inert); `modal={false}` leaves it usable. Items, groups, checkbox and radio items, links and submenus are the Menu's own parts.

```tsx
import { ContextMenu, Menu } from "@rind-ui/react"

<ContextMenu.Root>
  <ContextMenu.Trigger tabIndex={0}>README.md</ContextMenu.Trigger>
  <Menu.Portal>
    <Menu.Positioner>
      <Menu.Content aria-label="README.md actions">
        <Menu.Item onSelect={() => rename()}>Rename</Menu.Item>
        <Menu.Item onSelect={() => duplicate()}>Duplicate</Menu.Item>
        <Menu.Separator />
        <Menu.Item onSelect={() => remove()}>Delete</Menu.Item>
      </Menu.Content>
    </Menu.Positioner>
  </Menu.Portal>
</ContextMenu.Root>
```

Only `ContextMenu.Root`, `ContextMenu.Trigger`, `Menu.Positioner` and `Menu.Content` are required. The region is a plain `<div>` (use `render` to change the element): it is not a button, has no popup ARIA, and keeps your `tabindex`.

## API

<!-- api:context-menu -->

## Platforms and keys

- **Mouse**: a right click opens the menu at the pointer. On macOS, Control+click does the same.
- **Keyboard**: Shift+F10 or the ContextMenu key on a focused element of the region opens it on the first item. Make the region focusable (`tabIndex={0}`) when it has no focusable content, so keyboard users can reach the gesture.
- **Touch and pen**: holding for 500 ms (`longPressDelay`) opens it at the touch point. Moving more than 10 px or adding a second finger cancels the hold, and the browser's own selection and callout are suppressed while it runs. `longPress={false}` turns it off.
- **Assistive technology**: a screen reader's "open context menu" command arrives as a bare `contextmenu` event with no pointer before it; it opens the menu on the first item like the keyboard.

A focusable region with long press on is described by a hidden hint (`Long press for more options`, `messages.longPressHint`) so touch screen reader users learn the gesture. A gesture that something inside the region already handled (`preventDefault()` on its own `contextmenu`) is left alone, and `disabled` gives the browser's own menu back.

## Naming the menu

A button names a Menu; a region cannot, so the content has no name of its own. Pass `aria-label` or `aria-labelledby` to `Menu.Content`. In development a warning is logged when an open context menu has neither.

## Nested regions

The innermost region takes the gesture: a right click on a row inside a table opens the row's menu, not the table's. An outer region never sees it, and its long press timer never starts. A link or control inside a region that handles `contextmenu` itself keeps the browser's menu.

## Re-anchoring

A second right click inside the same region while the menu is open moves it to the new point and keeps the menu open. One root can serve a whole table: read the row from `target`. `onAnchorChange({ point, target })` runs for each move; `onOpenChange` details carry the `point`, `target` and `nativeEvent` of the opening gesture.

```tsx
<ContextMenu.Root
  onOpenChange={(open, { point, target }) => open && setRow(rowOf(target))}
  onAnchorChange={({ target }) => setRow(rowOf(target))}
>
```

A modal menu makes the region inert, so a right click on it is dismissed like any outside press; use `modal={false}` for a page where the user keeps clicking around.

## Opening from code

`actionsRef` gives `openAt(point, target?)` (viewport coordinates) and `close()`. This is how a document-wide edit menu is built: listen to `contextmenu` yourself, call `preventDefault()` and `openAt`. A controlled `open` without a point places the menu at the region's top-left corner, and a development warning says to use `openAt`.

```tsx
const actions = useRef<ContextMenuActions>(null)

<ContextMenu.Root actionsRef={actions}>…</ContextMenu.Root>
// elsewhere: actions.current?.openAt({ x: event.clientX, y: event.clientY }, event.target)
```

## Controlled use and reasons

`open` / `defaultOpen` / `onOpenChange(open, details)`. `details.reason` is `context-menu` (right click), `context-menu-key` (the keyboard), `long-press` or `api` (`openAt`) when opening; when closing it is the Menu's reasons plus `scroll`: a non-modal menu closes when the page scrolls, because it would otherwise float away from its anchor. `details.cancel()` keeps it as it was. Only one context menu is open per document: opening another closes the first.

## Focus

The menu opens with focus on its first item for the keyboard and assistive technology, and on the content for a pointer or touch. On close, focus returns to the element that had it before the menu opened.

## Styling

The region carries `data-state="open"` while its menu is open and `data-context-menu` always; the content carries `data-context-menu`, with the Menu's attributes (`data-side`, `data-highlighted` on items). The menu grows from the anchor point: `--rind-transform-origin` is the point of the gesture.

## Testing

The region is located by a text it contains. `openAt` takes fractions of the region's box.

```tsx
import { getContextMenu } from "@rind-ui/testing"

render(<FileRow name="README.md" />)
const menu = getContextMenu(screen, { text: "README.md" })
await menu.openAt()
expect(await menu.isOpen()).toBe(true)
await menu.reanchor({ x: 0.9, y: 0.5 })
await menu.choose("Rename")
expect(await menu.isOpen()).toBe(false)
```

`openAt()` runs a right click (pointer), a 500 ms hold (touch) or Shift+F10 on the focused region (keyboard), and waits for the open state, the first placement and focus inside. `reanchor(at)` is a second right click. The Menu's actions and queries apply (`choose`, `toggle`, `openSubmenu`, `items`, `closeReason`), plus `anchorPoint`. `testMachine(contextMenuContract, …)` (or `nonModalContextMenuContract`) runs the machine graph against your own wrapper.

## Tested with

<!-- tested-with:context-menu -->
_No manual screen-reader pass recorded yet._
<!-- /tested-with -->
