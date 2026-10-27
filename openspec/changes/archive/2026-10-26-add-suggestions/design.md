## Context

Research: [docs/research/suggestions.md](../../../docs/research/suggestions.md) ("Decisions").

## Decisions

### 1. Machine

`suggestions`: states `ready`, `loading`, `disabled`, decided by the `loading` and `disabled`
props (`onProps` → `SYNC`). Events: `PRESS { key, value, index, focusWasInside }`,
`ITEMS { keys }` (the rendered items' keys, sent by the Root on change). Context: the last keys.

- `PRESS` in `ready` (item not disabled): `onSelect({ value, index, key })`; when
  `focusWasInside` and `focusTarget` is given, focus moves to it after the callback.
- `ITEMS` with keys different from the last (not the first report): when `announce` is
  `"polite"`, `messages.count(n)` is announced politely.

### 2. Accessibility

Root: `role="group"`, named by `aria-label` / `aria-labelledby` or `messages.group`
("Suggestions"). Item: `button-like-element`, `type="button"`, name = Label + Description
text; while `loading` / `disabled` (or the item's own `disabled`), `aria-disabled="true"`,
focusable, never removed. Root while loading: `aria-busy="true"`.

### 3. Attributes

Root: `data-scope="suggestions"`, `data-part`, `data-instance`, `data-state`, `data-count`.
Item: `data-key`, `data-index`, `data-disabled`, `data-focus`, `data-focus-visible`.

### 4. Theme

Family `toggle item` (chips: soft, outline, ghost; sizes): `suggestions.css` lays the items
out as wrapping chips.

### 5. Contract

Locate by the group's name, else the only one. Actions `pick(labelOrIndex)`. Queries `items`
(labels), `count`, `isLoading`, `isDisabled`.
