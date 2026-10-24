# Tag Group

A collection of tags (labels, keywords, filters, recipients) that users browse with one Tab stop and, depending on what you pass, select, act on, follow as links, or remove. Removing a tag moves focus to its neighbour and is announced; the group never leaves focus on the page body.

## When to use

- **Use it for** tags shown next to content: keywords on an article, filter chips above a list, recipients, labels that open their issues.
- **Over a row of buttons or links**: one Tab stop for the whole set, arrow keys between tags, removal with Delete and a remove button that is not an extra Tab stop, and the removal announced.
- **Don't use it for** chips inside a text field that the user types into: those belong to the combobox or tags input. For a single choice among a few options, use a [Segmented Control](segmented-control.md) or a [Radio Group](radio-group.md).

```tsx
import { TagGroup } from "@rind-ui/react"

const [tags, setTags] = useState(["Rome", "Paris", "Oslo"])

<TagGroup.Root onRemove={(keys) => setTags((all) => all.filter((t) => !keys.includes(t)))}>
  <TagGroup.Label>Cities</TagGroup.Label>
  <TagGroup.List>
    {tags.map((t) => (
      <TagGroup.Tag key={t} value={t}>
        <TagGroup.TagText>{t}</TagGroup.TagText>
        <TagGroup.TagRemove />
      </TagGroup.Tag>
    ))}
    <TagGroup.Empty>No cities</TagGroup.Empty>
  </TagGroup.List>
</TagGroup.Root>
```

The list needs an accessible name: render a `TagGroup.Label`, or pass `aria-label` / `aria-labelledby` to `TagGroup.List`. Development builds warn when an interactive list has none.

## API

<!-- api:tag-group -->
### Anatomy

| Part | `data-part` | Element | Description |
|---|---|---|---|
| `TagGroup.Root` | `root` | `<div>` | Holds the state; wraps the label, description and list. |
| `TagGroup.Label` | `label` | `<span>` | Names the list (`aria-labelledby`) while rendered. |
| `TagGroup.Description` | `description` | `<span>` | Describes the list (`aria-describedby`) while rendered. |
| `TagGroup.List` | `list` | `<div>` | `role="grid"` when interactive, `"group"` when interactive and empty, `"list"` when display-only; one Tab stop. |
| `TagGroup.Tag` | `item` | `<div>` | `role="row"` (`"listitem"` when display-only) named by its TagText; renders one `gridcell` (`item-cell`). |
| `TagGroup.TagText` | `item-text` | `<span>` | The tag's name; an `<a>` (Tab-skipped) when the Tag has `href`. |
| `TagGroup.TagRemove` | `item-remove` | `<button>` | "Remove <text>", `tabIndex=-1`: removal by press or virtual cursor. |
| `TagGroup.Empty` | `empty` | `<div>` | Inside the List while it has no tags. |

### Props

| Part | Prop | Type | Default | Description |
|---|---|---|---|---|
| `TagGroup.Root` | `onRemove` | `(keys: string[], { reason }) => void` | — | Tags are removable: drop the keys from your data (or keep them). |
| `TagGroup.Root` | `selectionMode` | `"none" \| "single" \| "multiple"` | `"none"` | Selectable tags (filter chips). |
| `TagGroup.Root` | `value` | `string \| null \| string[]` | — | Controlled selection. |
| `TagGroup.Root` | `defaultValue` | `string \| null \| string[]` | — | Uncontrolled selection. |
| `TagGroup.Root` | `onValueChange` | `(value, { reason, key }) => void` | — | Every selection change. |
| `TagGroup.Root` | `onAction` | `(key, { modality, via }) => void` | — | Enter, Space or a press on a tag. |
| `TagGroup.Root` | `disabled` | `boolean` | `false` | No Tab stop, no keys or presses. |
| `TagGroup.Root` | `loop` | `boolean` | `true` | Arrow keys wrap around. |
| `TagGroup.Root` | `items` | `{ key, label, disabled?, href? }[]` | — | Data tags (else Tag parts register). |
| `TagGroup.Root` | `messages` | `Partial<TagGroupMessages>` | — | removeLabel, removeHint, removedAnnouncement, removedCountAnnouncement. |
| `TagGroup.Root` | `focusableWhenDisabled` | `boolean` | — | Disabled tags stay reachable (announced as dimmed). Default true. |
| `TagGroup.Root` | `typeaheadTimeout` | `number` | `1000` | How long typed characters build one typeahead search (ms). |
| `TagGroup.Root` | `collection` | `Collection<unknown>` | — | A collection built by the consumer, used instead of `items`. |
| `TagGroup.Root` | `render` | `RenderProp` | — | Another element or a render function receiving the props. |
| `TagGroup.Root` | `disallowEmptySelection` | `boolean` | — | No user action leaves the selection empty. |
| `TagGroup.Label` | `render` | `RenderProp` | — | Another element or a render function receiving the props. |
| `TagGroup.Description` | `render` | `RenderProp` | — | Another element or a render function receiving the props. |
| `TagGroup.List` | `render` | `RenderProp` | — | Another element or a render function receiving the props. |
| `TagGroup.Tag` | `render` | `RenderProp` | — | Another element or a render function receiving the props. |
| `TagGroup.Tag` | `value` | `string` | — | The tag key. |
| `TagGroup.Tag` | `textValue` | `string` | — | The tag's text for typeahead and the remove button's name. |
| `TagGroup.Tag` | `disabled` | `boolean` | — | Disables this tag: it cannot be selected or removed. |
| `TagGroup.Tag` | `href` | `string` | — | A link tag: TagText renders an anchor to it. |
| `TagGroup.TagText` | `render` | `RenderProp` | — | Another element or a render function receiving the props. |
| `TagGroup.TagRemove` | `render` | `RenderProp` | — | Another element or a render function receiving the props. |
| `TagGroup.Empty` | `render` | `RenderProp` | — | Another element or a render function receiving the props. |
| `TagGroup.Tags` | `children` | `(label: string, key: string) => ReactNode` | — | Renders one tag's content from its label and key; default: TagText and TagRemove. |

Every attribute of the rendered element is accepted and forwarded.

### Data attributes

| Part | Attribute | When |
|---|---|---|
| `root` | `data-scope` | "tag-group" |
| `root` | `data-part` | "root" |
| `root` | `data-instance` | The instance id. |
| `root` | `data-empty` | No tags. |
| `root` | `data-disabled` | Disabled. |
| `list` | `data-scope` | "tag-group" |
| `list` | `data-part` | "list" |
| `list` | `data-instance` | The instance id. |
| `list` | `data-orientation` | both (interactive). |
| `list` | `data-selection-mode` | single \| multiple (selectable only). |
| `list` | `data-focus-visible` | The list itself has keyboard focus (empty). |
| `list` | `data-disabled` | Disabled. |
| `list` | `data-empty` | No tags. |
| `item` | `data-scope` | "tag-group" |
| `item` | `data-part` | "item" |
| `item` | `data-instance` | The instance id. |
| `item` | `data-key` | The tag key. |
| `item` | `data-highlighted` | The highlighted (focused) tag. |
| `item` | `data-selected` | Selected. |
| `item` | `data-disabled` | Disabled. |
| `item` | `data-focus-visible` | Keyboard focus. |
| `item` | `data-hover` | Mouse or pen over an interactive tag. |
| `item` | `data-pressed` | Pressed. |
| `item` | `data-removable` | The group has `onRemove`. |
| `item` | `data-link` | The tag has `href`. |

### Keyboard

| Key | Action |
|---|---|
| Arrow keys, Home, End | Move between tags (Left/Right mirrored in RTL); they loop. |
| Delete, Backspace | Remove the tag, or every selected tag when it is selected. |
| Enter, Space | Follow the link, run the action, toggle the selection, else remove. |
| Characters | Typeahead. |
| Escape | Not handled: the enclosing layer gets it. |

### States

| State | Description |
|---|---|
| `idle` | Focus is outside the group. |
| `focused` | Focus is in the group: keys navigate, activate and remove. |

### Contract

| Action | Modalities |
|---|---|
| `highlight` | pointer, keyboard, virtual |
| `choose` | pointer, keyboard, touch, virtual |
| `toggle` | pointer, keyboard, virtual |
| `chooseRange` | pointer, keyboard, virtual |
| `selectAll` | keyboard |
| `typeahead` | keyboard |
| `focusIn` | keyboard |
| `tabOut` | keyboard |
| `next` | keyboard |
| `typeR` | keyboard |
| `remove` | pointer, keyboard, virtual |
| `removeSelected` | keyboard |
| `act` | pointer, keyboard, virtual |

Queries: `items`, `highlighted`, `selected`, `disabled`, `focusedItem`, `tags`, `hasFocus`, `isEmpty`, `isRemovable`. Traits: `composite-roving`, `directional`.
<!-- /api -->

## Roles

The roles follow what the group does:

| The group | List | Tag | Cell |
|---|---|---|---|
| removable, selectable, with actions or links | `grid` | `row` | `gridcell` |
| the same, with no tags | `group` (keeps its name; takes focus) | — | — |
| display-only | `list` | `listitem` | — |

A display-only group has no Tab stop and no keyboard handling. A tag is never an `option`, because an option cannot hold a button or a link.

## Removal

Pass `onRemove` and drop the keys from your data; keep them to refuse the removal (the tag stays, focus stays on it, and nothing is announced).

- **Delete or Backspace** removes the focused tag, or every selected enabled tag when the focused one is selected.
- **Enter or Space** removes a tag that has nothing else to do: no link, no action, no selection.
- **TagRemove** removes its own tag only, never the selection, and never toggles the tag.

Focus moves to the tag after the removed one, else the one before it, else the list. Removal is announced politely ("Rome removed", "3 tags removed").

### Why the remove button is not a Tab stop

A remove button per tag would turn five tags into ten Tab stops. Keyboard users remove with Delete or Backspace instead. In keyboard and screen-reader modality, each removable tag is described by a hidden "Press Delete to remove" hint, which is not shown to mouse users or on touch devices. Screen-reader users can still reach every remove button with the virtual cursor.

## Selection, actions and links

- **Selection**: `selectionMode="single"` or `"multiple"`, `value` / `defaultValue` / `onValueChange`. Enter, Space and a press toggle a tag; arrow keys never select; Escape is left to the page (a surrounding dialog closes).
- **Actions**: `onAction(key)` runs on Enter, Space or a press.
- **Links**: a Tag with `href` renders its TagText as an anchor out of the Tab order; Enter or a press follows it through a click on the anchor, so routers and modifier keys keep working.

When several apply, a link wins, then an action, then selection, then (keyboard only) removal.

## Keyboard

| Key | Does |
|---|---|
| Arrow keys | Move between tags; Left and Right are mirrored in right-to-left; moves wrap |
| Home, End | First and last tag |
| Delete, Backspace | Remove the tag, or the selection when the tag is selected |
| Enter, Space | Link, action, selection, else removal |
| Characters | Typeahead over the tags' text |

## Data mode

Pass `items` (`{ key, label, disabled?, href? }[]`) and render `<TagGroup.Tags />` in the list. It renders each tag with its text and, when the group is removable, its remove button; pass a render function for your own content.

## Messages

Every string that reaches assistive technology comes from `messages`: `removeLabel(text)` ("Remove {text}"), `removeHint` ("Press Delete to remove"), `removedAnnouncement(text)` ("{text} removed") and `removedCountAnnouncement(count)` ("{count} tags removed").

## Styling

The theme places tags in the status family: `data-variant` (`soft`, `solid`, `outline`) and `data-size` (`sm`, `md`, `lg`) on the Root (every tag) or on one Tag, and `data-tone` recolours them. Tags keep a 24px minimum, long text ends with an ellipsis, the remove button has an expanded hit area, and selection has a border cue besides colour. Tokens: `--rind-tag-group-*` (see the token reference).

## Testing

```ts
import { getTagGroup } from "@rind-ui/testing"

const cities = getTagGroup(screen, { name: "Cities" }, { modality: "keyboard" })
await cities.remove("Rome")
expect(await cities.tags()).toEqual(["Paris", "Oslo"])
expect(await cities.focusedItem()).toBe("Paris")
```

The driver locates the group by its list's name whatever its role (`grid`, `group` or `list`). `remove(name)` presses the tag's button (pointer) or presses Delete on it (keyboard), and resolves once the tag is gone and focus is on its neighbour or on the list.

## Accessibility tree

A removable group (generated from the state example):

<!-- aria:tag-group--removable -->
```yaml
- text: Cities
- grid "Cities":
  - row "Rome":
    - gridcell "Rome Remove Rome":
      - text: Rome
      - button "Remove Rome"
  - row "Paris":
    - gridcell "Paris Remove Paris":
      - text: Paris
      - button "Remove Paris"
  - row "Oslo":
    - gridcell "Oslo Remove Oslo":
      - text: Oslo
      - button "Remove Oslo"
  - row "Lima":
    - gridcell "Lima Remove Lima":
      - text: Lima
      - button "Remove Lima"
```
<!-- /aria -->

## Tested with

<!-- tested-with:tag-group -->
_No manual screen-reader pass recorded yet._
<!-- /tested-with -->
