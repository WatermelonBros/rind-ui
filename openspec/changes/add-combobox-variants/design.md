## Context

`add-combobox` shipped one machine (`combobox.machine.ts`, `closed | open`) with
`selectionMode: "single" | "multiple" | "none"` and the shared rules in `combobox-pattern`,
which already states "Usable Without A Popup". The retired `add-command` designed a machine
of its own, so that a closed state would not sit unreachable in the model graph. The user's
decision that Command is a Combobox variant settles that the other way: one machine, one API.

## Decisions

### 1. Two orthogonal props, one machine

| Variant | Props | Value | Popup |
|---|---|---|---|
| Combobox | `selectionMode` `single` / `multiple` | the selected key(s) | yes |
| Autocomplete | `selectionMode="none"` | the text (`inputValue`) | yes |
| Command | `inline` (implies `selectionMode="none"`) | none; items run `onAction` | no |

- **States from props.** One `setup()` (actions, guards, context, effects) builds two machine
  definitions: `comboboxMachine` (`closed | open`) and `inlineComboboxMachine` (the single state
  `open`, no closed node and no open/close transitions). The React Root picks the definition by
  `inline` (fixed for the instance's life; a change warns in development). The contract takes
  the configuration's machine, so the model graph of an inline configuration has no `closed`
  node to cover. This replaces a guarded `closed` state, which add-command's design had already
  rejected. The list is "exposed" whenever it has results. A development error is reported when
  `inline` is combined with `selectionMode` `single` or `multiple` (an always-open selecting
  list is a Listbox with a filter, out of scope).
- **`onAction(key, details)`** runs on ITEM.CHOOSE in inline mode (details, the same in every
  configuration: `{ modality, modifiers }`). Under `selectionMode="none"` with a popup it is also called, after the text is
  filled, so an autocomplete can react to a choice without diffing text.
- **Pages:** `page` (`{ key, label, depth }`, read-only binding, `onProps` → `PAGE.CHANGE`) and
  `onBack()`. `BACKSPACE_EMPTY` already exists (chips): in inline mode it calls `onBack` when
  `depth > 0`.
- **Escape inline:** with a query, Escape clears it (reason `escape`, prevented). Without one,
  it calls `onOpenChange(false, { reason: "escape" })` and is prevented, so the host decides
  (a dialog host closes its dialog). If no `onOpenChange` is given, Escape is left unhandled,
  so an enclosing layer still closes.
- **Count:** the pattern's `count(n)` message ("N results"), polite, keyed per instance,
  debounced like the pattern. Inline mode announces it on every query change after mount and
  never at mount.

### 2. Free text (Autocomplete)

The existing `selectionMode: "none"` preset gains its form rules:
- `name` / `form` / `required` go on the visible input (no hidden input);
- Enter with no highlight is not prevented (implicit submission);
- `submitOnChoose`;
- reset restores `defaultInputValue`;
- `clearOnEscape` defaults to false.

`autoComplete` stays `list` | `both`. The retired spec's `inline` and `none` modes are out of
scope (backlog).

### 3. Pattern extraction for Tags Input

`combobox/pattern/pattern.ts` (111 lines today) becomes the home of everything a second host
needs. That is:
- the highlight-while-typing actions and guards;
- `ACTIVEDESCENDANT.FLUSH` scheduling;
- collection repair by key;
- the count and no-results announcements;
- composition tracking;
- Enter-on-highlight;
- `patternConnect` (input, listbox, option and empty props, with `expanded` from the host's
  `exposed`);
- the `optionsNeverSelected` invariant;
- the contract fragment.

Combobox spreads them; Tags Input spreads the same ones into its machine for its Suggestions
requirement, so "one machine" holds for both. No behaviour of Combobox changes. Its model
tests are the regression check.

### 4. Parts and rendering

- Inline: Root renders `Label`, `Control`, `Input`, `List`, `Empty`, `Loading`. Positioner,
  Popup and Trigger render nothing, with a development warning. The list's empty space
  counts as the popup's for focus keeping.
- `Loading` (new, both modes) is a sibling of the List, never inside it, with no live role.
  `ItemDescription` (new) is the reusable listbox part, referenced by the option's
  `aria-describedby`.
- Descriptions of the input (palette footer hints) come from a Field's Description or the
  consumer's `aria-describedby`. No Combobox Description part.

### 5. Contract

`comboboxContract` stays one contract. Per configuration:
- `selectionMode: "none"`: traits without `selectable`, with `optionsNeverSelected`.
- `inline`: `open()` / `close()` as `{ skip: "inline: no popup" }`; no `layer`, `presence` or
  `anchored` traits.
- New actions `run(name)` and `back()`; new queries `items()` and `page()`.
- `$props:page` is a prop step.

The driver stays `getCombobox`. The contract helper that builds a configuration's traits is
exported, so the model tests declare each variant once.

### 6. Renames

| Before | After | Why |
|---|---|---|
| Tags Input `closeOnChoose` (tags-input Suggestions) | `closeOnSelect` | one name for every host of the shared pattern (Combobox already ships `closeOnSelect`) |
| retired Autocomplete `closeOnChoose` | `closeOnSelect` | same |
| retired Autocomplete `value` (the text) | `inputValue` / `onInputValueChange` | one text value per Combobox; `onValueChange` never fires in free-text mode |
| retired Autocomplete `mode` | `autoComplete` (`list` / `both`) | Combobox's existing prop |
| retired Command `Command.*` parts | `Combobox.*` with `inline` | no separate exports |
| retired Command `page` `{ key, label }` | `{ key, label, depth }` | Backspace goes back only above the root page |

### 7. Where the retired requirements went

| Retired requirement | Now |
|---|---|
| command: Anatomy | combobox Anatomy (Loading, ItemDescription), Inline Mode |
| command: Built On The Combobox Pattern Without A Popup | Inline Mode (with combobox-pattern "Usable Without A Popup") |
| command: Highlight And Initial State, Scrolling | Inline Highlight And Scrolling |
| command: Keyboard Interactions | combobox-pattern (unchanged) + Inline Mode (Home/End edit text) |
| command: Running Items | Running Actions |
| command: Escape | Inline Escape (decision: `onOpenChange(false)` for a dialog host) |
| command: Filtering Without Reordering, Groups And Separators | Filtering Without Reordering |
| command: Loading | Loading |
| command: Pages | Pages |
| command: Inside A Dialog | Inside A Dialog |
| command: Names And Descriptions | Inline Mode; pattern Roles And Relations |
| command: Data Attributes, Messages, Contract, Theme, Model-Based Coverage | the modified combobox requirements and Variant Model Coverage |
| autocomplete: Built On The Combobox Pattern, Anatomy | Free-Text Mode (scope stays `combobox`) |
| autocomplete: The Value Is The Text, Choosing Fills The Input | Free-Text Mode |
| autocomplete: Modes | Free-Text Mode: `list` / `both` only; `inline`, `none` → backlog |
| autocomplete: Enter And Forms | Free-Text Forms |
| autocomplete: Escape And Clear | Free-Text Escape And Clear |
| autocomplete: Data Attributes, Contract, Theme | the modified combobox requirements |
| autocomplete: Field Control Binding | combobox Field Control Binding (unchanged: the Input is the validity element in free-text mode) |
| autocomplete: Modes `inline` (completion without filtering) | dropped: backlog (no user asks for it) |
| autocomplete: Modes `none` (a static list, no completion) | carried: `autoComplete="list"` with `filter: null` |
| autocomplete: No announcer gap (adobe/react-spectrum#10326) | Free-Text Mode scenario |
| command: `navigate(move)` / `highlight(key)` API | Inline Mode |
| command: Large lists (dip/cmdk#191), Accents (dip/cmdk#173) | Filtering Without Reordering scenarios |
| command: Dialog has a name (dip/cmdk#393) | Inside A Dialog scenario |
| command: Two palettes (dip/cmdk#368), Click keeps the highlight (huntabyte/bits-ui#2063), Active descendant (dip/cmdk#413, dip/cmdk#373) | Inline Mode scenarios |
| command: Valid listbox children with axe (dip/cmdk#179) | Filtering Without Reordering scenario |
| command: App shortcut is not a navigation key (huntabyte/bits-ui#1067), Korean ArrowDown (dip/cmdk#348), Japanese Enter in Safari (dip/cmdk#206) | combobox-pattern (IME Composition, Enter, Escape And Tab: unchanged, already specified there) |
| command: Shortcut hints described (mui/base-ui#4248), Localised list name (dip/cmdk#196) | Inline Mode (Field Description / `aria-describedby`); pattern Roles And Relations (`listboxLabel`) |
| command: Messages `pageAnnouncement` | Pages |
| coverage: virtualized, `itemsQuery`, `virtual` modality, Apple/WebKit, Apple/Blink and Windows emulations | Variant Model Coverage |

## Risks / Trade-offs

- [Two machine definitions from one setup] → they share every action, guard and effect; only
  the state map differs, and each configuration's model graph is the one that runs.
- [Escape calling `onOpenChange(false)` while the machine stays open] → the callback is a
  request to the host, as in a controlled `open` that the parent refuses. The machine never
  leaves `open` under `inline`.
- [One contract for three variants] → per-configuration traits keep each model test honest.
  The Combobox model suite already runs per props class.
