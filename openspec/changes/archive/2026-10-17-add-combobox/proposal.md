## Why

Combobox is the hardest pattern for assistive technology in every library we studied:
VoiceOver is silent or doubles speech around `aria-activedescendant`, the input text
reverts or is lost on blur, IME Enter selects, stale async results win, empty states
break the listbox, and non-modal popups hide the page. Five components need the same
input-plus-listbox behaviour (Combobox, Autocomplete, Command, Tags Input, Mentions);
this change specifies it once, with Combobox on top.

Research: [combobox](../../../docs/research/combobox.md) (sources, Bug history,
Accessibility, Decisions) · [autocomplete](../../../docs/research/autocomplete.md) ·
[collections](../../../docs/research/collections.md) ·
[overlay-infrastructure](../../../docs/research/overlay-infrastructure.md) ·
[floating-positioning](../../../docs/research/floating-positioning.md) ·
[accessibility](../../../docs/research/accessibility.md) ·
[assistive-tech-and-a11y-testing](../../../docs/research/assistive-tech-and-a11y-testing.md) ·
[native-platform](../../../docs/research/native-platform.md) ·
[machine-runtime](../../../docs/research/machine-runtime.md) (open question 1)

**Depends on** `add-foundations` (runtime, `controllable`, contracts, drivers,
`testMachine`, React adapter), `add-a11y-foundations` (press, modality, keyboard
normalisation, IME guard, announcer, quirks, messages, invariants),
`add-overlay-infrastructure` (layer stack, dismissable layer, presence, portal),
`add-floating-positioning` (`dropdown` preset, side lock), `add-collections` (model,
selection, navigation with `active-descendant`, filters, async status, virtualization
contract, contract fragment), `add-checkbox` (`hidden-form-input`, `control-label`) and
`add-button` (`button-like-element` for the trigger, clear and chip-remove buttons).
`add-autocomplete` depends on this change.

## What Changes

- New shared capability **`combobox-pattern`**: the behaviour of a text input that
  drives a listbox popup with `aria-activedescendant` — open triggers, highlight while
  typing, inline completion, IME, async and stale results, the empty state, set
  metadata, announcements, virtualization and where the popup lives in the DOM.
  Reused by Autocomplete now and by Command, Tags Input and Mentions later.
- New capability **`combobox`**: single and multiple selection on top of the pattern —
  reconciling the input text with the selection at defined commit points, custom
  values, chips, clear, form participation, parts, `data-*`, contract and driver.
- `@rind-ui/core`: the `combobox` machine (`selectionMode` `single | multiple | none`,
  the last used by Autocomplete), connect, contract, messages.
- `@rind-ui/react`: `Combobox.Root`, `Label`, `Control`, `Input`, `Trigger`,
  `ClearTrigger`, `Positioner`, `Popup`, `List`, `Item`, `ItemText`, `ItemIndicator`,
  `Group`, `GroupLabel`, `Separator`, `Empty`, `Chips`, `Chip`, `ChipRemove`.
- `@rind-ui/testing`: `getCombobox` driver; model-based coverage.
- Theme stylesheet (tier-3 `--rind-combobox-*` tokens), stories, docs page.

## Capabilities

### New Capabilities

- `combobox-pattern`: input + listbox popup behaviour shared by every text-field
  composite (Combobox, Autocomplete, Command, Tags Input, Mentions).
- `combobox`: the Combobox component — selection, text reconciliation, custom values,
  multiple selection with chips, form participation, parts, attributes, contract.
- `input-chips`: chips inside a text-input control (toolbar, roving chips, removal,
  Backspace arming, summary, messages) shared by Combobox and Tags Input.

### Modified Capabilities

None. The capabilities this builds on belong to unarchived changes; the extensions it
needs from them are listed in design.md "Requests to other changes" and are not
edited here.

## Non-goals

- Fetching, debouncing or caching data; a virtualizer (the collections virtualization
  contract is used).
- A combobox whose popup is a dialog, grid or tree (`aria-haspopup` other than
  `listbox`) — Date Picker and grid pickers come later.
- An always-visible list without a popup (that is Command), caret-anchored popups in a
  textarea (Mentions), free-form tag creation (Tags Input).
- A mobile full-screen tray (React Spectrum's MobileComboBox).
- Tag Group semantics for chips: input chips stay a `toolbar` and are not composed from
  Tag Group; they share only its `removeLabel` / `removedAnnouncement` messages.
- Native `<datalist>`, `popover`, customizable `<select>`.
- Framework adapters other than React; fx.

## Impact

- New code: `packages/core/src/components/combobox/{combobox.machine,combobox.connect,combobox.contract,combobox.messages}.ts`,
  `packages/core/src/components/combobox/pattern/*` (the shared pattern pieces),
  `packages/react/src/combobox/*`, `getCombobox` in `@rind-ui/testing`,
  `packages/theme/src/combobox.css`, stories, generated docs page.
- Public API: `combobox` machine/connect/contract, `Combobox` parts, `getCombobox`.
- No new runtime dependency.
