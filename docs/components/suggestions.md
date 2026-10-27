# Suggestions

Prompt suggestions as chips: "Summarise this thread", "Write a reply". A press hands the suggestion to you (`onSelect`); the component never sends or inserts anything itself, so it composes with [Prompt Input](prompt-input.md) however your product wants. While the prompt is busy the chips stay where they are, disabled but focusable: the focus is never dropped.

## When to use

- **Use it for** starter prompts in an empty chat, and follow-up suggestions after an answer.
- **Over a row of buttons**: a named group, `loading` that keeps the focus (assistant-ui#8940), an optional announcement of a new set (never on mount), and the focus moved back to the prompt after a press when you ask for it.
- **Don't use it for** a choice that stays selected ([Toggle Group](toggle-group.md)) or a menu of commands ([Menu](menu.md)).

```tsx
import { Suggestions } from "@rind-ui/react"

<Suggestions.Root
  loading={busy}
  onSelect={({ value }) => promptInput.submit(value)}
  focusTarget={() => promptRef.current}
>
  <Suggestions.Item value="Summarise this thread in three bullet points">
    <Suggestions.Label>Summarise</Suggestions.Label>
  </Suggestions.Item>
  <Suggestions.Item>
    <Suggestions.Label>Draft a reply</Suggestions.Label>
    <Suggestions.Description>Polite, two paragraphs</Suggestions.Description>
  </Suggestions.Item>
</Suggestions.Root>
```

## API

<!-- api:suggestions -->

## Anatomy

| Part | `data-part` | Element |
|---|---|---|
| `Suggestions.Root` | `root` | `<div role="group">`, named "Suggestions" unless you name it. |
| `Suggestions.Item` | `item` | `<button type="button">`; `value` (default: its Label's text). |
| `Suggestions.Label` | `label` | `<span>`; the main text. |
| `Suggestions.Description` | `description` | `<span>`; secondary text, part of the name. |

## Keyboard

| Key | Action |
|---|---|
| Tab | From item to item. Wrap the Root in a [Toolbar](toolbar.md) for arrow keys. |
| Enter, Space | Selects the focused item. |

## Accessibility notes

- **A named group of buttons**, not a toolbar: chips wrap, and a short set reads fine with Tab.
- **Busy keeps the focus.** `loading` makes every item `aria-disabled` (focusable) and the group `aria-busy`.
- **Announced only when asked.** `announce="polite"` says "3 suggestions" when a new set replaces the old one; nothing on mount, no live region.

## Testing

```tsx
import { getSuggestions } from "@rind-ui/testing"

await getSuggestions(screen).pick("Summarise")
expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ index: 0 }))
```

Contract actions: `pick(labelOrIndex)`. Queries: `items`, `count`, `isLoading`, `isDisabled`.

## Tested with

<!-- tested-with:suggestions -->
_No manual screen-reader pass recorded yet._
<!-- /tested-with -->
