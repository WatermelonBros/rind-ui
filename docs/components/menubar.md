# Menubar

A persistent, named row (or column) of menu items, each opening a [Menu](menu.md). The bar is one tab stop with arrow keys and typeahead; once a menu is open, hovering or arrowing to another item switches menus without a second click. Inside a menu everything is the Menu's: its parts, keys and close rules.

## When to use

- **Use it for** an application's own menu bar (File, Edit, View…) in a desktop-style web app, where commands are grouped under a few always-visible headings.
- **Over a row of buttons that open menus**: there is no native menubar element. It adds `role="menubar"` with `menuitem` items, one roving tab stop, arrow keys, Home, End and typeahead along the bar, one open menu at a time, switching menus by hover or by the arrow keys inside a menu, and focus returning to the bar item on Escape.
- **Don't use it for** site navigation (links to pages): use a [Navigation Menu](navigation-menu.md). A single button with a list of actions is a [Menu](menu.md); a row of buttons and toggles is a [Toolbar](toolbar.md). An app that runs inside a desktop shell with a system menu bar (macOS) should put its commands there.

```tsx
import { Menu, Menubar } from "@rind-ui/react"

<Menubar.Root aria-label="Application">
  <Menubar.Menu value="file">
    <Menubar.Trigger>File</Menubar.Trigger>
    <Menu.Portal>
      <Menu.Positioner>
        <Menu.Content>
          <Menu.Item onSelect={newFile}>New</Menu.Item>
          <Menu.Item onSelect={openFile}>Open…</Menu.Item>
        </Menu.Content>
      </Menu.Positioner>
    </Menu.Portal>
  </Menubar.Menu>
  <Menubar.Menu value="edit">
    <Menubar.Trigger>Edit</Menubar.Trigger>
    <Menu.Portal>
      <Menu.Positioner>
        <Menu.Content>
          <Menu.Item onSelect={undo}>Undo</Menu.Item>
        </Menu.Content>
      </Menu.Positioner>
    </Menu.Portal>
  </Menubar.Menu>
</Menubar.Root>
```

## API

<!-- api:menubar -->

## Anatomy

| Part | `data-part` | Element |
|---|---|---|
| `Menubar.Root` | `root` (`data-scope="menubar"`) | `<div role="menubar">`; `aria-orientation` only when vertical, `data-orientation`, `data-state` (`open` while a menu is open), `data-disabled`, `data-modal`. Name it with `aria-label` or `aria-labelledby` (a development warning logs a nameless menubar). |
| `Menubar.Menu` | (none) | One menu: a Menu root level hosted by the bar. `value` is its key in the bar's `value`. It takes the Menu root's props except `open`, `defaultOpen`, `onOpenChange` and `modal`, which come from the bar. |
| `Menubar.Trigger` | `trigger` (`data-scope="menu"`) | `<div role="menuitem" aria-haspopup="menu">`, the menu's trigger: `aria-expanded`, `aria-controls` while the content is mounted, `data-state`, `data-disabled`, `data-pressed`, plus the bar's `data-host="menubar"`, `data-key`, roving `tabindex` and `data-highlighted` while it has focus. |
| Inside a menu | | The [Menu](menu.md) parts: `Menu.Portal`, `Menu.Positioner`, `Menu.Content`, items, groups, separators, submenus. |

The bar items keep the menu's scope (`data-scope="menu"`, the menu's `data-instance`), so the Menu driver and stylesheet work on them; `data-host="menubar"` is how the menubar's driver and theme find them.

## Keyboard

On the bar, with no menu open:

| Key | Action |
|---|---|
| Tab / Shift+Tab | The menubar is one tab stop: the item that last had focus, else the first. |
| Arrow Right / Left | Moves to the next / previous item (wraps unless `loop={false}`); mirrored in RTL. Never opens a menu. |
| Arrow Down / Up | The same in a vertical menubar. |
| Home / End | Moves to the first / last item. |
| A printable character | Moves to the next item starting with the typed text. |
| Enter / Space / Arrow Down | Opens the focused item's menu on its first item (horizontal bar). |
| Arrow Up | Opens it on its last item (horizontal bar). |
| Arrow Right (Left in RTL) | Opens it on its first item (vertical bar). |

Inside an open menu:

| Key | Action |
|---|---|
| Arrow Up / Down, Home, End, typeahead | The menu's own (they never leave the menu). |
| Arrow Right (Left in RTL) | On a submenu trigger, opens the submenu. Elsewhere, in a horizontal bar, closes the menu and opens the next item's menu on its first item; disabled items are skipped. In a vertical bar it does nothing. |
| Arrow Left (Right in RTL) | In a submenu, closes it. At a menu's top level, in a horizontal bar, switches to the previous item's menu; in a vertical bar, closes the menu and focuses its item. |
| Escape | Closes the innermost menu; at the top level, focus returns to the bar item. |
| Tab / Shift+Tab | Closes the menu and leaves the menubar. |

## Open mode

Which menu is open is one value: `value` / `defaultValue` / `onValueChange(value, details)`, the open menu's `value` or `null`. While a menu is open:

- a press on another item, or a mouse or pen moving onto it, switches menus in one step (never two open, never none in between);
- the press that follows a hover switch keeps the menu the hover opened; the next press on its item closes it;
- touch never hover-switches; a touch that turns into a scroll opens nothing.

When the last menu closes, for any reason, hover stops opening menus until a menu is opened again. `details.reason` says why the value changed: `trigger`, `trigger-key`, `hover`, `menu-navigate`, `api`, or the menu's own close reason (`item-select`, `escape-key`, `tab-key`, `outside-press`, `outside-focus`, `window-blur`).

```tsx
const [menu, setMenu] = useState<string | null>(null)

useHotkey("Alt+F", () => setMenu("file"))

<Menubar.Root aria-label="Application" value={menu} onValueChange={setMenu}>…</Menubar.Root>
```

## Modality

`modal` (default `true`) is passed to every menu. While a modal menu is open the rest of the page is inert and its scrolling is locked, but the menubar is not: it belongs to the open menu's layer, so its items keep their names, receive hover and presses, and a press on another item switches menus instead of only closing. With `modal={false}` nothing is inert and an outside press closes the menu and reaches the page.

## Vertical menubars

`orientation="vertical"` stacks the items: Up and Down move along the bar, and menus open beside their item (at the inline end) on the expand key. Switching between menus by keyboard is not available in a vertical bar: the collapse key closes the menu back to its item.

## Disabled items

`disabled` on a `Menubar.Menu` (or on the root, for every item) sets `aria-disabled="true"` on its item and it never opens. Disabled items stay focusable and reachable by arrows and typeahead (`focusableWhenDisabled`, default `true`); keyboard switching skips them.

## Keyboard shortcuts in items

Announce an item's shortcut with `aria-keyshortcuts` and show it in a hidden hint; bind the shortcut yourself (the library binds no global key):

```tsx
<Menubar.Menu value="file">
  <Menubar.Trigger>File</Menubar.Trigger>
  <Menu.Portal>
    <Menu.Positioner>
      <Menu.Content>
        <Menu.Item onSelect={save} aria-keyshortcuts="Control+S">
          Save <span aria-hidden="true">Ctrl+S</span>
        </Menu.Item>
      </Menu.Content>
    </Menu.Positioner>
  </Menu.Portal>
</Menubar.Menu>
```

## Focusing the menubar from a shortcut

`actionsRef.focus()` moves focus to the bar's tab stop and opens nothing:

```tsx
const bar = useRef<{ focus(): void }>(null)

useHotkey("F10", () => bar.current?.focus())

<Menubar.Root aria-label="Application" actionsRef={bar}>…</Menubar.Root>
```

## Styling

Style the `data-*` attributes above, or import `@rind-ui/theme/menubar.css`: the bar as a row (a column when vertical), items in the toggle-item family (ghost by default) with at least `--rind-hit-area`, the open item drawn with an edge as well as a background (an outline in forced colours), and tier-3 `--rind-menubar-*` tokens: `bg`, `border`, `radius`, `padding`, `gap`, `trigger-height`, `trigger-padding`, `trigger-radius`, `trigger-open-bg`, `trigger-open-text`. The menus use `menu.css` unchanged.

## Testing

Contract actions: `tabIn()` (Tab from a button named "Before"), `moveTo(name)` (bar arrows), `openMenu(name)` (pointer and touch press the item; keyboard moves to it, then Enter; on the open item, it closes it), `openMenuOnLast(name)` (ArrowUp), `switchTo(name)` (pointer hovers the item; keyboard presses the expand key inside the open menu until it is open), `closeMenu()` (Escape), `typeahead(text)`, `tabOut()`. Queries: `items`, `currentMenu` (the open menu's item, or null), `focusedItem`, `tabStop`, `isDisabled`, `orientation`. `menu(name)` returns the [Menu](menu.md) driver of that item's menu.

```tsx
import { getMenubar } from "@rind-ui/testing"

render(<App />)
const bar = getMenubar(screen, { name: "Application" })
await bar.openMenu("File")
await bar.switchTo("Edit")
await bar.menu("Edit").choose("Find…")
expect(await bar.currentMenu()).toBeNull()
```

The same test runs unchanged with Playwright's `page` in place of `screen`. `testMachine(menubarContract, …)` runs the machine graph against your own menubar; set `menubarArgs.current = { label: "File", other: "View" }` to choose the items its steps act on.

## Accessibility tree

<!-- aria:menubar--open -->
```yaml
- menubar "Application (open)":
  - menuitem "File"
  - menuitem "Edit" [expanded]
  - menuitem "View"
- menu "Edit":
  - menuitem "Undo"
  - menuitem "Redo" [disabled]
  - separator
  - menuitem "Find…"
```
<!-- /aria -->

## Tested with

<!-- tested-with:menubar -->
_No manual screen-reader pass recorded yet._
<!-- /tested-with -->
