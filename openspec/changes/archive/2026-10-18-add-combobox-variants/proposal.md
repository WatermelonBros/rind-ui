## Why

Command palettes and autocomplete fields are the same component as Combobox: a text input
driving a listbox through `combobox-pattern`. Two separate components would duplicate the
input, the listbox, the highlight, IME, filtering and announcement rules, and give users
three APIs to learn for one pattern. User decision (2026-10-18): Command and Autocomplete are
**not** separate components but variants of Combobox, documented as sections of the Combobox
page, with no separate exports.

- **Autocomplete** = the free-text variant: the input's text is the value, and suggestions
  only complete it.
- **Command** = the inline action variant: always open with no popup or toggle, and items run
  an action instead of being selected, with pages and Backspace to go back.

It retires the unimplemented changes `add-command` and `add-autocomplete`. Every requirement
they specified is either carried into a Combobox requirement below or listed as out of scope
(design.md "Where the retired requirements went").

Research (unchanged, done): [command](../../../docs/research/command.md) ·
[autocomplete](../../../docs/research/autocomplete.md) ·
[combobox](../../../docs/research/combobox.md) · [tags-input](../../../docs/research/tags-input.md) ·
[accessibility](../../../docs/research/accessibility.md) ·
[assistive-tech-and-a11y-testing](../../../docs/research/assistive-tech-and-a11y-testing.md) ·
[native-platform](../../../docs/research/native-platform.md)

**Depends on** the archived `add-combobox` (`combobox`, `combobox-pattern` with "Usable
Without A Popup", the machine's `selectionMode: "none"`), `add-tags-input` (Suggestions
requirement), `add-collections` (keywords), `add-dialog` (the palette's container),
`add-listbox` (reusable list parts).

## What Changes

- **`combobox` (modified):**
  - **Free-text mode** (`selectionMode: "none"`): the value is the text, choosing fills the
    input, the visible input is the form control, Enter submits the form when nothing is
    highlighted, Escape keeps free text. Completion modes `list` (default) and `both` only.
  - **Inline mode** (`inline`): no popup, the list is rendered in place and always shown, and
    `onAction` runs items. It adds:
    - groups, keywords, filtering without reordering, a Loading part;
    - pages (`page`, `onBack`, Backspace on an empty query);
    - Escape that clears the query first and then calls `onOpenChange(false)` for a dialog
      host;
    - the "N results" polite count;
    - the dialog composition.
  - Anatomy gains `Loading` and `ItemDescription`. Data attributes, contract (`run`, `back`,
    `page`, `items`) and theme cover both modes.
- **Tags Input suggestions** (the pattern extraction, the suggestion parts, `closeOnSelect`) are
  the follow-up change `tags-input-suggestions`.
- **Retired:** `openspec/changes/add-command` and `openspec/changes/add-autocomplete` are
  removed. The inventory rows "Autocomplete" and "Command" merge into "Combobox".

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `combobox`: Anatomy, Combobox Data Attributes, Combobox Contract and Theme are modified.
  Added: Free-Text Mode, Free-Text Forms, Free-Text Escape And Clear, Inline Mode, Running
  Actions, Inline Escape, Inline Highlight And Scrolling, Filtering Without Reordering,
  Loading, Pages, Inside A Dialog, Variant Model Coverage.

## Non-goals

- Separate `Autocomplete` / `Command` exports, drivers or stylesheets.
- The retired Autocomplete mode `inline` (completion without filtering). Recorded in
  docs/review-backlog.md. Its mode `none` (a static list, no completion) is
  `autoComplete="list"` with `filter: null`.
- Fuzzy ranking or reordering inside the component; global ⌘K shortcuts; a `Dialog` part for
  the palette; grid palettes; selection in the inline mode.
- Framework adapters other than React; fx.

## Impact

- `packages/core/src/components/combobox/`:
  - the machine gains `inline`, `onAction`, `page` / `onBack`, and the free-text form rules;
  - `pattern/` gains the shared actions, guards and connect helpers;
  - connect, contract, messages and meta.
- `packages/core/src/components/tags-input/`: suggestions on the pattern module.
- `packages/react/src/combobox/` (Loading, ItemDescription; inline rendering) and
  `packages/react/src/tags-input/` (suggestion parts).
- `@rind-ui/testing`: `getCombobox` covers the variants; model configurations.
- `packages/theme/src/combobox.css` (inline and free-text), site examples and the Combobox
  docs page sections "Autocomplete" and "Command palette".
- No new runtime dependency.
