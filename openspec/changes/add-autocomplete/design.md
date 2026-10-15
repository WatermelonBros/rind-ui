## Context

See proposal.md for motivation and specs/autocomplete/spec.md for behaviour. Research:
[autocomplete.md](../../../docs/research/autocomplete.md); everything about the input +
popup is `combobox-pattern` from `add-combobox` (design there, and
[combobox.md](../../../docs/research/combobox.md)). This change consumes, without
restating:

| From | Used for |
|---|---|
| `add-combobox` | `combobox-pattern` (pattern actions, guards, effects, connect helpers, contract fragment), the `combobox` machine with `selectionMode: "none"` |
| `add-foundations` | controllables (`value` → the machine's `inputValue`, `open`), contracts, drivers, `testMachine`, React adapter |
| `add-a11y-foundations` | IME guard, announcer, quirks, messages, invariants |
| `add-overlay-infrastructure`, `add-floating-positioning`, `add-collections`, `add-button` | as in `add-combobox` |

## Goals / Non-Goals

**Goals:**
- No second machine: Autocomplete is a configuration of `combobox.machine.ts` plus its
  own connect (prop renaming, `data-scope="autocomplete"`, native form attributes) and
  contract.
- Same AT behaviour as Combobox by construction (the pattern is shared, so RA#10326 —
  an autocomplete stack without the combobox announcer — cannot happen).

**Non-Goals:**
- Command (always-visible list), Tags Input, Mentions.

## Decisions

### 1. Preset over the Combobox machine

```ts
// autocomplete.connect.ts — mapping, no behaviour
const machineProps = (p: AutocompleteProps): ComboboxMachineProps => ({
  ...p,
  selectionMode: "none",
  inputValue: p.value, defaultInputValue: p.defaultValue, onInputValueChange: p.onValueChange,
  autoComplete: p.mode === "both" || p.mode === "inline" ? "both" : "list",
  ariaAutocomplete: p.mode ?? "list",
  filter: p.mode === "inline" || p.mode === "none" ? null : (p.filter ?? "contains"),
  closeOnSelect: p.closeOnChoose ?? true,
  fillOnChoose: true,
})
```

- In `none` mode the machine's `ITEM.CHOOSE` action `fillText` sets `inputValue` to the
  option's text with reason `item-press` / `enter`; `commitText` is a no-op (no revert,
  no custom-value rule, no exact-match selection) except that a shown inline completion
  is accepted on blur/Tab (Ariakit's focusout commit).
- `clearOnEscape` adds one guarded transition on `closed`: `ESCAPE [clearOnEscape &&
  hasText] → actions: clearText`.
- `submitOnChoose`: the `fillText` action, when set, queues `env.form.requestSubmit(input)`
  after the value update (through `core/dom`, so a controlled parent's refusal still
  submits what the input shows — documented).
- *Alternatives:* a separate `autocomplete` machine (duplicates every pattern transition
  — the Zag-has-none / RA-has-two outcome); Combobox with `allowCustomValue` (keeps a
  selection model, `aria-selected="true"` on the matching option, revert paths).

### 2. Connect

- Input: native `name`, `form`, `required`, `autocomplete` (= `formAutoComplete ??
  "off"`), `aria-autocomplete` from `mode`. No `hidden-form-input`.
- Options: `aria-selected="false"` always; no ItemIndicator part.
- Messages: the pattern messages; `selectedAnnouncement(item)` is spoken on fill (Apple,
  per the pattern's quirk rule).

### 3. Contract

```ts
import { optionsNeverSelected } from "../combobox/pattern"   // shared with Command

export const autocompleteContract = contract(comboboxMachine, {
  scope: "autocomplete",
  locate: { role: "combobox", name: true, part: "input" },
  ...collectionContract({ itemRole: "option", strategy: "active-descendant", select: "enter" }),
  ...comboboxPatternContract,
  ...positioningQueries,
  traits: ["composite-activedescendant", "set-metadata", "layer", "presence", "anchored"],
  announcements: { focusAnnouncement, countAnnouncement, selectionAnnouncement },
  invariants: [optionsNeverSelected],
  actions: { choose, clear },
  queries: { value },
  events: { /* as combobox, minus chips/AUTOFILL; */ "CHIP.REMOVE": { skip: "selectionMode none" },
    "CHIP.NAVIGATE": { skip: "selectionMode none" }, BACKSPACE_EMPTY: { skip: "selectionMode none" },
    "CHIP.TYPE": { skip: "no chips in autocomplete" },
    "$sync:inputValue": { props: (value) => ({ value }) }, "$sync:open": { props: (open) => ({ open }) },
    "$sync:value": { skip: "selectionMode none has no selection" } },
})
```

Props classes: each `mode`, `submitOnChoose`, `clearOnEscape`, `filter: null` +
`itemsQuery`, empty results with/without Empty, read-only.

### 4. Theme

`packages/theme/src/autocomplete.css` declares `--rind-autocomplete-*` tokens whose
defaults are the matching `--rind-combobox-*` tokens (one visual family; overridable
per component) and the same `data-variant` / `data-size` rules.

### Field binding (amendment from add-field)

The Root reads add-field's `field-control` binding and registers the Input once (the Input
is the validity element). Field ARIA goes on the Input only; flags are OR-merged with the
Field and an enclosing Fieldset; changes are reported with `composing`, and Enter or
closing reports a commit (spec "Field Control Binding", task A.2).

## Risks / Trade-offs

- [Autocomplete depends on Combobox's machine; a Combobox change can regress it] → the
  Autocomplete model-based suite runs in the Combobox package's CI job.
- [`submitOnChoose` with a controlled parent that refuses the fill] → the submitted text is
  what the input shows after the parent's render; documented and tested.
- [Pattern requests in `add-combobox` (announcement quirks) are pending] → inherited
  automatically when accepted.

## Requests to other changes

None beyond those listed in `add-combobox` design.md, which apply to this component too.

## Migration Plan

New API. Base UI `Autocomplete`: same names (`mode`, `value`, `onValueChange`,
`submitOnItemClick` → `submitOnChoose`). Reka `AutocompleteRoot` v-model → `value`.
