## Context

See proposal.md for motivation and specs/tags-input/spec.md for behaviour. Research, the
library comparison and the Bug history the scenarios cite:
[tags-input.md](../../../docs/research/tags-input.md). This change consumes, without
restating:

| From | Used for |
|---|---|
| `add-foundations` | `setup()`/`machine()`, `controllable()` (`value`, `inputValue`), `$sync` / `$reverted`, `onProps`, effects, contracts (`{ skip }`, prop steps), drivers, `testMachine`, React adapter (ids, per-part selectors, `render`) |
| `add-a11y-foundations` | `core/dom/keyboard` (logical keys, RTL, IME guard `notComposing`, Safari commit-Enter quirk), modality, `focusSafely`, press (chips, ChipRemove, ClearTrigger, double press), announcer, `messages` + `Intl.PluralRules`, `hidden-content` (summary node), invariants (IME never commits, announcement parity, focus alone does not commit) |
| `add-collections` | `CollectionKey`, `createListCollection` for the tags (chips are a roving collection), `collection-navigation` `roving`, removal repair; and, for suggestions, the model, `createFilter`, async status |
| `add-combobox` | `combobox-pattern` (suggestions: actions, guards, effects, connect helpers, contract fragment) and the chip pieces, as the shared capability `input-chips` (request 1, applied) (toolbar, roving chips, ChipRemove, Backspace arm/remove, ArrowLeft into chips, removal focus, summary node, `removedAnnouncement`, chips count as inside) |
| `add-checkbox` | `hidden-form-input`: list value carriers + validity proxy for `required` (its A.1/A.2 amendments), reset, invalid-focus, re-sync |
| `add-button` | `button-like-element` for ChipRemove and ClearTrigger |
| `add-field` | `field-control` registration (validity element = constraint input), merged states, `field-validation` |
| `add-theme-system` | tier-3 tokens, variant/size matrix, `data-tone` |
| `add-overlay-infrastructure`, `add-floating-positioning` | only through `combobox-pattern` when a `collection` is given |

## Goals / Non-Goals

**Goals:**
- One machine owns every change of `value` (typed, delimiter, paste, blur, suggestion,
  edit, chip removal, clear, reset) — the double-commit class (ZG#1661, ARK#2742, RK#2259)
  cannot happen because there is no second component to compose.
- Zero chip behaviour of its own: everything chip-shaped is `input-chips`; this change only
  adds per-tag `disabled`, editing, and disarm-on-caret-move.
- Every scenario citing an issue has a test that reproduces it first.

**Non-Goals:**
- `contenteditable` inline tokens, undo/redo, object values (proposal Non-goals).

## Decisions

### 1. Machine: flat `idle | typing | editing | suggesting`

```
            INPUT.FOCUS / CHIP.FOCUS / CONTROL.PRESS
   idle ───────────────────────────────────────────► typing ◄──────────────┐
    ▲   ◄── FOCUS.LEAVE (blurBehavior: add|clear|keep)                       │
    │                                                   │ TAG.EDIT [editable]│ EDIT.COMMIT /
    │                                                   ▼                    │ EDIT.CANCEL /
    └──────── FOCUS.LEAVE (EDIT.BLUR outside: commit) ─ editing ─────────────┘ EDIT.BLUR(inside)
   typing ⇄ suggesting: the combobox-pattern open/close events (only with a collection)
   typing/suggesting: INPUT.CHANGE (delimiter split) · PASTE · ENTER · BACKSPACE_EMPTY ·
                      ESCAPE · CARET · COMPOSITION.START/END · CHIP.* (input-chips) · CLEAR.PRESS
   root:              $sync:value · $sync:inputValue · COLLECTION.CHANGE · FORM.RESET · ADD · CLEAR
```

```ts
type TagsInputEvent =
  | { type: "INPUT.CHANGE"; text: string; inputType: string; composing: boolean; caretAtEnd: boolean }
  | { type: "PASTE"; text: string; composing: boolean }      // returns handled=false → browser inserts
  | { type: "ENTER" | "ESCAPE" | "TAB"; composing: boolean }
  | { type: "BACKSPACE_EMPTY"; composing: boolean } | { type: "CARET" }   // any caret move / input press disarms
  | { type: "INPUT.FOCUS"; modality: Modality } | { type: "CONTROL.PRESS" }
  | { type: "FOCUS.LEAVE" }                                   // focusout with related target outside the component
  | { type: "TAG.EDIT"; key: CollectionKey }                  // Enter on a chip or double press
  | { type: "EDIT.CHANGE"; text: string; composing: boolean }
  | { type: "EDIT.COMMIT" | "EDIT.CANCEL"; composing: boolean } | { type: "EDIT.BLUR"; related: "inside" | "outside" }
  | { type: "CLEAR.PRESS" } | { type: "ADD"; text: string } | { type: "CLEAR" } | { type: "FORM.RESET" }
  | { type: "COMPOSITION.START" } | { type: "COMPOSITION.END"; text: string }
  | InputChipsEvent                                           // CHIP.NAVIGATE, CHIP.REMOVE, CHIP.FOCUS, CHIP.TYPE
  | ComboboxPatternEvent                                      // only reachable when a collection is given
```

- **Why flat and why `editing` is a state.** While editing, Enter/Escape/blur mean commit/
  cancel and the main input's keys are unreachable; every transition differs, so it earns a
  state (Zag has it too). Chip focus is not a state: `input-chips` keeps it in context
  (`chipFocusKey`, `armedKey`), as in Combobox, so `typing` covers both input and chips —
  this is also why Tab-out/click-away (ARK#3602, RK#1914) has one exit, `FOCUS.LEAVE`,
  which clears both.
- **`suggesting`** exists only to host the `combobox-pattern` open-state effects (overlay,
  position, scroll); with no collection the guard `hasCollection` keeps the machine out of
  it, so model paths stay small for the common case.
- **Context** (keys and scalars only): `draftRefusal` (`{ reason, text } | null`),
  `editingKey`, `editText`, `composing`, `lastChangeReason`, the `input-chips` context,
  the pattern context (with a collection). Tags themselves are the `value` controllable;
  the chips collection is derived in `view` from `value` (keys per §2).
- **Guards**: `notComposing` on every transition that creates, splits, arms, removes,
  navigates or commits an edit; `draftNotEmpty` (after `normalize`), `hasCollection`,
  `hasHighlight` (pattern), `editable`, `interactive` (not disabled/read-only),
  `addOnPaste`, `pasteHasDelimiter`.
- **The one creation action** `createTags(texts, reason)`: normalise → drop empty → max →
  duplicate (`compare`, `allowDuplicates`; within the batch too) → `validate` → one
  `value` proposal with all accepted texts, `draftRefusal` for the first refused, refused
  texts returned to the draft (paste) or kept (Enter/blur), announcements. Enter,
  delimiter, paste, blur `add`, suggestion choose and `ADD` all call it, so the rules cannot
  drift between entry paths (Zag validates paste differently from Enter).
- **Delimiter split** (`INPUT.CHANGE` with `!composing && caretAtEnd`): `splitDelimited(text,
  delimiters)` → `{ complete: string[], rest: string }`; strings matched with `indexOf`,
  RegExps with a cloned non-global `exec` (AK#6333: never `new RegExp(string)`); a
  zero-length match is ignored. `COMPOSITION.END` re-runs the split once on the committed
  text.
- **Paste** (`PASTE`): when `addOnPaste && pasteHasDelimiter`, connect calls
  `preventDefault()` (the machine returns `handled`), else the browser inserts the text and
  the following `INPUT.CHANGE` is ordinary typing — no `preventDefault` on plain pastes
  (ZG#1665).
- **Enter** returns `handled` (connect then `preventDefault()`s in the same keydown) only
  when composing is false and the draft is non-empty or a suggestion is highlighted; an
  empty Enter is unhandled so implicit submission happens (RK#2963).
- **Editing focus**: `TAG.EDIT` comes from the press/keydown handler; connect focuses the
  ChipInput **in that handler** through `focusSafely({ sync: true })` after the machine's
  synchronous transition, not in an effect or `raf` (ARK#1396). The ChipInput is rendered
  on entering `editing`; React commits it synchronously inside the event via `flushSync`
  in the part (adapter detail, the only `flushSync` in the component; documented).
- **Effects (root)**: none beyond the pattern's when suggesting and `hidden-form-input`'s
  sync; announcements are actions.

*Alternatives:* a `combobox` preset with `multiple + allowCustomValue` (Base UI's answer,
BU#3390) — no popup-less mode, no delimiters/paste/edit states, and option-selection
semantics (`aria-selected`, revert on blur) that free tags do not have; Zag's
`navigating:tag` state with virtual highlight (rejected: add-combobox chose real roving
focus in a toolbar for NVDA, and chips must behave the same in both components).

### 2. Tag keys

`keyOf(value, i)` = `toKey(value)` when `!allowDuplicates`; otherwise
`toKey(value + "\u0000" + n)` where `n` is the occurrence number of that value up to index
`i`. Deterministic (SSR-stable, valid in ids after the adapter's id escaping), unique, and
removal of one duplicate never retargets another chip's key except later equal values
(their ordinal shifts, which is the expected "the next one becomes the n-th"). Removal,
edit and focus repair go through keys (RK#2785).

### 3. Connect notes

- Input: native `<input type="text">`; `value` from `inputValue`; `onChange` →
  `INPUT.CHANGE` with `inputType` (from `beforeinput`) and `caretAtEnd`
  (`selectionStart === selectionEnd === value.length`, read through `core/dom/text-selection`);
  `onPaste` → `PASTE` with `clipboardData.getData("text")`; `onSelect` / pointerdown →
  `CARET`; key handler maps through `core/dom/keyboard` and calls `preventDefault()` only
  for handled keys. With a collection, `patternConnect.input` adds the combobox attributes.
- No `enterkeyhint` by default (Zag's `"done"` closes some Android keyboards, ZG#293);
  consumers may set it.
- Control: `onPointerDown` on its own box (not on a `display: contents` child, AK#7155)
  → `CONTROL.PRESS` → focus Input (BU#4289).
- Chips/Chip/ChipRemove: `inputChipsConnect` (`input-chips`) with `data-scope=
  "tags-input"`; Chip adds `onDoubleClick`/double press and Enter → `TAG.EDIT`,
  printable/⌘V → `CHIP.TYPE` (focus input, text inserted there, Ariakit behaviour).
- ChipInput: native text input inside the Chip, `aria-label` from `editLabel(tag)`, IME
  guard, `EDIT.*` events; ChipText hidden (`hidden`) while editing.
- Form: `hidden-form-input` with `values: value`, `name`, `form`, `required`, `disabled`;
  `FORM.RESET` from its reset hook.

### 4. Announcements

All polite, via the announcer, one per user action; `createTags` emits
`addedAnnouncement` or `addedManyAnnouncement`, `refusedAnnouncement` for a refusal (one
per action, the first reason); chips' `removedAnnouncement` is reused unchanged. With a
collection the pattern's count/highlight announcements apply as specified there (Apple
quirk gating included).

### 5. React parts

`TagsInput.Root`, `Label`, `Control`, `Chips`, `Chip`, `ChipText`, `ChipRemove`,
`ChipInput`, `Input`, `ClearTrigger`, and for suggestions `Positioner`, `Popup`, `List`,
`Item`, `ItemText`, `Group`, `GroupLabel`, `Separator`, `Empty` (the pattern's parts with
`data-scope="tags-input"`). Chips render from `value` (`children(tag, state)` render prop
or `Chip` parts with `value`). `render` on each part.

### 6. Contract

```ts
export const tagsInputContract = contract(tagsInputMachine, {
  scope: "tags-input",
  locate: { role: ["textbox", "combobox"], name: true, part: "input" },
  ...inputChipsContract,                     // removeTag(name) = chips' removeChip, chips(), focusChip
  ...optional(comboboxPatternContract),      // when the fixture passes a collection
  traits: ["form-associated", "field-associated", "composite-roving"],
  announcements: { addedAnnouncement, addedManyAnnouncement, removedAnnouncement, refusedAnnouncement },
  actions: { type, addTag, paste, editTag, clear, compose },
  queries: { tags, inputValue, isAtMax, refusal },
  events: {
    "INPUT.CHANGE": "type", PASTE: "paste", ENTER: "addTag", "TAG.EDIT": "editTag",
    "EDIT.COMMIT": "editTag", "EDIT.CANCEL": { skip: "unit test: Escape scenario" },
    "EDIT.CHANGE": "editTag", "EDIT.BLUR": { skip: "covered by FOCUS.LEAVE paths" },
    "CLEAR.PRESS": "clear", BACKSPACE_EMPTY: "removeTag", "COMPOSITION.START": "compose",
    "COMPOSITION.END": "compose", ESCAPE: { skip: "pattern pressEscape" }, TAB: { skip: "focus leave" },
    CARET: { skip: "unit test" }, "INPUT.FOCUS": { skip: "virtual focus step covers it" },
    "CONTROL.PRESS": { skip: "browser test" }, "FOCUS.LEAVE": { skip: "blur props class" },
    ADD: { skip: "programmatic" }, CLEAR: { skip: "programmatic" }, "FORM.RESET": { skip: "form test" },
    "$sync:value": { props: (value) => ({ value }) }, "$sync:inputValue": { props: (inputValue) => ({ inputValue }) },
  },
})
```

`addTag` has a keyboard implementation only, with the declared reason "creation has no
pointer gesture"; `clear` keyboard implementation removes chips one by one (ClearTrigger is
`tabindex=-1`, rule 14 twin). `paste` needs the environment's new `paste(text)` input
(request 2, applied as the `test-drivers` delta in this change). Props classes for `testMachine`: default; `allowDuplicates`; `max: 2`;
`validate` refusing; `blurBehavior` add / clear; `addOnPaste: false`; `editable: false`;
`readOnly`; with a static collection; with `filter: null` + async; a regex delimiter list.

### 7. Theme

`packages/theme/src/tags-input.css`, tier-3 only: `--rind-tags-input-control-height`,
`-control-bg`, `-control-border`, `-control-radius`, `-control-padding`, `-gap`,
`-input-min-width`, `-chip-bg`, `-chip-border`, `-chip-radius`, `-chip-padding`,
`-chip-highlight-outline`, `-chip-remove-size`, `-refused-text`; defaults fall back to the
`--rind-combobox-*` chip/control tokens, then semantic tokens. Input `field-sizing:
content` with `min-inline-size: var(--rind-tags-input-input-min-width)` and `flex: 1`
(the fallback where `field-sizing` is unsupported).

### Resolved open questions

| Question | Decision | Why |
|---|---|---|
| Own machine or Combobox preset | Own machine spreading shared pieces | §1 alternatives |
| Who owns chips | `add-combobox` (`input-chips`) | First change that needs them; coordinator decision |
| Real focus or virtual highlight on chips | Real (roving) | Same as Combobox chips; NVDA toolbar |
| Live listbox (Ariakit) or Announcer | Announcer | AK#7164: removals never spoken |
| Paste default | On, only when the paste contains a delimiter | Ariakit/RK#1400 value; ZG#1665 undo |
| Default delimiters | `","` (no whitespace) | Multi-word tags; AK#6294 risk |
| Remove button exposure | Named button, `tabindex=-1`, never `aria-hidden` | Touch SRs (AK#6330) |
| Draft on blur | `keep` default | No silent data creation; `add` opt-in |

## Requests to other changes

1. **`add-combobox`**: lift the `combobox` requirement "Multiple Selection With Chips"
   (toolbar container labelled `chipsLabel`, roving chips named by their text, ChipRemove
   `tabindex=-1` named `removeLabel(item)`, Backspace arm-then-remove with
   `removeOnBackspace`, ArrowLeft at the caret start into the chips, Left/Right between
   chips and back to the input, Backspace/Delete removal with next/previous/input focus,
   the summary node referenced by the input's `aria-describedby`, `removedAnnouncement` on
   every platform, chips counting as inside for the popup) together with its connect
   helpers, the `CHIP.NAVIGATE` / `CHIP.REMOVE` / `BACKSPACE_EMPTY` events and the
   `removeChip` / `chips` contract pieces, into a separately named shared capability
   **`input-chips`**, unchanged in behaviour, which Combobox and Tags Input both use.
   Additionally (small, generic): a per-chip `disabled` flag skipped by navigation and
   arming; disarm on any caret move or press in the input; a `CHIP.TYPE` event (printable
   key or paste on a chip moves focus to the input with the text); a scope parameter for
   `data-scope`; messages `chipsLabel`, `removeLabel`, `tagsSummary`, `removedAnnouncement`
   owned there. APPLIED (coordinator, 2026-10-14): add-combobox `specs/input-chips/spec.md`, task A.4.
2. **`add-foundations` / test drivers** (environment interface, via the coordinator): a
   `paste(text)` input on the focused element (dispatches `paste` with `clipboardData`,
   then, when not cancelled, `beforeinput`/`input` with `insertFromPaste`), in both
   adapters; `@rind-ui/testing/setup` polyfills `ClipboardEvent`/`DataTransfer` in jsdom. APPLIED (coordinator, 2026-10-14)
   as a delta in this change: `specs/test-drivers/spec.md` (ADDED "Paste Input"), task A.1.
3. **`add-checkbox`** (`hidden-form-input`): none new — list carriers and the validity proxy
   (A.1, A.2) are used as amended; Tags Input is listed as a consumer.

## Risks / Trade-offs

- [`input-chips` extraction lands with add-combobox A.4] → Tags Input imports the chip
  helpers from `core/components/input-chips/`; if A.4 is not yet implemented, from
  `components/combobox/pattern/` under the same names, so only an import path changes.
- [`flushSync` to focus the ChipInput inside the gesture] → limited to one part; the
  alternative (keeping a hidden ChipInput per chip) doubles the inputs; revisit if a second
  adapter cannot commit synchronously.
- [Duplicate keys shift ordinals on removal] → only between equal values, where the user
  cannot tell them apart; focus repair targets the chip at the removed position.
- [iOS predictive text keeps the previous word after a programmatic clear (RK#1869)] →
  documented, manual iOS check; not fixable in the spec.
- [Hiding already-chosen suggestions changes counts while open] → the pattern's keyed count
  announcement coalesces.

## Migration Plan

New API. Ark: `blurBehavior`, `addOnPaste`, `allowDuplicates`, `max`, `editable`,
`delimiter` unchanged; `validate({ inputValue, value })` → `validate(text, value)` returning
`true | reason`; `sanitizeValue` → `normalize`; `onValueInvalid` → `onRefuse`;
`allowOverflow` dropped. Reka: `addOnBlur` → `blurBehavior: "add"`, `duplicate` →
`allowDuplicates`, Combobox composition → `collection` prop. Reado has no tags input.
