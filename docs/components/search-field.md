# Search Field

A [Text Field](text-field.md) with search semantics: a `searchbox` input, Escape to clear, Enter to search, and one clear control. It never breaks IME input and never steals Escape from an enclosing Dialog when there is nothing to clear.

```tsx
import { SearchField } from "@rind-ui/react"

<SearchField.Root name="q" onSubmit={(value) => search(value)}>
  <SearchField.Label>Search books</SearchField.Label>
  <SearchField.Input />
  <SearchField.ClearTrigger />
</SearchField.Root>
```

## API

<!-- api:search-field -->

## Anatomy

| Part | `data-part` | Element |
|---|---|---|
| `SearchField.Root` | `root` | `<div>`; a Field when not inside one. |
| `SearchField.Label` / `Description` / `ErrorMessage` | `label` / `description` / `error-message` | The Field's parts. |
| `SearchField.Input` | `input` | `<input type="search">`. |
| `SearchField.ClearTrigger` | `clear-trigger` | `<button>` named "Clear search". |

Icon-only: omit the Label and set `aria-label` on the Input.

## Escape and Enter

- **Escape** clears a non-empty, editable value (`onValueChange("", { reason: "ESCAPE" })`), keeps focus and consumes the key.
- On an **empty**, disabled or read-only field Escape is not handled, so an enclosing Dialog closes.
- **Enter** calls `onSubmit(value, { event })` once. The form still submits; call `event.preventDefault()` to stop it.
- An IME composition owns both keys. Escape cancels the composition, Enter commits the text. Neither clears or searches.
- A consumer `onKeyDown` sees the key first.

## Clear trigger and the native cancel button

The ClearTrigger shows only when there is text to clear. It stays out of the Tab order (Escape is the keyboard twin) and clearing re-validates the Field.

The browser draws its own cancel button on `type="search"`. It is hidden only while a ClearTrigger is mounted, so there is one clear control. Without a ClearTrigger the browser's button stays.

## Landmark recipe

Wrap the form in the native `<search>` element so the page has a search landmark:

```tsx
<search>
  <form onSubmit={onSubmit}>
    <SearchField.Root name="q">…</SearchField.Root>
  </form>
</search>
```

## Debouncing recipe

There is no built-in debounce. Debounce in your own `onValueChange`, and search at once from `onSubmit`:

```tsx
const [text, setText] = useState("")
const query = useDebouncedValue(text, 250)
<SearchField.Root value={text} onValueChange={setText}>…</SearchField.Root>
```

## Search Field vs Autocomplete

Search Field has no popup, no suggestions and no result list. When the user picks from suggestions, use Autocomplete. When the field only filters or submits a query, use Search Field.

## Accessibility notes

- The input has role `searchbox` and the Label names it.
- The ClearTrigger name comes from `messages.clear`.
- Field state reaches every part.

## Styling

Style the `data-*` attributes above (`data-empty` on Root and Input). The theme package ships `@rind-ui/theme/search-field.css`.

## Testing

Contract actions: `type`, `fill`, `clear`, `escape`, `submit`, `compose`, `blur`. Queries: `value`, `isEmpty`, `isClearable`, `description`, `isInvalid`, `isComposing`.

```tsx
import { getSearchField } from "@rind-ui/testing"

render(<BookSearch />)
const search = getSearchField(screen, { name: "Search books" })
await search.fill("tolkien")
await search.via("keyboard").clear() // presses Escape
expect(await search.value()).toBe("")
await search.type("dune")
await search.submit() // presses Enter
```

## Tested with

<!-- tested-with:search-field -->
_No manual screen-reader pass recorded yet._
<!-- /tested-with -->
