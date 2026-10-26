# Mentions

A textarea that suggests people, tags or commands as you type a trigger character ("@", "#", "/"). The list opens at the trigger, anchored to the caret; choosing an option inserts a mention (painted by the Highlighter and removed whole by Backspace) or, for an "action" trigger, runs a command and removes what was typed. The value stays plain text with a parallel list of mention ranges.

## When to use

- **Use it for** free text that refers to entities: a comment mentioning teammates, a message tagging topics, a prompt with slash commands.
- **Over a home-made `@` popup**: the text is reconciled after every edit (typing, paste, cut, drag, undo and IME composition behave alike), a mention is removed whole instead of leaving half a name, Escape closes the list for the trigger it was typed for (it stays closed while you keep typing), the list opens only from your own typing, and the textarea is a plain textbox until the list opens (combobox semantics only while it is open).
- **Don't use it for** picking values into a field ([Tags Input](tags-input.md), [Combobox](combobox.md)), or rich text with formatting.

```tsx
import { Mentions } from "@rind-ui/react"

const [query, setQuery] = useState<MentionsQuery | null>(null)
const options = query?.trigger === "/" ? commands : people

<label htmlFor="comment">Comment</label>
<Mentions.Root
  triggers={[{ char: "@" }, { char: "/", behavior: "action", startOfInput: true }]}
  onQueryChange={setQuery}
  onSelect={({ key }) => run(key)}
>
  <Mentions.Highlighter />
  <Mentions.Textarea id="comment" />
  <Mentions.Description />
  <Mentions.Positioner>
    <Mentions.Popup>
      <Mentions.List>
        {options.map((o) => (
          <Mentions.Item key={o.id} value={o.id}>
            <Mentions.ItemText>{o.name}</Mentions.ItemText>
          </Mentions.Item>
        ))}
      </Mentions.List>
      <Mentions.Empty>No match</Mentions.Empty>
    </Mentions.Popup>
  </Mentions.Positioner>
</Mentions.Root>
```

The Item parts are filtered by the query (`filter`; `null` lists them as they are). For results fetched per query, pass `items` (a collection) and `loading`. Put the Label outside the Root: the Root is the one-cell grid that stacks the Highlighter under the Textarea.

## API

<!-- api:mentions -->

## Anatomy

| Part | `data-part` | Element |
|---|---|---|
| `Mentions.Root` | `root` | `<div>`; holds the text, the mentions and the list. |
| `Mentions.Textarea` | `textarea` | `<textarea>`; a textbox, a `combobox` while its list is open. |
| `Mentions.Description` | `description` | `<p>`; names the triggers ("Type @ or / to insert a mention"); describes the textarea. |
| `Mentions.Highlighter` | `highlighter` | `<div>`; the text mirrored under the textarea with the mentions as marks (hidden from assistive technology). Its `children` may render each mention. |
| `Mentions.Mention` | `mention` | `<mark>` in the Highlighter; `data-id`, `data-trigger`. |
| `Mentions.Positioner` | `positioner` | `<div>`; places the list at the trigger character. |
| `Mentions.Popup` | `popup` | `<div>`; the list's surface. |
| `Mentions.List` | `list` | `<div role="listbox">`. |
| `Mentions.Group` | `group` | `<div role="group">` with its label (`section`). |
| `Mentions.Item` | `item` | `<div role="option">` (`value`: its key). |
| `Mentions.ItemText` | `item-text` | `<span>`; the option's text. |
| `Mentions.Empty` | `empty` | `<div>`; shown when nothing matches. |
| `Mentions.Loading` | `loading` | `<div>`; shown while `loading`. |

The Root, the Textarea and the list parts carry `data-state` (`open`, `closed`) and `data-trigger` (the trigger at the caret); the Root and Textarea `data-composing` during an IME composition.

## Triggers

| Field | Meaning |
|---|---|
| `char` | The character that opens the list. |
| `id` | The trigger's id in `onQueryChange`, the ranges and `data-trigger` (default: `char`). |
| `behavior` | `"insert"` (default) inserts a mention; `"action"` removes the query and calls `onSelect`. |
| `startOfInput` | Only at the start of the text or a line. |
| `allowSpaces` | The query may contain spaces. |
| `maxQueryLength` | A longer query closes the list (default 50). |
| `appendSpace` | A space after an inserted mention (default true). |

## Keyboard

| Key | Action |
|---|---|
| The trigger character | Opens the list for what follows it. |
| Arrow Down, Arrow Up | While open: move the highlight. |
| Enter | While open with a highlight: choose it. |
| Tab | While open with a highlight: choose it (`selectOnTab`); otherwise focus moves on. |
| Escape | Close the list; it stays closed for this trigger while typing on. |
| Backspace | At the end of a mention: remove it whole. |

With the list closed, every key is the textarea's own. During an IME composition no key is taken.

## Accessibility notes

- **A textbox until it suggests**: `role="combobox"`, `aria-expanded` and `aria-activedescendant` appear only while the list is open, so the field reads as a plain text box otherwise.
- **The triggers are described**: the Description names them and describes the textarea.
- **One text**: the Highlighter is `aria-hidden`; assistive technology reads the textarea's text, where a mention is its label ("@Alice").
- **Focus stays in the textarea**: options are reached by `aria-activedescendant`; a choice announces nothing beyond the text change.

## Testing

```tsx
import { getMentions } from "@rind-ui/testing"

render(<CommentBox />)
const field = getMentions(screen, { name: "Comment" })
await field.type("Thanks @al")
expect(await field.options()).toEqual(["Alice", "Alan"])
await field.choose("Alice")
expect(await field.value()).toBe("Thanks @Alice ")
expect(await field.mentions()).toEqual(["@Alice"])
```

Contract actions: `type`, `choose`, `pressEscape`, `backspace`. Queries: `isOpen`, `trigger`, `options`, `value`, `mentions`.

## Tested with

<!-- tested-with:mentions -->
_No manual screen-reader pass recorded yet._
<!-- /tested-with -->
