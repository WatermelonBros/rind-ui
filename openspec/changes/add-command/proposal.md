## Why

Command palettes (⌘K menus, quick-open, action search) are in almost every app, and the most
used implementation, cmdk (shadcn's `Command`), ships a stale `aria-activedescendant`,
`aria-selected` on the highlight, invalid listbox children, DOM reordering that loses the
original order, and keys stolen from the input. A palette is `combobox-pattern` without a
popup; with that pattern specified in `add-combobox`, Command is a small component of its own.

Research: [command](../../../docs/research/command.md) (sources, Bug history, Accessibility,
Decisions) · [combobox](../../../docs/research/combobox.md) (the shared pattern) ·
[autocomplete](../../../docs/research/autocomplete.md) ·
[collections](../../../docs/research/collections.md) ·
[accessibility](../../../docs/research/accessibility.md) ·
[assistive-tech-and-a11y-testing](../../../docs/research/assistive-tech-and-a11y-testing.md) ·
[native-platform](../../../docs/research/native-platform.md)

**Depends on** `add-combobox` (`combobox-pattern`: actions, guards, connect helpers, messages,
contract fragment), `add-listbox` (reusable listbox parts), `add-collections` (model,
`active-descendant` navigation, filters, async status, virtualization contract, contract
fragment, `set-metadata` trait), `add-a11y-foundations` (keyboard normalisation, IME guard,
modality, announcer, quirks, messages, invariants), `add-dialog` (the palette's usual
container; initial focus rule), `add-separator` (`separatorProps` in the `listbox` context),
`add-theme-system` (tokens, variants) and, through them, `add-foundations`.

## What Changes

- New capability **`command`**: a text input that filters an always-visible listbox of
  actions — no popup, no selection; running an item calls `onAction`; groups, keywords,
  filtering without reordering, empty and loading states, nested pages (`page` +
  Backspace-to-go-back), link items, Escape clear-then-unhandled, the dialog composition,
  parts, `data-*`, contract and driver.
- `@rind-ui/core`: the `command` machine (one state, spreading `combobox-pattern`), connect,
  contract, messages.
- `@rind-ui/react`: `Command.Root`, `Label`, `Input`, `Description`, `List`, `Item`,
  `ItemText`, `ItemDescription`, `Group`, `GroupLabel`, `Separator`, `Empty`, `Loading`.
- `@rind-ui/testing`: `getCommand` driver; model-based coverage.
- Theme stylesheet (tier-3 `--rind-command-*` tokens), stories (including the dialog
  composition), docs page.

## Capabilities

### New Capabilities

- `command`: the Command component — always-open filtered listbox of actions on top of
  `combobox-pattern`, pages, dialog composition, parts, attributes, contract.

### Modified Capabilities

None. `combobox-pattern` and the collection capabilities are used as specified; the
extensions Command needs are listed in design.md "Requests to other changes" and are not
edited here.

## Non-goals

- Global keyboard shortcuts that open the palette (⌘K): the app's (a Hotkey utility may come
  later). Vim/Emacs bindings (Ctrl+N/P/J/K) are not built in; the API's `navigate()` lets an
  app add them.
- Fuzzy scoring, ranking or sorting inside the component, and any DOM reordering: ranked
  palettes pass a ranked collection with `filter: null`.
- A `Command.Dialog` part: the dialog is add-dialog, composed as documented.
- Grid layouts (`columns`, emoji pickers) — Grid List; filtering Menus, Trees or Tag Groups
  with an input (React Aria's generic Autocomplete) — those components.
- Inline completion (`aria-autocomplete="both"`), selection, multiple selection, chips.
- A palette without an input (that is Listbox), fetching, debouncing, recent-items history,
  highlighting the matched substring.
- Framework adapters other than React; fx.

## Impact

- New code: `packages/core/src/components/command/{command.machine,command.connect,command.contract,command.messages}.ts`,
  `packages/react/src/command/*`, `getCommand` in `@rind-ui/testing`,
  `packages/theme/src/command.css`, stories, generated docs page.
- Public API: `command` machine/connect/contract, `Command` parts, `getCommand`.
- No new runtime dependency.
