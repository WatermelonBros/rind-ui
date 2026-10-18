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

- **`inline`** starts the machine in `open` and guards every transition to `closed`
  (`notInline`). The list is "exposed" whenever it has results. `closed` stays in the graph
  but is unreachable under `inline`; model configurations with `inline` start in `open` and
  the runner only walks reachable paths. A development error is reported when `inline` is
  combined with `selectionMode` `single` or `multiple` (an always-open selecting list is a
  Listbox with a filter, out of scope).
- **`onAction(key, details)`** runs on ITEM.CHOOSE in inline mode (details: modality,
  modifiers). Under `selectionMode="none"` with a popup it is also called, after the text is
  filled, so an autocomplete can react to a choice without diffing text.
- **Pages:** `page` (`{ key, label }`, read-only binding, `onProps` → `PAGE.CHANGE`) and
  `onBack()`. `BACKSPACE_EMPTY` already exists (chips): in inline mode it calls `onBack`.
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

### 6. Where the retired requirements went

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

## Risks / Trade-offs

- [An unreachable `closed` state under `inline`] → the runner walks reachable paths only, and
  an invariant checks `aria-expanded` against `exposed`, not against `open`.
- [Escape calling `onOpenChange(false)` while the machine stays open] → the callback is a
  request to the host, as in a controlled `open` that the parent refuses. The machine never
  leaves `open` under `inline`.
- [One contract for three variants] → per-configuration traits keep each model test honest.
  The Combobox model suite already runs per props class.
