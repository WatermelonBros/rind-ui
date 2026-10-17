# Menu

A list of actions opened from a trigger button: `role="menu"` with items, checkbox and radio items, groups, links and nested submenus. It is modal by default (the page behind is inert); `modal={false}` leaves it usable. The content is positioned against the trigger by the shared positioning capability and named by the trigger.

```tsx
import { Menu } from "@rind-ui/react"

<Menu.Root>
  <Menu.Trigger>Actions</Menu.Trigger>
  <Menu.Portal>
    <Menu.Positioner>
      <Menu.Content>
        <Menu.Item onSelect={() => rename()}>Rename</Menu.Item>
        <Menu.Item href="/docs/export">Export</Menu.Item>
        <Menu.Separator />
        <Menu.CheckboxItem defaultChecked>
          <Menu.ItemIndicator>✓</Menu.ItemIndicator>
          <Menu.ItemText>Show grid</Menu.ItemText>
        </Menu.CheckboxItem>
        <Menu.Group>
          <Menu.GroupLabel>Sort by</Menu.GroupLabel>
          <Menu.RadioGroup defaultValue="name">
            <Menu.RadioItem value="name">Name</Menu.RadioItem>
            <Menu.RadioItem value="date">Date</Menu.RadioItem>
          </Menu.RadioGroup>
        </Menu.Group>
        <Menu.Submenu>
          <Menu.SubmenuTrigger>Share</Menu.SubmenuTrigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Content>
                <Menu.Item>Copy link</Menu.Item>
                <Menu.Item>Email</Menu.Item>
              </Menu.Content>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Submenu>
        <Menu.Arrow />
      </Menu.Content>
    </Menu.Positioner>
  </Menu.Portal>
</Menu.Root>
```

Only `Root`, `Trigger`, `Positioner` and `Content` are required. Parts render when the menu first opens and unmount after their exit animation; `keepMounted` keeps them in the document, hidden.

## API

<!-- api:menu -->

## Opening and initial focus

Where focus lands depends on how the menu was opened, once it is placed (never before: focusing an unplaced popup scrolls the page):

- Keyboard and assistive technology (Enter, Space, a bare screen-reader click): the first item.
- ArrowDown on the closed trigger: the first item. ArrowUp: the last item.
- Pointer and touch: the content itself, so no item looks selected until the pointer moves over it or a key is pressed.

On close, focus returns to the trigger, except when the menu closed because focus went elsewhere (a sibling menu, the window blurring, an outside press on another control).

## Checkbox and radio items

`Menu.CheckboxItem` and `Menu.RadioItem` toggle or select without closing the menu, so several options can be set in one visit. Space on them never closes the menu; `closeOnSelect` (default `false` for these kinds) lets a click or Enter close it. Checkbox items are controlled with `checked` / `defaultChecked` / `onCheckedChange`; the selected radio item is controlled on the `Menu.RadioGroup` with `value` / `defaultValue` / `onValueChange`. Both expose `aria-checked` and `data-state` (`checked` / `unchecked`), and `Menu.ItemIndicator` renders only while checked unless `keepMounted`.

## Link items

`href` on `Menu.Item` renders a link (`<a>`, `role="menuitem"`). Enter and a click navigate exactly once through the browser (or your router, through `routerOptions`), then the menu closes. Modified clicks and `target="_blank"` open elsewhere and leave the menu as it is.

## Submenus

`Menu.Submenu` holds a `Menu.SubmenuTrigger` (an item) and its own `Portal` / `Positioner` / `Content`. Each submenu has its own open state, layers and `onOpenChange`.

- The expand key (ArrowRight, ArrowLeft in right-to-left layouts), Enter, Space or a click opens it and focuses its first item. The collapse key or Escape closes it and returns to the trigger item.
- Hover opens it after `submenuOpenDelay` (default 100 ms): the pointer must rest on the trigger, and a pointer passing by does not open it. Hover leaves focus on the trigger item.
- While a submenu is open, moving the pointer towards it crosses a grace area: the submenu stays open as long as the pointer heads for it, and closes after resting in the grace area for `submenuGraceTimeout` (default 300 ms).
- Opening a sibling submenu closes the open one. Selecting any item, Tab or an outside press closes the whole tree.

## Modal and non-modal

`modal` (the default) makes everything outside inert and locks scroll; an outside press only closes the menu and is not delivered to what is behind. `modal={false}` leaves the page interactive: a press or focus moving outside still closes the menu, and the press goes through to its target. Content carries `data-modal` while the root menu is modal. Submenus are always non-modal child layers of their root.

## Dialogs opened from items

Opening a Dialog from an item works with the menu closed or open: `onSelect` runs when the item activates, and the menu closes after it (`closeOnSelect`). Render the Dialog outside the menu content (it unmounts when the menu closes) and set its state from `onSelect`. Focus restore is handled by the layer stack: the Dialog closing returns focus to the element that was focused when it opened, which is the trigger once the menu has closed.

```tsx
const [renaming, setRenaming] = useState(false)

<Menu.Root>
  <Menu.Trigger>Actions</Menu.Trigger>
  {/* … */}
  <Menu.Item onSelect={() => setRenaming(true)}>Rename…</Menu.Item>
</Menu.Root>
<Dialog.Root open={renaming} onOpenChange={setRenaming}>{/* … */}</Dialog.Root>
```

## Controlled use and reasons

`open` / `defaultOpen` / `onOpenChange(open, details)`. `details.reason` is `trigger`, `trigger-key` or `api` when opening, and `trigger`, `item-select`, `escape-key`, `tab-key`, `outside-press`, `outside-focus`, `window-blur`, `parent-dismissed` or `api` when closing; `details.cancel()` keeps it as it was. `onSelect(details)` on an item runs before the menu closes, and `details.cancel()` keeps the menu open. `actionsRef` gives `open()` and `close()`. After closing, the content carries `data-close-reason` (`escape-key`) until the next open.

## Naming

The content is named by its trigger (`aria-labelledby`); a submenu is named by its trigger item. Give the content `aria-label` or `aria-labelledby` of your own to override. `Menu.GroupLabel` names its `Menu.Group`; the label is not an item and navigation skips it.

## Positioning

`positioning` takes the shared options (side, align, offsets, flip, shift, size, arrow); the root menu defaults to the dropdown preset and a submenu to the submenu preset (opens to the inline end). The positioner receives `data-side`, `data-align`, `data-anchor-hidden` and `data-placing`; the content's size is clamped by `--rind-available-width` / `--rind-available-height`, and `--rind-transform-origin` points at the anchor.

## Known assistive technology notes

- **VoiceOver and submenus**: with an open submenu, VoiceOver reads the first item of the submenu only when the trigger item does not announce `aria-expanded`, so the submenu trigger omits it while its submenu is open.
- **Pointer, keyboard and focus-visible**: `data-focus-visible` on items appears only for keyboard and typeahead highlights, never for the pointer.

## Styling

Style the `data-*` attributes above (`[data-highlighted]` for the current item, `[data-state="checked"]` for options, `[data-disabled]`).

## Testing

The menu is located through its trigger (`name`); pass `modal: false` for a non-modal one.

```tsx
import { getMenu } from "@rind-ui/testing"

render(<ActionsMenu />)
const menu = getMenu(screen, { name: "Actions" })
await menu.open()
expect(await menu.items()).toEqual(["Rename", "Export", "Show grid", "Name", "Date", "Share"])
await menu.toggle("Show grid")
expect(await menu.isChecked("Show grid")).toBe(true)
expect(await menu.isOpen()).toBe(true)
await menu.openSubmenu("Share")
await menu.choose("Copy link")
expect(await menu.isOpen()).toBe(false)
```

`open()` waits for the open state, the first placement and focus inside, in that order. `choose(name)` activates an item of any open level, `toggle(name)` a checkbox or radio item (the menu stays open), `openSubmenu(name)` hovers (pointer) or presses the expand key (keyboard). Queries: `isOpen`, `items`, `highlighted`, `focusedItem`, `isChecked`, `isDisabled`, `openPath`, `closeReason`. `testMachine(menuContract, …)` (or `nonModalMenuContract`) runs the machine graph against your own wrapper.

## Tested with

<!-- tested-with:menu -->
_No manual screen-reader pass recorded yet._
<!-- /tested-with -->
