# Sortable

Reorder a list by dragging, by keyboard or by buttons: tasks, tracks, fields, cards, columns. Each item has a handle, a button named for its item ("Reorder Apple"). Space picks the item up, the arrows move it one position at a time (the list reorders live and focus stays on the handle), Space drops it and Escape puts it back. Alt+arrow moves an item one place without picking it up, and move buttons do the same with a single click. A pointer drag shows where the item will land. Every step is announced with the item's position ("Apple dropped at position 3 of 5").

## When to use

- **Use it for** user-ordered lists: priorities, playlists, form builders, dashboard layouts, columns.
- **Over a drag-and-drop toolkit**:
  - the keyboard moves by positions, not pixels;
  - announcements always come from the current order;
  - handle-only dragging and per-item `disabled`;
  - a session that ends when its item leaves the list (no trapped keyboard);
  - buttons as the no-drag route (WCAG 2.5.7).
- **Don't use it for** moving items between lists or dropping files (later changes on the same model), or for sorting by a column ([Table](table.md)).

```tsx
import { Sortable } from "@rind-ui/react"

const [items, setItems] = useState(["research", "spec", "build"])

<Sortable.Root aria-label="Tasks" items={items} onReorder={(keys) => setItems(keys)}>
  {items.map((key) => (
    <Sortable.Item key={key} value={key}>
      <Sortable.Handle />
      {labels[key]}
      <Sortable.MoveButton direction="up" />
      <Sortable.MoveButton direction="down" />
    </Sortable.Item>
  ))}
  <Sortable.Indicator />
</Sortable.Root>
```

## API

<!-- api:sortable -->

## Anatomy

| Part | `data-part` | Element |
|---|---|---|
| `Sortable.Root` | `root` | `<ul>` (any element through `render`); name it with `aria-label`. |
| `Sortable.Item` | `item` | `<li>`; `value`, `label`, `disabled`. |
| `Sortable.Handle` | `handle` | Button "Reorder {label}", described by the instructions; `aria-pressed` while picked up. Empty, the theme draws a grip. |
| `Sortable.Indicator` | `indicator` | `aria-hidden` drop line during a pointer drag. |
| `Sortable.MoveButton` | `move-button` | `direction` "up" or "down" ("Move Apple down"); `aria-disabled` at the ends. |

## Keyboard

| Key | Action |
|---|---|
| Space, Enter | On a handle: pick up. While picked up: drop. |
| Arrows | While picked up: one position (Up / Down; Left / Right when horizontal). |
| Home, End | While picked up: to the first / last position. |
| Escape | While picked up: back where it was. |
| Alt + arrow | On a handle: one position without picking up. |
| Tab, or a click elsewhere | Drops where it is. |

## Pointer

A drag starts from the handle (or anywhere on the item with `handle={false}`) after a 4 px move, or a 300 ms press on touch so a swipe still scrolls. The item follows the pointer, the Indicator shows the drop position, and the list's scroll container scrolls near its edges. Release drops (`onReorder` once), Escape cancels.

## `onReorder`

`onReorder(keys, { key, from, to, reason })` gives the whole new order. `reason` is `"keyboard"` (each move while picked up), `"pointer"` (on drop), `"quick"` (Alt+arrow, move buttons) or `"cancel"` (Escape restoring the order). `items` is controlled: apply `keys` to your data.

## Accessibility notes

- **The order is the DOM order**: items move in the list, so reading order and focus follow.
- **Announcements**: polite and replacing one another: picked up (with the keys to use), each position, dropped, returned, moved.
- **The handle names its item** and carries its instructions, read without forms mode.
- **No dragging-only action**: keys and move buttons do everything a drag does.
- **No trapped session**: listeners exist only during a session; removing the active item from `items` ends it.

## Testing

```tsx
import { getSortable } from "@rind-ui/testing"

const list = getSortable(screen, { name: "Tasks" })
await list.pickUp("Write the spec")
await list.move(2)
await list.drop()
await list.quickMove("Build the machine", -1)
await list.drag("Read the docs", 2)
expect(await list.order()).toEqual(["...keys in order"])
```

Contract actions: `pickUp`, `move`, `drop`, `cancel`, `quickMove`, `drag`. Queries: `order`, `active`, `pressed`.

## Tested with

<!-- tested-with:sortable -->
_No manual screen-reader pass recorded yet._
<!-- /tested-with -->
