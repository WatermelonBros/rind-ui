# Listbox

A list of options the user moves through with the keyboard and picks from: single or multiple selection, or an action list with no selection at all. Options can be grouped in sections, carry a description and an indicator, load more as the user scrolls, and be virtualized. The list is one tab stop and the options move by roving focus. The same parts power other composite components (see [Reusing the listbox parts](#reusing-the-listbox-parts)).

## When to use

- **Use it for** a visible list of options the user picks from with the keyboard: single or multiple selection, or an action list with no selection.
- **Over a native `<select multiple>`**: it adds sections, descriptions, indicators, incremental loading, virtualization, and `data-*` state to style.
- **Don't use it for** a list that opens from a control: use a [Select](select.md), or a [Combobox](combobox.md) when the user types to filter. For commands, use a [Menu](menu.md).

```tsx
import { Listbox } from "@rind-ui/react"

<Listbox.Root defaultValue="banana" onValueChange={(value) => save(value)}>
  <Listbox.Label>Fruit</Listbox.Label>
  <Listbox.List>
    <Listbox.Item value="apple">
      <Listbox.ItemText>Apple</Listbox.ItemText>
      <Listbox.ItemIndicator>✓</Listbox.ItemIndicator>
    </Listbox.Item>
    <Listbox.Item value="banana">
      <Listbox.ItemText>Banana</Listbox.ItemText>
      <Listbox.ItemIndicator>✓</Listbox.ItemIndicator>
    </Listbox.Item>
  </Listbox.List>
</Listbox.Root>
```

The list needs an accessible name: render a `Listbox.Label`, or pass `aria-label` / `aria-labelledby` to `Listbox.List`. Development builds warn when it has none.

## API

<!-- api:listbox -->

## Anatomy

| Part | `data-part` | Element |
|---|---|---|
| `Listbox.Root` | none | Renders no element: it owns the state and provides it to the parts. |
| `Listbox.Label` | `label` | `<span>` naming the list. |
| `Listbox.List` | `list` | `<div role="listbox">`; the tab stop. |
| `Listbox.Item` | `item` | `<div role="option">`; `value` is its key. |
| `Listbox.ItemText` | `item-text` | `<span>` holding the option's name. |
| `Listbox.ItemDescription` | `item-description` | `<span aria-hidden="true">`, referenced from the option's `aria-describedby`. |
| `Listbox.ItemIndicator` | `item-indicator` | `<span aria-hidden="true">`, rendered only while selected (`keepMounted` keeps it). |
| `Listbox.Section` / `Separator` | `section`, `section-label` / `separator` | A group of options with its label / a decorative divider. |
| `Listbox.Empty` | `empty` | `<div>` shown while the collection is empty, after the List. |
| `Listbox.LoadMore` | `load-more` | `<div aria-hidden="true">`, the scroll sentinel after the last item. |
| `Listbox.Items` | none | Data mode: renders every section and item of `items`. |

Item state is on the option: `data-highlighted`, `data-disabled`, `data-state="selected" \| "unselected"` and `aria-selected`. The List carries `data-selection-mode`, `data-empty` and `data-loading`, plus `aria-busy` while loading.

## Selection modes and behaviours

`selectionMode` is `"single"` (default), `"multiple"` or `"none"`.

- **single.** `value` is a key or `null`. Space or Enter selects the highlighted option; pressing it again keeps it selected.
- **multiple.** `value` is an array of keys, or `"all"`. `disallowEmptySelection` keeps at least one option.
- **none.** Nothing is selected; the list is for actions.

`selectionBehavior` decides what a press does in a multiple list:

- `"toggle"` (default): each press or Space adds or removes that option.
- `"replace"`: a press selects only that option. Ctrl or Cmd with a press, or Space, toggles it; Shift with a press or an arrow key extends a range from the anchor; Ctrl or Cmd + A selects everything enabled (again: nothing).

`onValueChange(value, { reason, key })` runs for every change. `value` / `defaultValue` follow the usual controlled and uncontrolled rules.

## Actions

An action is "open this" as opposed to "select this". `onAction(key, details)` is available where it cannot clash with selection: `selectionMode="none"`, or a multiple list with `selectionBehavior="replace"`. In none mode, Enter and a press run it. In replace behaviour, Enter and a double click run it, while Space and single presses keep selecting. Disabled options never run it.

```tsx
<Listbox.Root selectionMode="none" onAction={(key) => run(key)}>
  <Listbox.Label>Commands</Listbox.Label>
  <Listbox.List>
    <Listbox.Item value="rename"><Listbox.ItemText>Rename</Listbox.ItemText></Listbox.Item>
    <Listbox.Item value="archive"><Listbox.ItemText>Archive</Listbox.ItemText></Listbox.Item>
  </Listbox.List>
</Listbox.Root>
```

## Keyboard

| Key | Behaviour |
|---|---|
| Arrow Down / Up (Right / Left when `orientation="horizontal"`) | Moves the highlight. Left and Right follow the writing direction in RTL. |
| Home / End | First / last enabled option. |
| Page Up / Page Down | Moves by a page of options. |
| Characters | Typeahead: moves to the next option whose text starts with the typed text. `typeaheadTimeout` (1000 ms) resets it. |
| Space / Enter | Selects the highlighted option; Enter runs the action where there is one. |
| Shift + arrows / Ctrl or Cmd + A | Range and select-all, in a multiple list. |

`loop` wraps the highlight at the ends. Disabled options are skipped; `disabledBehavior="selection"` keeps them reachable by keys while refusing selection.

## Data mode

Pass `items` instead of Item parts and render them with `Listbox.Items`. A row is `{ key, label, disabled?, section? }`; `section` is `{ key, label }`.

```tsx
<Listbox.Root items={rows}>
  <Listbox.Label>Assignee</Listbox.Label>
  <Listbox.List>
    <Listbox.Items>{(label) => <Listbox.ItemText>{label}</Listbox.ItemText>}</Listbox.Items>
  </Listbox.List>
</Listbox.Root>
```

## Descriptions and icons

Put the name in `ItemText` and a secondary line in `ItemDescription`. The description is `aria-hidden` and referenced by the option's `aria-describedby`, so it is read after the name and is not part of it. An icon inside the item must be decorative (`aria-hidden`). Options cannot hold interactive elements; development builds warn about one.

## Empty and loading

Render `Listbox.Empty` after the List: it shows while the collection is empty and the status is `idle`, and the List refers to it with `aria-describedby`. While `loading` is `"loading"` or `"loading-more"` the List carries `aria-busy="true"` and `data-loading`, and Empty stays hidden.

For infinite scroll, set `onLoadMore`, drive `loading` from your request and render `Listbox.LoadMore` after the last item. `onLoadMore` fires once per collection when the sentinel scrolls into view while the status is `idle`. Loading text goes outside the list or in Empty.

## Virtualization

Set `virtualized` and pass a `collection` you build over the whole data set, not only the rows in the DOM. Render only the visible options and give each its `value`; the machine navigates the collection, so keys, Home / End and typeahead reach rows that are not rendered. Pass `scrollToIndex` so a highlight on an unrendered row scrolls it into view: it is called with the target index, and your virtualizer scrolls there. Options in a virtualized list carry `aria-setsize` and `aria-posinset` from the collection.

## Reusing the listbox parts

`createListboxParts(useHost)` builds the same parts, bound to a host that supplies the collection, service and ids. A component that shows options in its own surface renders them with these parts and keeps the attributes, keyboard and selection identical to a Listbox. `Listbox.Root` is the reference host.

## Accessibility notes

- **Roles.** `listbox` with `option` children, grouped with `group` (a Section, named by its label). A separator between groups is decorative.
- **Name.** Label, or `aria-label` / `aria-labelledby`.
- **Selection.** `aria-selected` on options, `aria-multiselectable` in a multiple list. A none-mode list sets no `aria-selected`.
- **Focus.** One tab stop; options take focus by roving (`strategy="roving"`, default) or the list keeps focus and points at the option with `aria-activedescendant` (`strategy="activedescendant"`).
- **Announcements.** None from the component: moving focus reads the option name and its selected state.

## Styling

Style the `data-*` attributes above. Pressing and the highlight are separate: `data-highlighted` marks the keyboard or pointer highlight and `data-focus-visible` appears only for keyboard focus.

## Testing

`getListbox(screen, { name })` locates the listbox by role and accessible name. Actions: `choose`, `toggle`, `chooseRange`, `selectAll`, `typeahead`, `act` (the action), plus highlight and focus moves. Queries: `items`, `selected`, `highlighted`, `isEmpty`, `selectionMode`, `hasFocus`.

```tsx
import { getListbox } from "@rind-ui/testing"

render(<FruitList />)
const fruit = getListbox(screen, { name: "Fruit" })
await fruit.choose("Cherry")
expect(await fruit.selected()).toEqual(["Cherry"])
await fruit.typeahead("ba")
expect(await fruit.highlighted()).toBe("Banana")
```

To test the machine without a DOM, `testMachine(listboxMachine, props)` from `@rind-ui/testing` walks the state graph against the contract's oracle.

## Tested with

<!-- tested-with:listbox -->
_No manual screen-reader pass recorded yet._
<!-- /tested-with -->
