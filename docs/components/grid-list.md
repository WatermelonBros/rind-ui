# Grid List

A list of rows that each can hold their own interactive content: a selection checkbox, buttons, a text field, a link, even a nested Tag Group. Users move between rows with the arrow keys from one Tab stop, reach a row's controls with ArrowRight (or Tab), select rows, and run a row's action with Enter or a press.

## When to use

- **Use it for** rows that carry their own actions: candidates with "Message" and "Archive", files with "Remove", a shopping list with a quantity field, cards in a grid with a "Share" button.
- **Over a Listbox**: a Listbox option is one choice and must not contain interactive content. As soon as a row needs its own buttons or fields, use a Grid List: each control stays reachable from the keyboard and named for screen readers, and a press on a control never selects or acts on its row.
- **Over a plain list of buttons**: one Tab stop for the whole list, arrow keys between rows, selection with Space and Shift, typeahead, and the selection announced.
- **Don't use it for** a single choice among options: use a [Listbox](listbox.md) or a [Select](select.md). For tabular data with columns and sorting, a table is the right pattern. For removable chips, use a [Tag Group](tag-group.md).

```tsx
import { GridList } from "@rind-ui/react"

<GridList.Root selectionMode="multiple" onAction={(key) => open(key)}>
  <GridList.Label>Candidates</GridList.Label>
  <GridList.List>
    {people.map((p) => (
      <GridList.Item key={p.key} value={p.key}>
        <GridList.ItemCheckbox />
        <GridList.ItemText>{p.name}</GridList.ItemText>
        <GridList.ItemDescription>{p.role}</GridList.ItemDescription>
        <GridList.ItemControl aria-label={`Message ${p.name}`}>Message</GridList.ItemControl>
      </GridList.Item>
    ))}
    <GridList.Empty>No candidates</GridList.Empty>
  </GridList.List>
</GridList.Root>
```

Every focusable element inside a row must be an `ItemControl` (or the `ItemCheckbox`): the list navigates only to those, and in development it warns about any other focusable element it finds in a row. Give `ItemControl` your own element with `render`:

```tsx
<GridList.Root childNavigation="tab">
  <GridList.Label>Shopping list</GridList.Label>
  <GridList.List>
    <GridList.Item value="bread">
      <GridList.ItemText>Bread</GridList.ItemText>
      <GridList.ItemControl render={(props) => <input {...props} aria-label="Quantity" />} />
    </GridList.Item>
  </GridList.List>
</GridList.Root>
```

## API

<!-- api:grid-list -->

## Rows and controls

- **Row name.** A row is named by its `ItemText` only, never by its controls' labels, so a screen reader reads "Ada Lovelace", not "Ada Lovelace Message Archive". `ItemDescription` describes it.
- **Arrow mode** (default, `childNavigation="arrow"`). ArrowRight moves from the row into its controls one by one, ArrowLeft back, Escape returns to the row. It does not wrap past the last control. In right-to-left the horizontal arrows are mirrored.
- **Tab mode** (`childNavigation="tab"`). For rows with text fields: Tab moves through the highlighted row's controls, then out of the list; the arrows stay inside the field.
- **Keys a control keeps.** A text field keeps every key; a nested composite (a Tag Group) handles its own keys. On a button, only ArrowUp, ArrowDown and Escape (and the horizontal arrows in arrow mode) are the list's.
- **Grid layout.** `layout="grid"` lays rows out in columns: ArrowUp and ArrowDown move to the row visually above or below, measured on the page (in collection order when it cannot be measured).

## Selection and actions

| Configuration | A press on the row | Space | Enter |
|---|---|---|---|
| `onAction`, no selection | runs the action | — | runs the action |
| `selectionMode`, toggle (default) | toggles; runs the action while nothing is selected | toggles | runs the action, else toggles |
| `selectionBehavior="replace"` | selects only that row; a double press runs the action | toggles | runs the action |
| With `ItemCheckbox` | runs the action (only the checkbox selects) | toggles | runs the action |
| Link row (`href`) | follows the link | — | follows the link |

A press on a control (or on a field inside the row) never selects or acts on its row, even when the control stops the event's propagation. Disabled rows stay focusable and announced; their controls are disabled. Escape never clears the selection.

## Keyboard

The API block lists every key. In short: ArrowUp and ArrowDown between rows, ArrowRight and ArrowLeft into a row's controls (arrow mode), Space toggles the selection, Enter follows the link or runs the action, Shift with the arrows extends a range, ⌘A or Ctrl+A selects all, Escape returns from a control to its row, and typing jumps to a row by its text.

## Styling

The theme places rows in the collection item family: tokens `--rind-grid-list-*` (gap, columns, row minimum height, padding, radius, hover, highlight and selected backgrounds, description and empty text, checkbox size). Selected rows get a heavier weight as well as a background, a row whose control has keyboard focus shows `data-focus-visible-within`, and controls keep a 24px target. The list and the rows are never `display: contents`.

## Testing

```ts
import { getGridList } from "@rind-ui/testing"

const people = getGridList(screen, { name: "Candidates" }, { modality: "keyboard" })
await people.check("Grace Hopper")
expect(await people.selected()).toEqual(["Grace Hopper"])
expect(await people.controls("Ada Lovelace")).toEqual(["Message", "Archive"])
await people.focusControl("Ada Lovelace", "Archive")
await people.act("Alan Turing")
```

Actions: `highlight`, `choose`, `toggle`, `chooseRange`, `selectAll`, `typeahead`, `focusIn`, `tabOut`, `next`, `act`, `check`, `focusControl`, `pressControl`. Queries: `items`, `rows`, `highlighted`, `selected`, `disabled`, `focusedItem`, `hasFocus`, `isEmpty`, `selectionMode`, `controls`.

## Accessibility tree

Rows with a checkbox and actions (generated from the state example):

<!-- aria:grid-list--candidates -->
```yaml
- text: Candidates
- grid "Candidates":
  - row "Ada Lovelace":
    - gridcell "Select Ada Lovelace Analyst Message Ada Lovelace Archive Ada Lovelace":
      - checkbox "Select Ada Lovelace"
      - text: Ada Lovelace Analyst
      - button "Message Ada Lovelace": Message
      - button "Archive Ada Lovelace": Archive
  - row "Grace Hopper":
    - gridcell "Select Grace Hopper Compiler engineer Message Grace Hopper Archive Grace Hopper":
      - checkbox "Select Grace Hopper"
      - text: Grace Hopper Compiler engineer
      - button "Message Grace Hopper": Message
      - button "Archive Grace Hopper": Archive
  - row "Alan Turing":
    - gridcell "Select Alan Turing Mathematician Message Alan Turing Archive Alan Turing":
      - checkbox "Select Alan Turing"
      - text: Alan Turing Mathematician
      - button "Message Alan Turing": Message
      - button "Archive Alan Turing": Archive
  - row "Edsger Dijkstra":
    - gridcell "Select Edsger Dijkstra Researcher Message Edsger Dijkstra Archive Edsger Dijkstra":
      - checkbox "Select Edsger Dijkstra"
      - text: Edsger Dijkstra Researcher
      - button "Message Edsger Dijkstra": Message
      - button "Archive Edsger Dijkstra": Archive
- paragraph
```
<!-- /aria -->

## Tested with

<!-- tested-with:grid-list -->
_No manual screen-reader pass recorded yet._
<!-- /tested-with -->
