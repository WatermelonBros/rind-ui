# Autocomplete — research

Status: done · Wave: 2

A text input that offers suggestions in a listbox popup, where **the value is the text**.
Choosing a suggestion fills the input; nothing is "selected", and any text is valid.
Search boxes, address lines, tag-free "city" fields, URL bars. Everything about the
input + popup (opening, highlight while typing, inline completion, IME, async, empty
state, announcements, placement) is the `combobox-pattern` capability specified in
`add-combobox` and researched in [combobox.md](combobox.md); this note covers only how
Autocomplete differs and the bugs specific to it.

Sources read (local clones, 2026-10-14): Base UI `packages/react/src/autocomplete/**`
and `combobox/root/AriaCombobox.tsx`; React Aria `packages/react-aria/src/autocomplete/useAutocomplete.ts`,
`packages/react-stately/src/autocomplete/useAutocompleteState.ts`,
`react-aria-components/src/Autocomplete.tsx` (via `git show HEAD:`, @ `e04377c`); Reka UI
`packages/core/src/Autocomplete/{AutocompleteRoot,AutocompleteInput}.vue`; Ariakit
`combobox.tsx` (free text is its default, `autoComplete` modes). Ark/Zag has no
Autocomplete (a Zag combobox with `allowCustomValue` and `selectionBehavior: "preserve"`
approximates it). Reado: no autocomplete.

## Pattern

- WAI-ARIA APG [Combobox](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/) — its
  examples "List Autocomplete with Manual Selection", "…with Automatic Selection" and
  "List with Inline Autocomplete" are exactly this component: the textbox value is free,
  the listbox offers values for it.
- Roles: input `role="combobox"` with `aria-autocomplete` `list` / `both` / `inline` /
  `none` matching the mode; listbox; options. Options are not selectable: no
  `aria-multiselectable`; `aria-selected` stays `"false"` (VoiceOver otherwise reads
  options without the attribute as selected — HUI#1599).
- Keyboard: as Combobox, except Enter with nothing highlighted submits the form
  (native behaviour of a text field), and choosing never "reverts" anything.

## How the others built it

### Base UI

- `AutocompleteRoot.tsx` (308 lines) is a thin preset over `AriaCombobox`:
  `selectionMode="none"`, `fillInputOnItemPress`, `inputValue` ← `value`,
  `onInputValueChange` → `onValueChange`, `autoComplete` ← `mode`
  (`list` default | `both` | `inline` | `none`; `inline`/`none` keep items static, i.e.
  unfiltered), `itemToStringValue` → label. Inline completion keeps a separate
  `inlineInputValue` that overrides the shown text and is cleared on every real value
  change; pointer highlights (`reason === "pointer"`) never complete; `readOnly`
  disables completion. Filtering uses the typed query, not the completed text
  (`filterQuery` for mode `both`).
- `submitOnItemClick` (default false) for single-field search forms; `inline` (list
  without popup); `openOnInputClick` default false (Combobox defaults true).
- One engine, 2,046 lines shared with Combobox — confirms the "one machine with presets"
  approach.

### React Aria

- `useAutocomplete` + RAC `Autocomplete` are **not a popup combobox**: they connect an
  input (SearchField / TextField) to an always-visible collection (ListBox, Menu,
  GridList, TagGroup, Table) for filtering and virtual focus — the command-palette /
  filterable-menu pattern. The input gets `aria-controls`, `aria-activedescendant`,
  `aria-autocomplete="list"`, `enterKeyHint="go"`; no `role="combobox"` is added by the
  hook.
- Clever, and adopted by `combobox-pattern`: the activedescendant update after forward
  typing is **delayed 500 ms** "to not interrupt the native screen reader announcement of
  the letter you just typed"; `inputType` decides forward typing (`insertText`,
  `insertCompositionText`, `insertFromComposition`) vs. edits (paste, delete, undo
  clear the virtual focus); Left/Right clear the activedescendant "so NVDA announcements
  aren't interrupted" but keep the position; virtual focus is disabled for a **mobile
  screen reader** (`modality === "virtual"` on iOS/Android).
- Problem: no VoiceOver announcer at all — RA#10326 (open): arrowing is silent in Safari
  26.5, while ComboBox has the announcer.
- In rind-ui this always-visible variant is the future **Command** component, which
  reuses `combobox-pattern`.

### Reka UI

- `AutocompleteRoot.vue` provides `ComboboxRootContext` with `multiple: false`,
  `resetSearchTermOnSelect: false`, `resetModelValueOnClear: true`; `modelValue` is the
  string; `resetSearchTermOnBlur` defaults to **false** (free text survives); on open the
  filter is seeded from the current text (Combobox clears it); every keystroke writes the
  model. Same parts as Combobox — the same "one engine" approach.

### Ariakit

- Free text is Ariakit's default combobox (no selection unless `selectedValue` is used);
  `autoComplete: "inline" | "both"` with the most careful inline completion (forward
  typing only, caret at end, diacritics-length check).

## Accessibility

Everything in [combobox.md](combobox.md#accessibility) applies (VoiceOver and
activedescendant, count as a status message, empty state outside the listbox, in-place
popup, IME, typing-highlight lag, forced colors, target size). Specific to Autocomplete:

- **No selection semantics**: options carry `aria-selected="false"` (not absent) and the
  listbox has no `aria-multiselectable`; on Apple platforms the chosen text is announced
  through `selectedAnnouncement` when it fills the input, as React Aria does for ComboBox
  selections.
- **Form**: the visible input is the form control (`name`, native validation, native
  reset, browser autofill) — no hidden input, so no duplicated control for AT.
- **`aria-autocomplete`** must match the mode: `none` when the list neither filters nor
  completes, `inline` when only completion happens.
- **Native**: `<input list>` + `<datalist>` is the platform's autocomplete. It cannot be
  styled, offers no async control, does not expose highlight or count to AT in a
  consistent way (Safari shows it, VoiceOver iOS barely), and filters with the browser's
  own prefix/substring rules. It is the documented zero-JS fallback, not a base.

## Bug history

Same search as [combobox.md](combobox.md#bug-history) (2026-10-14); rows here are specific
to Autocomplete (Base UI Autocomplete, React Aria Autocomplete, Reka Autocomplete) or to
free-text use of a combobox. Every row was read in full. All Combobox rows apply too.

| Library | Issue | Symptom | Root cause | Fix / status | Lesson for rind-ui |
|---|---|---|---|---|---|
| Base UI | [BU#4245](https://github.com/mui/base-ui/issues/4245) open | Escape on the closed popup erases free text | Combobox clear-on-Escape inherited (Chrome omnibox parity) | Workaround `details.cancel()` | `clearOnEscape` default false; Escape otherwise unhandled |
| Reka | [RK#779](https://github.com/unovue/reka-ui/issues/779) closed | Blur always empties the search term; Google-style suggest impossible | Unconditional reset on blur | `resetSearchTermOnBlur` | Free text survives blur, close and Tab |
| Base UI | [BU#4724](https://github.com/mui/base-ui/issues/4724) closed | Value missing from FormData | Named input lived in the unmounted popup | PR #4725 | The named input is the visible, always-mounted input |
| Base UI | [BU#4196](https://github.com/mui/base-ui/issues/4196) closed | `filter={null}` falls back to `contains`; server search broken | `??` default in 1.2.0 | PR #4117 | `null` means off; tested per mode |
| Base UI | [BU#4666](https://github.com/mui/base-ui/issues/4666) open | Disabled suggestion highlighted | Disabled items focusable by design | Intended | `focusableWhenDisabled: false` default, stated |
| React Aria | [RA#10326](https://github.com/adobe/react-spectrum/issues/10326) open | Arrowing silent in VoiceOver (Safari 26.5) | No announcer in `useAutocomplete` | Open | Same machine and pattern as Combobox |
| React Aria | [RA#10126](https://github.com/adobe/react-spectrum/issues/10126) closed | CJK input never highlights the first item | Only `insertText` counted | PR #10156 | Composition commit is forward typing |
| React Aria | [RA#10279](https://github.com/adobe/react-spectrum/issues/10279) closed | Paste does not auto-highlight | Excluded on purpose (SR announcements) | Intended | Paste clears the highlight (pattern rule) |
| React Aria | [RA#8198](https://github.com/adobe/react-spectrum/issues/8198) closed | After hovering an option, clicking the input loses `data-focused` | Virtual blur events cleared real focus state | Closed | Virtual focus never fakes blur on the input |
| React Aria | [RA#7963](https://github.com/adobe/react-spectrum/issues/7963) closed | In a dialog the second Escape clears the selection before the third closes | Collection Escape-clears-selection before propagation | Closed | Escape never clears anything by default |
| React Aria | [RA#7619](https://github.com/adobe/react-spectrum/issues/7619) closed | Stays open when focus leaves the document | Focus scope blind to window blur | Known limitation | Window blur closes without commit side effects (text kept) |
| React Aria | [RA#9620](https://github.com/adobe/react-spectrum/issues/9620) closed | `selectedKeys="all"` collapses after filtering | Resolved against the filtered view | Closed | Selection against the full collection (not applicable: no selection) |
| Ariakit | [AK#6916](https://github.com/ariakit/ariakit/issues/6916), [AK#6315](https://github.com/ariakit/ariakit/issues/6315) closed | Inline completion overwrites a moved caret; NFD over-completion | Caret and normalisation not checked | PRs #6923, #6457 | Inline mode rules in the pattern |
| Reka | [RK#2540](https://github.com/unovue/reka-ui/issues/2540) closed | Requests fired on partial IME preedit | Input before composition end | PR #2541 | `composing` in change details; abort signal |
| Base UI | [BU#4181](https://github.com/mui/base-ui/issues/4181) closed | "Hiding N results" never announced | Live region mounted with text | PR #4286 | Announcer |
| ZG / RA / BU / HUI | [ZG#2521](https://github.com/chakra-ui/zag/issues/2521) closed, [RA#6228](https://github.com/adobe/react-spectrum/issues/6228) open, [BU#2686](https://github.com/mui/base-ui/issues/2686), [HUI#2611](https://github.com/tailwindlabs/headlessui/issues/2611) closed | Free text needs Enter twice to submit | Enter swallowed while open | Fixed / open | Enter without highlight submits |

## Known pitfalls

1. **Text lost on blur / close** when a combobox engine resets the search term (Reka
   defaults it off for Autocomplete precisely for this).
2. **Enter submits too eagerly or never**: with a highlight, Enter must fill (and only
   submit with `submitOnChoose`); without one, it must submit natively.
3. **Inline completion fighting the user**: completion on paste/delete, caret moved,
   completion written during composition, filtering by the completed text.
4. **VoiceOver silent** when the autocomplete stack lacks the combobox announcer
   (RA#10326).
5. **Free text and suggestion values out of sync** when the option's value differs from
   its text (fill must use the text value).

## Testing notes

Same driver surface as Combobox minus `value()`-as-selection and chips; `value()` is the
text. The model runner uses props classes per mode (`list`, `both`, `inline`, `none`),
`submitOnChoose`, `filter: null` + `itemsQuery`. Forms: implicit submission and reset are
native and asserted in browser mode.

## Decisions

- **Same machine as Combobox** with `selectionMode: "none"` — specified as the Combobox's
  free-text mode in `add-combobox-variants` (which retired `add-autocomplete`), on top of
  `combobox-pattern` (no machine of its own,
  Base UI's design).
- **Values**: `value` (the text, controllable) and `open`; `onValueChange(text, details)`
  with reasons `input-change`, `item-press`, `enter`, `clear`, `escape`, `reset`.
- **Choosing** fills the input with the option's text value, moves the caret to the end,
  closes (`closeOnChoose`, default true) and keeps focus; the option's own action/link
  runs for link options.
- **Mode** (`mode`: `list` default | `both` | `inline` | `none`) sets filtering and inline
  completion together, mapped to `aria-autocomplete`.
- **No commit rules**: blur, Tab, outside press and Escape never change the text, except
  that Escape removes an inline completion and, with `clearOnEscape`, clears the text of a
  closed autocomplete.
- **Enter**: highlighted → fill (+ submit with `submitOnChoose`); not highlighted → close
  and let the form submit.
- **Form**: the visible input carries `name`, `required`, `form`, `formAutoComplete`; no
  hidden input.
- **Parts**: the Combobox parts minus Chips/Chip/ChipRemove/ItemIndicator, under
  `data-scope="autocomplete"`: Root, Label, Control, Input, Trigger, ClearTrigger,
  Positioner, Popup, List, Item, ItemText, Group, GroupLabel, Separator, Empty.
- **Contract**: pattern contract + `choose(name)`, `clear()`; queries `value()`;
  traits `composite-activedescendant`, `set-metadata`, `layer`, `presence`, `anchored`
  (not `selectable`: nothing is selected; explicit `aria-selected="false"` is a
  per-component invariant).
- **Deliberately different**: React Aria's always-visible Autocomplete is our Command;
  Base UI's `inline` list is also left to Command, so Autocomplete is always a popup.

## Open questions

- Should search-style autocompletes default `enterKeyHint="search"`? Left to the consumer
  (`enterKeyHint` passes through); revisit with Search Field.
