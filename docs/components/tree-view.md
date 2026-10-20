# Tree View

A hierarchy of nodes the user expands, collapses and moves through with the keyboard, then selects, checks or activates: a file explorer, an outline, a category filter, a documentation sidebar. Branches can load their children the first time they open. The tree is one tab stop, its rows move by roving focus, and every row is a sibling in the DOM (a flat list), so long trees stay cheap to render.

## When to use

- **Use it for** a hierarchy the user browses: folders and files, nested categories, a table of contents.
- **Over nested lists of links**: it adds the keyboard model screen-reader users expect from a tree (Right and Left expand, collapse and climb), selection or checkboxes, typeahead, and lazy loading, with one tab stop instead of one per row.
- **Don't use it for** rows that hold buttons, inputs or menus: a `treeitem` cannot contain controls. Use a Grid List for a flat list of interactive rows, or a Table for columns. For a short list without hierarchy, use a [Listbox](listbox.md).

```tsx
import { TreeView } from "@rind-ui/react"

<TreeView.Root items={files} defaultExpandedValue={["src"]} onValueChange={open}>
  <TreeView.Label>Files</TreeView.Label>
  <TreeView.Tree>
    {(node) => (
      <TreeView.Item value={node.key}>
        {node.isBranch ? <TreeView.ItemIndicator>▸</TreeView.ItemIndicator> : null}
        <TreeView.ItemText>{node.label}</TreeView.ItemText>
      </TreeView.Item>
    )}
  </TreeView.Tree>
  <TreeView.Empty />
</TreeView.Root>
```

`items` is a list of `{ key, label, children?, isBranch?, disabled? }`. `TreeView.Tree` calls its children function once per visible node, in order, with the node's state (`key`, `label`, `level`, `isBranch`, `expanded`, `selected`, `checked`, `loading`, `disabled`, …). The tree needs an accessible name: render a `TreeView.Label`, or pass `aria-label` / `aria-labelledby` to `TreeView.Tree`. Development builds warn when it has none.

## API

<!-- api:tree-view -->
### Anatomy

| Part | `data-part` | Element | Description |
|---|---|---|---|
| `TreeView.Root` | `root` | `<(none)>` | Holds the state; renders no element. |
| `TreeView.Label` | `label` | `<span>` | Names the tree (`aria-labelledby`) while rendered. |
| `TreeView.Tree` | `tree` | `<div>` | `role="tree"`; one Tab stop (roving). Renders its children function once per visible node, as a flat list. |
| `TreeView.Item` | `item` | `<div (a with href)>` | `role="treeitem"` with `aria-level`, `aria-setsize`, `aria-posinset`; `aria-expanded` on branches only. |
| `TreeView.ItemText` | `item-text` | `<span>` | The item's name (`aria-labelledby`). |
| `TreeView.ItemIndicator` | `item-indicator` | `<span>` | `aria-hidden` expand indicator; a press toggles the branch, focus stays put. |
| `TreeView.ItemCheckbox` | `item-checkbox` | `<span>` | `aria-hidden` check mark of a checkable tree; a press toggles the check. |
| `TreeView.Loading` | `loading` | `<span>` | `aria-hidden` row under a loading branch (announced, not an item). |
| `TreeView.Empty` | `empty` | `<div>` | After the tree while it has no nodes; describes it. |
| `TreeView.DropIndicator` | `drop-indicator` | `<div>` | `aria-hidden` line at a pointer drag's target (`--rind-tree-drop-top`, `--rind-tree-drop-level`); render it inside `TreeView.Tree`'s positioned container. |

### Props

| Part | Prop | Type | Default | Description |
|---|---|---|---|---|
| `TreeView.Root` | `movable` | `boolean \| (key) => boolean` | `false` | Nodes can move (Alt+arrows, pointer drags): all, or those the predicate allows. |
| `TreeView.Root` | `onMove` | `(key, { parent, index, reason: "keyboard" \| "pointer" }) => void` | — | A node moved: apply it to `items` with `moveNode(items, key, details)`. |
| `TreeView.Root` | `items` | `{ key, label, children?, isBranch?, disabled?, href? }[]` | — | The tree's data (or `collection`: a tree collection built by you). |
| `TreeView.Root` | `selectionMode` | `"single" \| "multiple" \| "none"` | `"single"` | None: activation only. |
| `TreeView.Root` | `selectionBehavior` | `"toggle" \| "replace"` | `"toggle"` | Replace: selection follows focus; mod+press toggles. |
| `TreeView.Root` | `value` | `string \| null \| string[]` | — | Controlled selection. |
| `TreeView.Root` | `defaultValue` | `string \| null \| string[]` | — | Uncontrolled selection. |
| `TreeView.Root` | `onValueChange` | `(value, { reason, key }) => void` | — | Every selection change. |
| `TreeView.Root` | `expandedValue` | `string[]` | — | Controlled expanded branch keys. |
| `TreeView.Root` | `defaultExpandedValue` | `string[]` | — | Uncontrolled expanded keys. |
| `TreeView.Root` | `onExpandedChange` | `(keys, { reason: "key" \| "press" \| "api" \| "siblings" \| "all" }) => void` | — | Every expansion change. |
| `TreeView.Root` | `checkable` | `boolean` | `false` | Items carry `aria-checked`; no selection. |
| `TreeView.Root` | `checkedValue` | `string[]` | — | Controlled checked leaf keys. |
| `TreeView.Root` | `defaultCheckedValue` | `string[]` | — | Uncontrolled checked leaf keys. |
| `TreeView.Root` | `onCheckedChange` | `(keys, { reason, key }) => void` | — | Once per user action. |
| `TreeView.Root` | `checkPropagation` | `"both" \| "none"` | `"both"` | Both: a branch is derived from its leaves. |
| `TreeView.Root` | `expandOnClick` | `boolean` | `true` | A press on a branch toggles it. |
| `TreeView.Root` | `onAction` | `(key, { modality, via }) => void` | — | Enter, and a press when the selection does not consume it. |
| `TreeView.Root` | `onLoadChildren` | `(key, { signal }) => Promise \| void` | — | Called once per unloaded branch when first expanded. |
| `TreeView.Root` | `disabled` | `boolean` | `false` | No Tab stop, no keys or presses. |
| `TreeView.Root` | `id` | `string` | — | Base of the parts' generated ids (default: a `useId`). |
| `TreeView.Root` | `children` | `ReactNode` | — | The tree's parts (Label, Tree, Empty). |
| `TreeView.Root` | `collection` | `TreeCollection<unknown>` | — | A tree collection you built, used instead of `items`. |
| `TreeView.Root` | `focusableWhenDisabled` | `boolean` | — | Disabled items (and a disabled tree) stay focusable and reachable by arrows; nothing toggles. |
| `TreeView.Root` | `loop` | `boolean` | `false` | Arrow moves wrap at both ends. |
| `TreeView.Root` | `typeaheadTimeout` | `number` | `1000` | Typeahead reset delay in ms. |
| `TreeView.Root` | `messages` | `Partial<TreeViewMessages>` | — | Overrides for the loading announcements and the Empty and Loading default texts. |
| `TreeView.Root` | `virtualized` | `boolean` | — | Rows are windowed by the consumer (`TreeView.Tree` `indexes`): keyboard moves call `scrollToIndex`, never `scrollIntoView`. |
| `TreeView.Root` | `scrollToIndex` | `(details: ScrollToIndexDetails) => void` | — | Scrolls the highlighted row into view; `index` is its position in the visible list. |
| `TreeView.Root` | `disallowEmptySelection` | `boolean` | — | The last selected item cannot be deselected. |
| `TreeView.Label` | `render` | `RenderProp<undefined>` | — | Another element or a render function receiving the props. |
| `TreeView.DropIndicator` | `render` | `RenderProp<undefined>` | — | Another element or a render function receiving the props. |
| `TreeView.Tree` | `render` | `RenderProp<undefined>` | — | Another element or a render function receiving the props. |
| `TreeView.Tree` | `children` | `(node: TreeViewNodeState) => ReactNode` | — | Called once per visible node with its state; returns its row (usually a `TreeView.Item`). |
| `TreeView.Tree` | `loading` | `(node: TreeViewNodeState) => ReactNode` | — | Under a loading branch (default: the Loading part with the loading text). |
| `TreeView.Tree` | `indexes` | `readonly number[]` | `every visible node` | Virtualized: the visible-list indexes to render (a virtualizer's window plus `TreeView.useVisibleRows().persistedIndexes`). |
| `TreeView.Item` | `rel` | `string \| undefined` | — | With `href`: passed to the anchor. |
| `TreeView.Item` | `render` | `RenderProp<undefined>` | — | Another element or a render function receiving the props. |
| `TreeView.Item` | `value` | `string` | — | The node key. |
| `TreeView.Item` | `children` | `ReactNode` | — | The row's content (ItemText, ItemIndicator, ItemCheckbox). |
| `TreeView.Item` | `href` | `Href \| undefined` | — | Renders a native `<a role="treeitem">` (link navigation). |
| `TreeView.Item` | `target` | `string \| undefined` | — | With `href`: passed to the anchor; not `_self` opens elsewhere. |
| `TreeView.Item` | `current` | `LinkCurrent \| undefined` | — | With `href`: sets `aria-current` and `data-current`; the link still navigates. |
| `TreeView.Item` | `routerOptions` | `RouterOptions \| undefined` | — | With `href`: passed unchanged to the router's `navigate`. |
| `TreeView.ItemText` | `render` | `RenderProp<undefined>` | — | Another element or a render function receiving the props. |
| `TreeView.ItemIndicator` | `render` | `RenderProp<undefined>` | — | Another element or a render function receiving the props. |
| `TreeView.ItemCheckbox` | `render` | `RenderProp<undefined>` | — | Another element or a render function receiving the props. |
| `TreeView.Loading` | `render` | `RenderProp<undefined>` | — | Another element or a render function receiving the props. |
| `TreeView.Empty` | `render` | `RenderProp<undefined>` | — | Another element or a render function receiving the props. |

Every attribute of the rendered element is accepted and forwarded.

### Data attributes

| Part | Attribute | When |
|---|---|---|
| `tree` | `data-scope` | "tree-view" |
| `tree` | `data-part` | "tree" |
| `tree` | `data-instance` | The instance id. |
| `tree` | `data-selection-mode` | single \| multiple \| none. |
| `tree` | `data-checkable` | A checkable tree. |
| `tree` | `data-empty` | No visible nodes. |
| `tree` | `data-focus` | Focus is in the tree. |
| `tree` | `data-focus-visible` | Keyboard focus is in the tree. |
| `tree` | `data-disabled` | Disabled. |
| `item` | `data-scope` | "tree-view" |
| `item` | `data-part` | "item" |
| `item` | `data-instance` | The instance id. |
| `item` | `data-key` | The node key. |
| `item` | `data-level` | The node's level (1 for roots). |
| `item` | `data-branch` | A branch. |
| `item` | `data-state` | open \| closed (branches). |
| `item` | `data-expanded` | An expanded branch. |
| `item` | `data-selected` | Selected. |
| `item` | `data-checked` | Checked. |
| `item` | `data-indeterminate` | Some descendant leaves checked. |
| `item` | `data-highlighted` | The highlighted (focused) item. |
| `item` | `data-disabled` | Disabled. |
| `item` | `data-loading` | Children are loading. |
| `item` | `data-error` | Loading children failed. |
| `item` | `data-focus-visible` | Keyboard focus. |
| `item` | `data-hover` | Under the pointer. |
| `item` | `data-pressed` | Being pressed. |
| `item` | `data-dragging` | Being dragged by a pointer. |
| `item` | `data-drop-target` | A pointer drag would drop inside it. |
| `drop-indicator` | `data-scope` | "tree-view" |
| `drop-indicator` | `data-part` | "drop-indicator" |
| `drop-indicator` | `data-instance` | The instance id. |
| `drop-indicator` | `data-position` | before \| after \| inside. |
| `drop-indicator` | `data-hidden` | No target. |
| `item-indicator` | `data-scope` | "tree-view" |
| `item-indicator` | `data-part` | "item-indicator" |
| `item-indicator` | `data-instance` | The instance id. |
| `item-indicator` | `data-state` | open \| closed. |
| `item-indicator` | `data-loading` | The branch is loading. |
| `item-indicator` | `data-disabled` | The item is disabled. |
| `item-checkbox` | `data-scope` | "tree-view" |
| `item-checkbox` | `data-part` | "item-checkbox" |
| `item-checkbox` | `data-instance` | The instance id. |
| `item-checkbox` | `data-state` | checked \| unchecked \| indeterminate. |

### Keyboard

| Key | Action |
|---|---|
| ArrowDown, ArrowUp | Next / previous visible item. |
| Home, End | First / last visible item. |
| ArrowRight | Collapsed branch: expand; expanded branch: first child (mirrored in right-to-left). |
| ArrowLeft | Expanded branch: collapse; otherwise: the parent (mirrored in right-to-left). |
| * | Expand every sibling branch. |
| Space | Select (or check, in a checkable tree). |
| Enter | Activate: follow the link, onAction, then select or toggle the branch. |
| Shift+ArrowDown/Up, Shift+Space | Extend the range from the anchor (multiple). |
| mod+A | Select the visible items (multiple). |
| Characters | Typeahead over the visible items. |
| Alt+ArrowUp, Alt+ArrowDown | Movable: move the item before / after its sibling. |
| Alt+ArrowRight, Alt+ArrowLeft | Movable: into the branch above / out of its branch. |

### States

| State | Description |
|---|---|
| `idle` | Focus is outside the tree. |
| `focused` | Focus is in the tree: keys navigate, expand and select. |

### Contract

| Action | Modalities |
|---|---|
| `expand` | keyboard |
| `collapse` | keyboard |
| `toggle` | keyboard |
| `check` | keyboard |
| `expandSiblings` | keyboard |
| `act` | pointer, keyboard, virtual |
| `expandAll` | keyboard |
| `focusIn` | keyboard |
| `tabOut` | keyboard |
| `next` | keyboard |
| `typeS` | keyboard |
| `space` | keyboard |
| `enter` | keyboard |
| `star` | keyboard |
| `selectAll` | keyboard |
| `moveNode` | keyboard |
| `dragNode` | pointer, virtual |

Queries: `items`, `isExpanded`, `expandedNames`, `isBusy`, `isEmpty`, `highlighted`, `selected`, `checked`, `hasFocus`. Traits: `composite-roving`, `set-metadata`, `selectable`.
<!-- /api -->

## Expansion

Expanded keys are a controllable value: `expandedValue`, `defaultExpandedValue` and `onExpandedChange(keys, { reason })`, where `reason` is `"key"`, `"press"`, `"api"`, `"siblings"` or `"all"`. Only branch keys count; unknown keys are ignored. Right on a collapsed branch expands it and keeps it highlighted, Right again moves to its first child; Left collapses an expanded branch, or moves to the parent. `*` expands every sibling branch. A press on the `ItemIndicator` toggles the branch without moving focus or changing the selection; a press on the row toggles it too (`expandOnClick`, default true) unless a modifier key is held.

Collapsing a branch never deselects the nodes it hides. If the highlighted row disappears, the highlight moves to its nearest visible ancestor.

## Selection and checkboxes

`selectionMode` is `"single"` (default), `"multiple"` or `"none"`; `selectionBehavior` `"toggle"` (default) or `"replace"` (selection follows focus, Ctrl or Cmd adds, Shift extends a range). The value is a key or `null` (single) or a list of keys (multiple). Ranges and select all (Ctrl or Cmd + A) cover the visible rows only, and select all always gives an explicit key list.

With `checkable`, rows carry `aria-checked` instead of a selection: Space and a press on the `ItemCheckbox` toggle the check. With `checkPropagation="both"` (default) a branch is checked when all its leaves are, unchecked when none are, and mixed otherwise; toggling a branch sets or clears all its enabled leaves. `checkedValue` holds **leaf keys only**: a branch you need as a value is derived from its leaves. A branch whose children are not loaded yet counts as a leaf, and when its children arrive they show checked. Disabled leaves keep their state.

## Activation and links

Enter runs, in order: a link item follows its link; `onAction(key, details)` is called when given; a selectable tree selects the row; otherwise a branch toggles. Space never runs `onAction`: it selects or checks.

A row with `href` renders a native `<a role="treeitem">`, so the browser's context menu, middle click and Ctrl or Cmd click work, and `current="page"` marks the current page (`aria-current`, `data-current`). Inside a `RouterProvider` a link navigates with your router.

## Lazy loading

Mark an unloaded branch with `isBranch: true` and no `children`, and pass `onLoadChildren(key, { signal })`. It is called once, the first time the branch opens, until the children arrive or the call fails. While it loads, the branch has `aria-busy` and `data-loading`, a `Loading` row is rendered under it, and "Loading {name}" is announced; when the children arrive, "{n} items loaded in {name}" is announced. Collapsing the branch, or unmounting the tree, aborts the `signal`. If the returned promise rejects, the branch gets `data-error` and the next expand calls the loader again.

```tsx
<TreeView.Root
  items={items}
  onLoadChildren={async (key, { signal }) => {
    const children = await fetchChildren(key, { signal })
    setItems((all) => withChildren(all, key, children))
  }}
>
  …
</TreeView.Root>
```

A loader that does not return a promise works too: the load ends when a new `items` value contains the branch's children.

## Keyboard

| Key | Action |
|---|---|
| ArrowDown, ArrowUp | Next / previous visible row. |
| Home, End | First / last visible row. |
| ArrowRight | Collapsed branch: expand. Expanded branch: first child. Mirrored in right-to-left. |
| ArrowLeft | Expanded branch: collapse. Otherwise: the parent. Mirrored in right-to-left. |
| `*` | Expand every sibling branch. |
| Space | Select, or check in a checkable tree. |
| Enter | Activate (link, `onAction`, then select or toggle). |
| Shift+ArrowDown / ArrowUp, Shift+Space | Extend the range from the anchor (multiple). |
| Ctrl or Cmd + A | Select the visible rows (multiple). |
| Characters | Typeahead over the visible rows. |
| Alt + ArrowUp / ArrowDown | `movable`: move before / after the sibling. |
| Alt + ArrowRight / ArrowLeft | `movable`: into the folder above / out of its folder. |

Keys the tree does not use (F2, Delete, Ctrl+C) are left alone and never prevented, so a rename or clipboard handler in your `onKeyDown` on `TreeView.Tree` works. Your handler runs first and can `preventDefault()` to stop the tree. Keys typed in an editable element inside a row (an inline rename input) never reach the tree.

## Tree, Grid List or Table

A tree item is a single focusable row with no controls inside it: its name is read whole and its keys belong to the tree. When rows need their own buttons or inputs, use a Grid List (a flat list) or a Table (columns). Development builds warn when an item contains a focusable element. The `ItemIndicator` and `ItemCheckbox` are not controls: they are hidden from assistive technology and their presses are handled by the row.

## Accessibility notes

- **Roles.** `tree` with `treeitem` rows (an `<a>` for links). Rows carry `aria-level`, `aria-setsize` and `aria-posinset` for their sibling set, and branches `aria-expanded`; leaves never do.
- **Name.** Label, or `aria-label` / `aria-labelledby`. A row is named by its `ItemText`.
- **Selection.** `aria-selected` on rows, `aria-multiselectable` in a multiple tree; a checkable tree uses `aria-checked` (`mixed` for a partly checked branch) and no `aria-selected`.
- **Focus.** One tab stop. Tabbing back into the tree lands on the selected row, or on its nearest visible ancestor when the selection is hidden by a collapsed branch.
- **Announcements.** Lazy loading only: loading, loaded and failed, politely (failures assertively).

## Styling

Rows indent from the `--rind-tree-view-level` custom property each row carries (1 for roots). The indicator's `data-state` is `open` or `closed`; rotate it from that and mirror it in right-to-left. Keep rows at least 24px tall and the indicator's hit area 24 by 24px. Do not make the tree a flex container, and give rows `min-inline-size: fit-content` so their background spans a horizontal scroll.

## Testing

`getTreeView(screen, { name })` locates the tree by role and accessible name. Items are addressed by name, or by a name path when names repeat across folders. Actions: `expand`, `collapse`, `toggle`, `check`, `expandSiblings`, `act`, `expandAll` (actions on a hidden node expand its ancestors with the keyboard first), `moveNode(item, "up" | "down" | "in" | "out")` and `dragNode(item, over, "before" | "inside" | "after")`. Queries: `items`, `isExpanded`, `expandedNames`, `isBusy`, `isEmpty`, `highlighted`, `selected`, `checked`, `hasFocus`.

```tsx
import { getTreeView } from "@rind-ui/testing"

render(<FileTree />)
const files = getTreeView(screen, { name: "Files" })
await files.expand(["src"])
await files.act(["src", "index.ts"])
expect(await files.expandedNames()).toEqual(["src"])
```

To test the machine without a DOM, `testMachine(treeViewContract, …)` from `@rind-ui/testing` walks the state graph against the contract's oracle.

## Tested with

<!-- tested-with:tree-view -->
_No manual screen-reader pass recorded yet._
<!-- /tested-with -->
