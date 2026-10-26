## Context

Research: [docs/research/mentions.md](../../../docs/research/mentions.md) ("Decisions for
`add-mentions`"). This change implements those decisions; the differences are noted here.

## Decisions

### 1. Machine

`closed | open` on the combobox pattern's pieces (collection highlight, auto highlight,
announcements, the non-modal listbox layer). Context: the trigger `match`, `dismissedAt` (Escape
closed the match starting there), `caret`. Values: `value` (text) and `mentions` (ranges), both
controllable. `INPUT { value, caret, composing }` reconciles, then matches at the caret and sends
`MATCHED` or `UNMATCHED` (open or close). `CARET` re-matches without an edit.

### 2. Value model (`mentions.text.ts`, pure)

`applyEdit(before, after, ranges, caretAfter)`: the diff (the caret after the edit disambiguates
repeated characters); an edit before a range shifts it; an edit inside dissolves it (text kept);
a deletion that takes a range's first or last character, or all of it, removes the whole mention
and the space after it. `matchTrigger`: the trigger char starts the text or follows Unicode
whitespace; `/` only at the start of a line; no whitespace in the query unless `allowSpaces`; not
inside a mention; not a dismissed match. `insertMention` replaces the match with the label
(default the trigger char and the item text, `formatLabel`) and a space; `removeMatch` for
`action` triggers, which call `onSelect`.

### 3. Anchor

The parts measure the trigger's position with `dom/caret-rect.ts` (a mirror of the textarea) and
pass it as the `anchor` prop; the overlay effect positions the list at that virtual anchor.

### 4. Accessibility

The Textarea is a textbox until the list opens, then a `combobox` with `aria-expanded`,
`aria-controls` and `aria-activedescendant` (the pattern's input attributes); one Description
names the triggers. The Highlighter is `aria-hidden` and `pointer-events: none`.

### 5. Contract

Locate by the textarea's name (textbox or combobox). Actions `type`, `choose(label?)`,
`pressEscape`, `backspace`; queries `isOpen`, `trigger`, `options`, `value`, `mentions`.
