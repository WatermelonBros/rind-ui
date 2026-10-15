## Why

Search boxes, address and city fields need suggestions without a selection: the value is
whatever the user typed, and a suggestion only fills it in. Ark has no such component;
Base UI, React Aria and Reka do, and all three build it from the same engine as their
combobox. With `combobox-pattern` specified in `add-combobox`, Autocomplete is a preset of
the same machine and a small capability of its own.

Research: [autocomplete](../../../docs/research/autocomplete.md) (sources, Bug history,
Accessibility, Decisions) · [combobox](../../../docs/research/combobox.md) (the shared
pattern) · [accessibility](../../../docs/research/accessibility.md) ·
[assistive-tech-and-a11y-testing](../../../docs/research/assistive-tech-and-a11y-testing.md) ·
[native-platform](../../../docs/research/native-platform.md)

**Depends on** `add-combobox` (`combobox-pattern`, the `combobox` machine with
`selectionMode: "none"`) and, through it, `add-foundations`, `add-a11y-foundations`,
`add-overlay-infrastructure`, `add-floating-positioning`, `add-collections` and
`add-button`.

## What Changes

- New capability **`autocomplete`**: a text input whose value is its text, with
  suggestions from `combobox-pattern` — choosing fills the input, no selection, no
  revert, modes `list` / `both` / `inline` / `none`, native form participation, parts,
  `data-*`, contract and driver.
- `@rind-ui/core`: `autocomplete` connect, contract and messages over the `combobox`
  machine (`selectionMode: "none"`); no new machine.
- `@rind-ui/react`: `Autocomplete.Root`, `Label`, `Control`, `Input`, `Trigger`,
  `ClearTrigger`, `Positioner`, `Popup`, `List`, `Item`, `ItemText`, `Group`,
  `GroupLabel`, `Separator`, `Empty`.
- `@rind-ui/testing`: `getAutocomplete` driver; model-based coverage.
- Theme stylesheet (tier-3 `--rind-autocomplete-*` tokens), stories, docs page.

## Capabilities

### New Capabilities

- `autocomplete`: the Autocomplete component — free text value, filling from
  suggestions, modes, Enter and form behaviour, parts, attributes, contract.

### Modified Capabilities

None. `combobox-pattern` (from `add-combobox`) is used as specified.

## Non-goals

- An always-visible filtered list or command palette (React Aria's Autocomplete, Base
  UI's `inline` list): that is **Command**, which will reuse `combobox-pattern`.
- Selection, multiple values, chips (Combobox, Tags Input).
- Fetching, debouncing, history of recent searches, highlighting the matched substring
  in options (a consumer render concern; a Highlight utility may come later).
- Native `<datalist>` as the implementation (documented as the zero-JS fallback only).
- Framework adapters other than React; fx.

## Impact

- New code: `packages/core/src/components/autocomplete/{autocomplete.connect,autocomplete.contract,autocomplete.messages}.ts`
  (machine: `combobox.machine.ts` with `selectionMode: "none"`),
  `packages/react/src/autocomplete/*`, `getAutocomplete` in `@rind-ui/testing`,
  `packages/theme/src/autocomplete.css`, stories, generated docs page.
- Public API: `autocomplete` connect/contract, `Autocomplete` parts, `getAutocomplete`.
- No new runtime dependency.
