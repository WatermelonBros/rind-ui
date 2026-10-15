## Context

See proposal.md for motivation and the two specs for behaviour. Research, the library
comparison and the Bug history the scenarios cite: [combobox.md](../../../docs/research/combobox.md)
(and [autocomplete.md](../../../docs/research/autocomplete.md) for the shared parts).
This change consumes, without restating:

| From | Used for |
|---|---|
| `add-foundations` | `setup()`/`machine()`, `controllable()` (`value`, `inputValue`, `open`), `$sync` / `$reverted`, `onProps`, effects, delays, contracts (`{ skip }`, prop steps), drivers, `testMachine`, React adapter (`render`, ids, per-part selectors) |
| `add-a11y-foundations` | `core/dom/press` (options, trigger, clear, chip remove; `virtual` modality; `preventFocusOnPress`), `core/dom/keyboard` (logical keys, IME guard `notComposing`, Safari commit-Enter quirk), modality + `FOCUS.cause`, `focusSafely`, announcer (keys, polite), quirks registry (`vo-activedescendant`), `messages`, invariants (announcement parity, IME never commits, focus alone does not commit) |
| `add-overlay-infrastructure` | `overlayEffect` with `kind: "listbox"`, `modal: false`, dismiss `{ escape: true, outsidePress: true, outsideFocus: false }`, `elements: () => [positioner, popup, control]` so input/trigger/clear presses are inside; presence; generic `Portal` (optional) |
| `add-floating-positioning` | `env.position.track` with the `dropdown` preset, `sideLock: "open"`, `--rind-anchor-width`, `--rind-available-height`, `POSITION.PLACED`, `anchored` trait |
| `add-collections` | `Collection`, `createFilter(locale)`, `selection-model` (single / multiple, disabled rules, survives filtering, label map), `collection-navigation` with `active-descendant` (highlight, moves, loop, repair, pointer guard, scroll), async status, virtualization contract, collection contract fragment, `selectable` / `set-metadata` traits |
| `add-checkbox` | `hidden-form-input` (submission, reset, validation, events for user changes), `control-label` (native `<label for>` on the input) |
| `add-button` | `button-like-element` for Trigger, ClearTrigger, ChipRemove |

## Goals / Non-Goals

**Goals:**
- One `combobox` machine for Combobox (`single`, `multiple`) and Autocomplete (`none`);
  the shared pattern lives in `components/combobox/pattern/` as actions, guards and
  connect helpers that Command, Tags Input and Mentions will spread into their own
  machines (the collections reuse model).
- Every text change is a machine transition; the input element is never written
  imperatively, so React's controlled input and IME never race.
- Every scenario that cites an issue has a test that reproduces it first.

**Non-Goals:**
- Hierarchical states, data fetching, a virtualizer, dialog/grid popups.

## Decisions

### 1. Machine: flat `closed | open` (machine-runtime open question 1)

```
              INPUT.CHANGE(openOnInput) / ARROW(openOnArrow) / TRIGGER.PRESS /
              INPUT.PRESS(openOnInputPress) / INPUT.FOCUS(openOnFocus, cause≠layer|window) /
              OPEN / $sync:open(true)
   closed ─────────────────────────────────────────────────────────────────────► open
     ▲                                                                            │
     └── ITEM.CHOOSE(closeOnSelect) · ENTER(no highlight → commit) · ESCAPE ·     ┘
         TAB · OUTSIDE_PRESS · INPUT.BLUR · TRIGGER.PRESS · CLEAR(open stays) ·
         CLOSE · $sync:open(false)
   closed: ESCAPE(dirty → commit) · ENTER(commit) · INPUT.BLUR(commit) · INPUT.CHANGE(!openOnInput)
   root:   COLLECTION.CHANGE · $sync:value · $sync:inputValue · $reverted · COMPOSITION.START/END ·
           CHIP.NAVIGATE · CHIP.REMOVE · CHIP.TYPE · BACKSPACE_EMPTY · CLEAR
```

```ts
type ComboboxEvent =
  | { type: "INPUT.CHANGE"; text: string; inputType: string; composing: boolean }
  | { type: "INPUT.FOCUS"; modality: Modality; cause: FocusCause }
  | { type: "INPUT.BLUR"; related: "inside" | "outside" }
  | ({ type: "INPUT.PRESS" | "TRIGGER.PRESS" | "CLEAR.PRESS" } & PressFields)
  | { type: "ARROW"; key: "NEXT" | "PREV"; alt: boolean; composing: boolean }
  | { type: "ENTER" | "ESCAPE" | "TAB"; composing: boolean; shift?: boolean }
  | { type: "CARET"; key: "LEFT" | "RIGHT" | "HOME" | "END"; atStart: boolean }
  | { type: "BACKSPACE_EMPTY"; composing: boolean }
  | { type: "ITEM.CHOOSE"; key: CollectionKey; modality: Modality }
  | { type: "CHIP.NAVIGATE"; move: "prev" | "next" | "input" } | { type: "CHIP.REMOVE"; key: CollectionKey }
  | { type: "CHIP.TYPE"; text: string }                     // input-chips: key or paste on a chip
  | { type: "COMPOSITION.START" } | { type: "COMPOSITION.END"; text: string }
  | { type: "OUTSIDE_PRESS"; request: DismissRequest }
  | { type: "POSITION.PLACED"; first: boolean; side: Side; align: Align; anchorHidden: boolean }
  | { type: "ACTIVEDESCENDANT.FLUSH" }
  | { type: "OPEN" } | { type: "CLOSE" } | { type: "CLEAR" }
  | CollectionEvent // NAVIGATE (PageUp/Down, in-list Home/End are not used), HIGHLIGHT, POINTER_MOVE, COLLECTION.CHANGE
```

- **Why flat.** Zag's `closed.{idle,focused}` is a `focused` boolean in context (it
  changes no transition except open-on-focus); `open.{suggesting,interacting}` is the
  collections `highlightSource` (`typing` vs `keyboard` vs `pointer`), which already
  decides auto highlight, completion, scrolling and announcements. Two states keep the
  graph and the model paths small; "controlled open" doubling disappears into
  `controllable("open", { states: { open: true, closed: false } })`.
- **Context** (keys and scalars only, per collections §4): `focused`, `dirty` (text not
  committed), `committedText`, `openReason`, `openModality`, `composing`,
  `frozenResults` (the derived collection reference captured when closing — a pointer,
  not a copy), `activeDescendantKey` (lags the highlight for typing highlights),
  `chipHighlight`, `backspaceArmed`, `queryVersion`, plus `CollectionContext`.
- **Computed** (memoised in `view`): `results` = `frozenResults` while exiting, else
  `filter === null ? collection : collection.filter(matcher(query))`, where `query` is
  `""` when `openReason ∈ {trigger, arrow}` and `!dirty`; `exposed` = `open && results.size
  > 0 && !stale`; `stale` = `itemsQuery !== undefined && itemsQuery !== query`.
- **Guards**: `notComposing` (a11y-foundations), `hasHighlight`, `isDirty`, `allowCustom`,
  `closeOnSelect`, `isMultiple`, `isNone` (Autocomplete), `openOnFocusAllowed` (cause and
  read-only), `selectOnTab`, `openedByFocus`, `hasEmptyPart`, `readOnly`.
- **Effects (open)**: `overlay`, `trackPosition` (Combobox's own, not in `patternEffects`),
  `scrollToHighlighted` after
  `POSITION.PLACED { first }`; **(root)** `announceCount` (keyed, debounced 500 ms),
  `abortQuery` (on `INPUT.CHANGE` aborts the previous `AbortController` from
  `env.abort()`, a new one-function capability; closed state aborts the last).
- **Commit** (`commitText` action) implements the spec's ordered rules in one place and
  is the only writer of `value` besides `ITEM.CHOOSE`, `CLEAR`, `CHIP.REMOVE` and form
  reset — the single owner that the "text reverts" bug class lacked.
- **Typing highlight lag**: `HIGHLIGHT { source: "typing" }` sets `highlightedKey` and
  schedules `ACTIVEDESCENDANT.FLUSH` (500 ms, scheduler); keyboard/pointer highlights set
  `activeDescendantKey` at once. Enter reads `highlightedKey`.

*Alternatives:* Zag's nested states (needs a hierarchical runtime for one component —
machine-runtime keeps state keys `.`-free, so this stays open for Date Picker); React
Aria's effect-driven sync (the double-callback class); Headless UI's imperative
`input.value` writes (races with controlled React inputs).

### 2. Shared pattern module

`components/combobox/pattern/` exports `patternActions` (open/highlight rules, inline
completion, composition tracking, frozen results, typing-highlight lag, announcements),
`patternGuards`, `patternEffects` and `patternConnect` (input/listbox/option/empty/popup
props). `combobox.machine.ts` spreads them; Autocomplete uses the same machine with
`selectionMode: "none"`; Command, Tags Input and Mentions will spread them into their own
machines. This is the `combobox-pattern` capability; it is not a separate machine.
It is popup-optional (from add-command): `patternEffects` holds no `overlay` or
`trackPosition` (Combobox and Autocomplete add them), `patternConnect`'s input props take
`expanded` from the host's computed `exposed`, and the module exports the
`optionsNeverSelected` invariant (Autocomplete's, reused by Command).

### 3. Connect notes

- Input and Trigger declare the press option `labelActivation: "focus"` (add-label,
  add-a11y-foundations `press-interactions`): a label-forwarded click only focuses the
  Input and never opens the popup, even with `openOnInputPress` (radix#3679,
  headlessui#3787).
- Input: native `<input type="text">`; `value` from `inputValue`; `onChange` →
  `INPUT.CHANGE` with `nativeEvent.inputType` (from `beforeinput`, so composition commits
  count as typing); `compositionstart/end`; key handler maps through `core/dom/keyboard`
  and calls `preventDefault()` only for keys the machine acted on (returned from
  `send` as `handled`, the dismissable-layer rule).
- Inline completion: connect applies `setSelectionRange(query.length, text.length)` in a
  layout effect after the render that shows the completed text (DOM access via
  `core/dom/text-selection`), never during composition.
- Option `pointerdown` → `preventDefault()` (keeps focus); touch choice on `click`
  (press module); `aria-selected` always `"true"`/`"false"` except in `none` mode where it
  is always `"false"`.
- Listbox `hidden` while `!exposed`; Empty is a sibling of List in Popup.
- `aria-activedescendant` from `activeDescendantKey`, only when the item is registered as
  rendered.
- Chips: `inputChipsConnect({ scope: "combobox" })` from the shared `input-chips` module
  (`core/components/input-chips/`): roving composite (collections `roving`) over the
  selected keys, inside the Control; `aria-describedby` on the input → the summary node
  with the selected texts.

### 4. Announcements

`announceHighlighted` (collections) is called with `{ source }` and announces only for
`keyboard` sources; section entry adds the section's option count. Count, no-results and
loading announcements are root effects keyed `combobox-count:<rootId>`. Which messages
run on which platform is decided by quirk entries (Requests below), never by reading the
platform in the machine.

### 5. Form

`hidden-form-input` renders one hidden input per selected key (request below) with
`name`, `form`, `required`, `disabled`; `invalid` and `focus` on a hidden input →
`focusSafely(input)`; the hidden input's `autocomplete` mirrors `formAutoComplete`, and
an autofill `input` event on it sends `AUTOFILL { text }`, matched by key then text.

### 6. React parts

`Combobox.Root`, `Label`, `Control`, `Input`, `Trigger`, `ClearTrigger`, `Positioner`,
`Popup`, `List`, `Item`, `ItemText`, `ItemIndicator`, `Group`, `GroupLabel`, `Separator`,
`Empty`, `Chips`, `Chip`, `ChipRemove`; `render` on each; items from data
(`collection` prop) or static `Item` parts (collections registration). Presence on
Popup; lazy mount, `keepMounted`. Empty registers so `hasEmptyPart` is known.

### 7. Contract

```ts
export const comboboxContract = contract(comboboxMachine, {
  scope: "combobox",
  locate: { role: "combobox", name: true, part: "input" },
  ...collectionContract({ itemRole: "option", strategy: "active-descendant", select: "enter" }),
  ...comboboxPatternContract,          // type, compose, open, close, pressEnter, pressEscape, tabOut, clearText; queries; announcements
  ...positioningQueries,
  traits: ["composite-activedescendant", "selectable", "set-metadata", "layer", "presence", "anchored", "form-associated"],
  announcements: { focusAnnouncement, countAnnouncement, selectionAnnouncement },
  actions: { choose, clear, removeChip, blur },
  queries: { value, chips },
  events: {
    "INPUT.CHANGE": "type", ARROW: "open", "TRIGGER.PRESS": "open", ENTER: "pressEnter", ESCAPE: "pressEscape",
    TAB: "tabOut", "ITEM.CHOOSE": "choose", "CLEAR.PRESS": "clear", "CHIP.REMOVE": "removeChip",
    "INPUT.BLUR": "blur", "COMPOSITION.START": "compose", "COMPOSITION.END": "compose",
    "INPUT.FOCUS": { skip: "virtual focus step covers it" }, "INPUT.PRESS": { skip: "openOnInputPress props class" },
    CARET: { skip: "unit test" }, BACKSPACE_EMPTY: "removeChip", "CHIP.NAVIGATE": { skip: "driver test" },
    "CHIP.TYPE": { skip: "driver test" },
    OUTSIDE_PRESS: { skip: "overlay trait" }, "POSITION.PLACED": { skip: "positioning" },
    "ACTIVEDESCENDANT.FLUSH": { skip: "fake clock unit test" }, AUTOFILL: { skip: "browser test" },
    OPEN: { skip: "programmatic" }, CLOSE: { skip: "programmatic" }, CLEAR: { skip: "programmatic" },
    "$sync:open": { props: (open) => ({ open }) }, "$sync:value": { props: (value) => ({ value }) },
    "$sync:inputValue": { props: (inputValue) => ({ inputValue }) },
  },
})
```

Props classes for `testMachine`: single, multiple, `allowCustomValue`, `autoHighlight`,
`autoComplete: "both"`, `openOnFocus`, `filter: null` + `itemsQuery`, empty results with
and without the Empty part, read-only, virtualized.

### 8. Theme

`packages/theme/src/combobox.css`, tier-3 tokens only (decision 0007): `--rind-combobox-control-height`,
`-control-bg`, `-control-border`, `-control-radius`, `-control-padding`, `-popup-bg`,
`-popup-border`, `-popup-radius`, `-popup-shadow`, `-popup-max-height`
(`min(var(--rind-combobox-popup-max-height), var(--rind-available-height))`),
`-item-height`, `-item-padding`, `-item-highlight-bg`, `-item-highlight-text`,
`-item-disabled-text`, `-indicator-size`, `-group-label-text`, `-empty-text`, `-chip-bg`,
`-chip-radius`, `-chip-gap`; `data-variant` / `data-size` rules on Control, Popup, Item,
Chip.

### Resolved open questions

| Question | Decision | Why |
|---|---|---|
| Hierarchical states (machine-runtime Q1) | Not needed for Combobox | §1 |
| Combobox vs Autocomplete | One machine, `selectionMode: "none"` preset; pattern capability shared | Base UI source; identical AT behaviour |
| Filtering owner | Built-in `contains`, `filter: null` for consumer/async | Static lists work out of the box (RA, BU, Reka, KB); async needs opt-out |
| Portal by default | No: in place, `strategy: fixed` | Touch-SR swipe order (the reason BU#5528 / RA hide the outside) without hiding anything (ARK#3699, RK#2240); ZG#2936 turned out to be cause B, not the portal |
| Tab selects | No (`selectOnTab` opt-in, never after focus open) | HUI activation-trigger lesson; APG lists no Tab acceptance |
| Escape while closed | Revert if dirty, else unhandled | Kobalte's clear is destructive; dialogs must close |

## Requests to other changes

Status (coordinator, 2026-10-14): add-collections and add-checkbox requests APPLIED
there (add-collections A.2, add-checkbox A.2; autofill forwarding was already covered by
add-checkbox A.1). add-a11y-foundations requests are recorded in
`docs/review-pending.md` and applied at that change's next round boundary (it is being
implemented).

1. **`add-a11y-foundations`** (`a11y-quirks`, `announcer` "Highlight Announcements On
   Apple Platforms", `a11y-invariants` "Announcement Parity", `platform-and-preferences`):
   - Add the rendering engine (`webkit | blink | gecko`) to the injected platform, and
     narrow `vo-activedescendant` (per-item highlight announcements) to Apple **and
     WebKit** — VoiceOver in Chrome now speaks activedescendant changes natively and the
     live text interrupts it (adobe/react-spectrum#10220, fixed by PR #10503,
     2026-10-12), while Safari is still silent (adobe/react-spectrum#10326, open).
   - Add `vo-section-entry` (all Apple platforms) for section-entry and selection
     announcements, which VO never speaks.
   - Take the **result count** out of the Apple gate: it is a WCAG 4.1.3 status message;
     announcement parity should expect `countAnnouncement` on every platform.
2. **`add-collections`** (`collection-navigation` "Announcements For Active Descendant On
   Apple Platforms", "Highlight Is A Key"; `collection-model` "Virtualization Contract"):
   - Add the highlight source `typing`, and announce only `keyboard`-source highlights.
   - Section-entry announcement includes the section's option count; per-item
     announcements follow the narrowed quirk of request 1.
   - Emit `aria-posinset` / `aria-setsize` when the component declares its rendered
     items a filtered view, not only when virtualized.
3. **`add-checkbox`** (`hidden-form-input`): allow a control with several values to render
   one hidden input per value (same `name`), keep one validity proxy for `required` when
   the list is empty, and forward a browser autofill of the hidden input to the machine.

### Input chips and popup-optional pattern (amendments from add-tag-group, add-tags-input, add-command)

The chip pieces are the shared capability `input-chips` (spec `input-chips`), extracted
unchanged from "Multiple Selection With Chips" and used by Combobox and Tags Input: connect
helpers with a `scope` parameter, actions/guards, the events `CHIP.NAVIGATE`,
`CHIP.REMOVE`, `CHIP.TYPE`, `BACKSPACE_EMPTY`, the `removeChip` / `chips` contract
fragment, per-chip `disabled`, disarm on any caret move or press, and the messages
`chipsLabel`, `removeLabel(text)`, `tagsSummary(texts)`, `removedAnnouncement(text)` —
`removeLabel` / `removedAnnouncement` with Tag Group's keys and defaults. Chips stay a
`toolbar` and are not composed from Tag Group. `combobox-pattern` gains "Usable Without A
Popup" (tasks A.4, A.5).

### Field binding (amendment from add-field)

The Root reads add-field's `field-control` binding and registers the Input once. Field
ARIA goes on the Input only, never a popup input (base-ui#4120); flags are OR-merged with
the Field and an enclosing Fieldset; closing the popup reports a commit (spec "Field
Control Binding", task A.3).

## Risks / Trade-offs

- [In-place popup can be clipped by `overflow: hidden` ancestors with transforms] →
  `strategy: fixed` escapes most; a `transform`ed ancestor still clips: documented, with
  the Portal as the escape hatch (and the swipe-order cost stated).
- [Typing-highlight lag (500 ms) delays `aria-activedescendant`] → Enter acts on the
  visible highlight immediately; NVDA/JAWS read the option after the pause instead of
  cutting the typed character.
- [Requests 1–2 change foundation specs] → until accepted, the combobox implements the
  current foundations rule (Apple-gated) behind the same quirk ids, so only quirk
  conditions change later.
- [Exact-text commit could select an option the user did not intend when two options share
  a text] → only when exactly one option matches.
- [`readOnly` popup browsing differs from native `readonly` inputs] → matches Base UI;
  documented.

## Migration Plan

New API. Reado has no combobox; its `CompletingTextarea` moves to Mentions later, which
reuses `combobox-pattern`. Ark users: `inputBehavior: "autohighlight"` →
`autoHighlight`, `"autocomplete"` → `autoComplete: "both"`; `selectionBehavior` →
`clearInputOnSelect` / commit rules; `allowCustomValue` unchanged; `onValueChange({ value })`
→ `(value, details)`.
