## Why

Select is in Reado's first migration set (`atoms/Select.tsx`, used by about twenty
screens), and it is where Reado's tests hurt most: a theme-mode select that "won't open
under happy-dom", triggers found by `querySelectorAll` because role and name lookups were
unreliable, and every app rewriting `pick()`. Across libraries the same Select bugs recur:
opening on `pointerdown` that breaks touch scrolling and taps through to options, a hidden
native `<select>` that duplicates labels and options for Testing Library and slows big
lists, typeahead on the closed trigger that picks disabled items, value text Safari reads
stale, item-aligned positioning that misplaces the popup. Listbox (`add-listbox`) now
provides the options; this change specifies the trigger, the popup and form
participation on top.

Research: [select](../../../docs/research/select.md) (sources, Bug history,
Accessibility, Decisions — including the hidden native `<select>` decision and the
item-aligned decision) · [listbox](../../../docs/research/listbox.md) ·
[collections](../../../docs/research/collections.md) ·
[overlay-infrastructure](../../../docs/research/overlay-infrastructure.md) ·
[floating-positioning](../../../docs/research/floating-positioning.md) ·
[checkbox](../../../docs/research/checkbox.md) (hidden form input) ·
[testing](../../../docs/research/testing.md) (Reado workarounds) ·
[accessibility](../../../docs/research/accessibility.md) ·
[assistive-tech-and-a11y-testing](../../../docs/research/assistive-tech-and-a11y-testing.md) ·
[native-platform](../../../docs/research/native-platform.md)

**Depends on** `add-foundations`, `add-a11y-foundations` (press, modality, keyboard,
quirks, messages, invariants), `add-overlay-infrastructure` (layer kind `listbox`,
dismissable layer, focus restore, outside inert, scroll lock, presence, portal),
`add-floating-positioning` (preset `dropdown`, `--rind-anchor-width`), `add-collections`
(model, selection, navigation, typeahead incl. the closed-trigger path, virtualization
contract), **`add-listbox`** (the listbox parts, keyboard map and selection behaviour of
the popup), `add-button` (`button-like-element` for the trigger) and `add-checkbox`
(`hidden-form-input`, the `Description` part of `control-label`). Three additive needs on
`add-checkbox` and one on `add-collections` are listed in design.md "Requests to other
changes".

## What Changes

- `@rind-ui/core`: the `select` machine, connect, contract and messages, composed from the
  listbox parts and the collection pieces.
- Behaviour: a `combobox` trigger named by its label (never by its value); opening on
  press release and with Enter, Space, ArrowDown, ArrowUp, Alt+ArrowDown; typeahead on
  the closed trigger that selects without opening (single mode); focus on the selected
  option (else first / last) after first placement, scrolled into view; single selection
  that closes, multiple selection that stays open; Escape, Tab, outside press and window
  blur closing rules; modal by default; value text and placeholder from collection data;
  required / invalid / disabled / read-only; form participation through one visually
  hidden `<input>` with browser autofill adoption — **no hidden native `<select>`**;
  touch behaviour (no open on scroll, no tap-through, no hover highlight).
- `@rind-ui/react`: `Select.Root`, `Label`, `Trigger`, `ValueText`, `Indicator`,
  `Description`, `Positioner`, `Content`, and the listbox parts as `Select.List`,
  `Item`, `ItemText`, `ItemDescription`, `ItemIndicator`, `Section`, `SectionLabel`,
  `Separator`, `Empty`, `LoadMore`, with the generic `Portal`.
- `@rind-ui/testing`: `getSelect` driver and model-based coverage.
- Theme stylesheet (tier-3 `--rind-select-*` tokens), stories, docs page.

## Capabilities

### New Capabilities

- `select`: the Select component — parts, ARIA and `data-*` attributes, opening and
  initial focus, keyboard on the closed trigger and in the popup, selection and closing,
  value text and placeholder, validation state, form participation and autofill,
  touch, modality, contract and driver.

### Modified Capabilities

None. The capabilities this builds on are introduced by unarchived changes; three
additive needs on `hidden-form-input` (`add-checkbox`) and one on `collection-navigation`
(`add-collections`) are raised in design.md, not edited here.

## Non-goals

- **Item-aligned positioning** (Radix `position="item-aligned"`, Base UI
  `alignItemWithTrigger`, Headless UI `anchor="selection"`) and its scroll arrows: v1
  ships the `dropdown` placement only (research Decisions). The positioner leaves room
  for it as a positioning option.
- Press-drag-release selection (open on `pointerdown`, choose on release).
- A text input inside the popup, filtering, creatable options (Combobox, Autocomplete).
- A clear button part (an item with an empty value covers Reado's "default" option).
- Opening on hover; a native-styled variant on customizable `<select>`
  (native-platform §7, revisit when Firefox ships); a mobile native-picker fallback
  (docs recipe only).
- Re-specifying listbox, collection, overlay, positioning or hidden-input rules.
- Framework adapters other than React; fx.

## Impact

- New code: `packages/core/src/components/select/{select.machine,select.connect,select.contract,select.messages}.ts`,
  `packages/react/src/select/*`, driver export in `@rind-ui/testing`,
  `packages/theme/src/select.css`, stories, generated docs page.
- Public API: `select` machine/connect/contract, `Select` parts, `getSelect`.
- Reado: `atoms/Select.tsx` ports by renaming parts; the `querySelectorAll` and
  `findAllByRole(...).find(...)` workarounds in its tests become `getSelect`.
- No new runtime dependency.
