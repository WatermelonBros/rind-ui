## Context

See proposal.md for motivation and specs/select/spec.md for behaviour. Research and the
Bug history the scenarios cite: [select.md](../../../docs/research/select.md). This
change consumes, without restating:

| From | Used for |
|---|---|
| `add-foundations` | `setup()`/`machine()`, `controllable()` (`open`, `value`), `bindProp()` (`multiple`, `modal`), state-scoped effects, contracts (`{ skip }`, prop steps), drivers, `testMachine`, React adapter |
| `add-a11y-foundations` | `core/dom/press` (trigger and option presses on release, `virtual`/`touch` modality, touch scroll cancellation), `core/dom/keyboard` (logical keys, Alt+ArrowDown, IME guard), `focusSafely`, `data-focus(-visible)`, messages (list format), quirks, invariants |
| `add-overlay-infrastructure` | `overlayEffect` (layer `kind: "listbox"`, dismiss, initial focus, restore), stack-driven inert / scroll lock, presence, `Portal`, traits `layer`/`modal`/`presence`/`restores-focus` |
| `add-floating-positioning` | `env.position.track`, preset `dropdown`, `POSITION.PLACED`, `--rind-anchor-width`, `positioningQueries`, `anchored` trait |
| `add-collections` | `Collection`, `collectionActions`/`Guards`/`Effects` (navigate, typeahead, pointerMove, repair, focusHighlighted, scrollToHighlighted), the closed-trigger typeahead path, selection key → text map, `scrollToIndex` reason `open`, pointer guard, collection contract fragment |
| `add-listbox` | listbox parts (`listProps`, `itemProps`, …), `listboxKeymap`, `listboxMachinePieces`, `createListboxParts` (React) |
| `add-button` | `button-like-element` for the trigger (native button, disabled / `focusableWhenDisabled`, fieldset) |
| `add-checkbox` | `hidden-form-input` (`env.formInput`, reset, focus forwarding, events for user changes only, `form-associated` trait); `control-label` Description part |

## Goals / Non-Goals

**Goals:**
- A flat two-state graph; everything inside the list comes from the listbox fragment.
- Form participation that cannot duplicate a role, a name or an option text.
- Reado's `Select` atom and its tests port without workarounds.

**Non-Goals:**
- Item-aligned placement, drag-to-select, filtering (proposal Non-goals).

## Decisions

### 1. Machine

```
            TRIGGER_PRESS · TRIGGER_KEY · OPEN · $sync:open(true)
  closed ─────────────────────────────────────────────────────► open
    ▲                                                            │
    └── TRIGGER_PRESS · SELECT (single) · ESCAPE_KEY · TAB_KEY ·  ┘
        OUTSIDE_PRESS · OUTSIDE_FOCUS · WINDOW_BLUR · CLOSE · $sync:open(false)

closed: TYPEAHEAD (single: select match) · FORM.RESET · FORM.AUTOFILL · LABEL_PRESS
open:   NAVIGATE · HIGHLIGHT · POINTER_MOVE · TYPEAHEAD (highlight only) · SELECT (multiple: toggle)
        POSITION.PLACED { first } → focusInitial
root:   COLLECTION.CHANGE → repairCollection · $sync:value · $reverted
```

```ts
type SelectEvent =
  | ({ type: "TRIGGER_PRESS" } & PressFields)
  | { type: "TRIGGER_KEY"; key: "OPEN_FIRST" | "OPEN_LAST"; modality: "keyboard" }  // Enter/Space/Down/Alt+Down · Up
  | { type: "LABEL_PRESS" }
  | { type: "ESCAPE_KEY" | "OUTSIDE_PRESS" | "OUTSIDE_FOCUS"; request: DismissRequest }
  | { type: "TAB_KEY"; shift: boolean } | { type: "WINDOW_BLUR" }
  | { type: "POSITION.PLACED"; side: Side; align: Align; anchorHidden: boolean; first: boolean }
  | { type: "FORM.RESET" } | { type: "FORM.AUTOFILL"; text: string }
  | { type: "OPEN" } | { type: "CLOSE" }
  | CollectionEvent                                     // NAVIGATE, HIGHLIGHT, POINTER_MOVE, TYPEAHEAD, SELECT, COLLECTION.CHANGE
```

- States are only `closed | open`. Trigger focus is modality/`data-focus` state from
  a11y-foundations, not a machine state (Zag's `idle | focused` split doubles the graph).
- `TYPEAHEAD` is one event with two state-scoped handlers: in `closed` the action is
  `typeaheadSelect` (collections' typeahead step + `select`, single only — guard
  `isSingle`), in `open` it is collections' `typeahead` (highlight). One matcher for
  both paths (BU#5776).
- `open` entry records `openModality` and `openKey`; `POSITION.PLACED { first }` runs
  `focusInitial`: highlight = first selected navigable key, else `last` for
  `OPEN_LAST`, else first navigable; then `scrollToHighlighted` (reason `open`, centred — request 4), then
  roving focus with `preventScroll`. Scroll before focus is what makes the selected item
  visible without a page scroll (RA#3910) and is visible in the graph.
- `SELECT` in `open` single: `select` then `close("ITEM_SELECT")`; the close is queued
  after the option's `click` dispatch (press module order), so a touch selection never
  reaches the element under the popup. Multiple: `select` (toggle) only.
- `TAB_KEY`: close, then focus the trigger without `preventDefault` so the browser's
  Tab continues from it (Menu's approach). `ESCAPE_KEY` `preventDefault`s.
- `FORM.AUTOFILL`: match key, else text value with the search collator (Base UI's
  `SelectRoot` matching); guard `isSingle`; sets `autofilled` until the next `SELECT`.
- `disabled` / `readOnly`: guards on every opening and value event; `bindProp`.

### 2. Reuse of the listbox

`select.connect.ts` builds a `ListboxPartsView` with `scope: "select"` and calls the
listbox parts; it adds `onPointerMove` (pointer guard → `POINTER_MOVE`) and the Escape /
Tab handlers on `list`. `select.machine.ts` spreads `collectionActions`,
`collectionGuards` and `listboxMachinePieces`; `selectionBehavior` is fixed to
`toggle` (single press replaces, multiple press toggles — the selection-model semantics).
React: `Select.List`, `Select.Item`, … are `createListboxParts(useSelectView)`.

### 3. Trigger, label and list naming

- Trigger: `button-like-element` + `role="combobox"`, `aria-expanded`, `aria-controls`
  (mounted list only), `aria-labelledby` = label id when rendered (no `for`: the label
  is a `span`, not a native `<label>`, so a label click cannot become a trigger
  activation and never targets the hidden input), consumer naming otherwise.
  *Alternatives:* a plain button with `aria-haspopup="listbox"` named by value + label
  (React Aria, Headless UI) — the name changes with every value, so role+name location
  breaks and Reado's `getByRole("combobox", { name })` tests would need rewriting;
  `<label for=trigger>` (control-label) — a label click would open the popup and the
  native select does not do that.
- The trigger declares the press option `labelActivation: "focus"` (add-label,
  add-a11y-foundations `press-interactions`): a click forwarded from any other label (a
  Field's Label, a consumer `<label for>` or a wrapping `<label>`) only focuses it and
  never opens the popup (radix#3679, headlessui#3787).
- `LABEL_PRESS` focuses the trigger through `focusSafely` with modality `keyboard` (so
  `data-focus-visible` shows where focus went, RA's `useSelect` label rule).
- List: `aria-labelledby` = label id; else copy of the trigger's consumer `aria-label`;
  else consumer `aria-labelledby`. Never the trigger id (a `combobox` referenced by
  `aria-labelledby` contributes its value, accname "embedded control").

### 4. Form participation (no hidden `<select>`)

```
<input data-part="hidden-input" aria-hidden tabindex=-1 style=visually-hidden-input
       name value=key|"" form required disabled autocomplete>        ← constraint + autofill target
<input type="hidden" name=tags value=a>  <input type="hidden" name=tags value=c>   ← multiple only
```

- Through `env.formInput` (`hidden-form-input`): property sync after commit, `input` +
  `change` on user changes only, `RESET` from the form's `reset`, focus forwarding to the
  trigger, scroll-into-view of the trigger on validation.
- Multiple: the visually hidden input has no `name` and carries the constraint (`value`
  is `"x"` when any key is selected, `""` otherwise, so `required` means "at least one");
  the hidden inputs carry the values.
- Autofill: the hidden input's native `input` event (not caused by us) → `FORM.AUTOFILL`
  (request 2 below).
- *Alternatives:* a hidden native `<select>` with every `<option>` (React Aria, Radix,
  Ariakit, Zag/Ark): gives the platform's own autofill matching and `required` on
  `<option value="">`, but (a) duplicates every option's text for `getByText`
  (Ark's own test needs `ignore: "option"`), (b) gets the label's `for`/`<label>` so
  `getByLabelText` finds two elements (RA's `HiddenSelect` wraps the select in a
  `<label>`, Zag points `htmlFor` at it), (c) needs the options mounted or rendered from
  data on every value change (RX#2602, ARK#3021), (d) RA switches to hidden inputs above
  300 items anyway. Base UI and Bits UI use an `<input>`; Base UI matches autofilled
  text against values and labels — we copy that.

### 5. Value text

`valueTextProps` renders from `(selection, collection, keyTextMap)`; single: text value
of the selected key; multiple: `messages.valueList(texts)` (`Intl.ListFormat`, locale from
a11y-foundations); empty: `placeholder`. The React part keys its text node by the value
(`<span key={valueKey}>`) — WebKit re-reads a replaced node (ZG#3099). A function child
`(items) => ReactNode` lets consumers render icons (Reado's colour dot).

### 6. Overlay and positioning

`overlay` effect: `kind: "listbox"`, `modal` (default `true`), dismiss `{ escape: true,
outsidePress: true, outsideFocus: !modal }`, `elements: () => [positioner, content,
trigger, label]` — trigger and label stay outside `inertOutside`, so the trigger toggles
and the list's `aria-labelledby` → label resolves in Chromium (RA#9737). `trackPosition`
with preset `dropdown`; `windowBlur` effect. The theme sets
`min-width: var(--rind-anchor-width)` on the content.

### 7. Contract

```ts
export const selectContract = contract(selectMachine, {
  scope: "select",
  locate: { role: "combobox", name: true, part: "trigger" },
  ...collectionContract({ itemRole: "option", strategy: "roving", select: "both" }),
  ...positioningQueries,
  traits: ({ props }) => ["disclosure", "layer", "restores-focus", "presence", "anchored",
    "composite-roving", "selectable", "form-associated", ...(props.modal === false ? [] : ["modal"] as const)],
  actions: { open, openWithArrowUp, close, choose, toggle, typeahead, typeaheadClosed, pressOutside, tabOut, resetForm },
  queries: { isOpen, value, selected, items, highlighted, focusedItem, isPlaceholder, isDisabled, isInvalid, isRequired, formValue, closeReason },
  events: {
    TRIGGER_PRESS: "open", TRIGGER_KEY: "open", SELECT: "choose", TYPEAHEAD: "typeahead",
    ESCAPE_KEY: "close", OUTSIDE_PRESS: "pressOutside", TAB_KEY: "tabOut", "FORM.RESET": "resetForm",
    LABEL_PRESS: { skip: "label focus; driver test" }, OUTSIDE_FOCUS: { skip: "non-modal only; driver test" },
    WINDOW_BLUR: { skip: "window focus" }, "FORM.AUTOFILL": { skip: "browser autofill; browser test" },
    OPEN: { skip: "programmatic" }, CLOSE: { skip: "programmatic" },
    "$sync:open": { props: (open) => ({ open }) }, "$sync:value": { props: (value) => ({ value }) },
  },
})
```

`TYPEAHEAD` maps to `typeahead` in `open` and to `typeaheadClosed` in `closed` (the
runner picks the action declared for the source state; the closed one focuses the
trigger, the open one the list). `formValue` reads the hidden inputs' `value` properties.

### 8. Theme

`packages/theme/src/select.css` reads tier-3 tokens only (decision 0007, after
`add-theme-system`): `--rind-select-trigger-height`, `-trigger-padding`, `-trigger-bg`,
`-trigger-border`, `-trigger-radius`, `-trigger-text`, `-placeholder-text`,
`-indicator-size`, `-invalid-border`, `-content-bg`, `-content-border`,
`-content-radius`, `-content-shadow`, `-content-padding`, `-content-max-height`
(`min(var(--rind-select-content-max-height), var(--rind-available-height))`), and
`--rind-select-item-*` defaulting to the `--rind-listbox-item-*` tokens; each defaults to
a semantic token.

### Resolved questions

| Question | Decision | Why |
|---|---|---|
| Open on pointerdown or release | Release, all inputs | accessibility rule 15; touch scroll and tap-through bugs; Menu decided the same |
| Focus strategy | Roving in the popup | add-collections / accessibility §4.2: no text field, so no VoiceOver announcer |
| Trigger role | `combobox` (APG select-only), named by the label | Stable name for role+name location; Reado tests already query `combobox` |
| Hidden native `<select>` | No; one hidden `<input>` + autofill matching | No duplicated text/labels, no options to render, Base UI precedent |
| Item-aligned | Not in v1 | research Bug history; touch disables it anyway; Reado uses bottom-start |
| Closed-trigger typeahead | Selects without opening, single only | Native desktop select, RA/Zag/Radix; collections' closed-trigger scenario |
| Closed-trigger arrows | Open (no value change) | APG; Windows-style "arrow changes value while closed" surprises and is not in APG |
| Tab in the popup | Close without committing | Same as Escape for the value; Menu parity; APG's commit-on-Tab is noted as a difference |
| Modal default | `true` | Native select behaviour (scroll and outside inert), Menu parity |
| Loop | `false` | Native select and APG listbox |

### Field binding (amendment from add-field)

The Root reads add-field's `field-control` binding and registers the trigger once (hidden
constraint input as validity element). Field ARIA goes on the trigger only, never the
list; flags are OR-merged with the Field and an enclosing Fieldset; closing the popup
reports a commit (spec "Field Control Binding", task A.3).

## Risks / Trade-offs

- [No hidden `<select>`: autofill relies on matching written text] → Base UI ships it;
  browser test with a dispatched native `input` event; unmatched text is ignored.
- [`role="combobox"` with focus moving into the popup departs from the APG select-only
  example (which keeps focus on the combobox)] → Radix and Base UI do the same, and APG's
  activedescendant variant is the VoiceOver-silent one; the manual protocol checks VO,
  NVDA, JAWS and TalkBack.
- [Closed-trigger typeahead changes the value without an announcement] → the value text
  is the combobox's content and screen readers read the change on a focused combobox;
  checked in the manual protocol, an announcer entry if a reader stays silent.
- [Modal default costs a click to move to another field while open] → native behaviour;
  `modal={false}` exists.

## Requests to other changes

To `add-checkbox` (`hidden-form-input`) — APPLIED there (task A.1):

1. **Input kind other than the native counterpart.** The spec says the hidden input is
   "of the type its native counterpart has"; Select's counterpart is `<select>`, and this
   change uses an `<input>` (design §4). Allow a component to declare its input element,
   and let the multiple-value case add `<input type="hidden">` value carriers next to the
   constraint input.
2. **Adopt autofill instead of reverting it.** "Value Mirrored As Properties" re-syncs the
   input from the component whenever something else changes it. Add an opt-in
   `onNativeInput(value)` on `FormInputCapability.track` so a native `input` event that
   the component did not dispatch (autofill, password managers) reaches the machine as an
   event, and the re-sync only happens if the machine rejects it.
3. **`form-associated` trait per component.** The trait compares `checked`,
   `indeterminate` and `value`; let a contract declare which properties (Select: `value`
   of every hidden input, in order) the oracle is compared against.

To `add-collections` (`collection-navigation`, "Scrolling Follows Navigation Only") — APPLIED there (task A.1):

4. **Centre on open.** That requirement scrolls with `block: "nearest"` for every source,
   including opening a popup. Select centres the selected option on open (native select
   parity, ariakit#7011; "nearest" leaves a far-down selection on the bottom edge). Add
   a `block` per reason (`open` → `center`, navigation → `nearest`) to the scroll action
   and to the `scrollToIndex` details (`align: "center"` for virtualizers).

## Migration Plan

New API. Reado `atoms/Select.tsx`: `createListCollection({ items, itemToString,
itemToValue })` → `createListCollection({ items, getKey, getText })` (memoised);
`value={[value]}` / `onValueChange={(d) => …d.value[0]}` → `value={value}` /
`onValueChange={(v) => v !== null && onChange(v)}`; `positioning={{ placement:
"bottom-start", sameWidth: true, gutter: 4 }}` → default preset + theme
`min-width: var(--rind-anchor-width)`; `Select.Control` is dropped; `ArkSelect.*` →
`Select.*`. Tests: `pick()` in `SettingsControls.uitest.tsx` becomes
`getSelect(screen, { name }).choose(option)`; the theme-mode select gets a driver test.
