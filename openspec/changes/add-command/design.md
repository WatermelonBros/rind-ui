## Context

See proposal.md for motivation and specs/command/spec.md for behaviour. Research, library
comparison and the Bug history the scenarios cite: [command.md](../../../docs/research/command.md).
This change consumes, without restating:

| From | Used for |
|---|---|
| `add-combobox` | `combobox-pattern`: `patternActions` / `patternGuards` / `patternConnect` (input, listbox, option, empty props), typing-highlight lag (`ACTIVEDESCENDANT.FLUSH`), composition tracking, `announceCount` and `abortQuery` root effects, pattern messages, `comboboxPatternContract` |
| `add-listbox` | reusable listbox parts (`list`, `item`, `item-text`, `item-description`, `section`, `section-label`, `separator`, `empty`) and their attributes, under `data-scope="command"` |
| `add-collections` | `Collection`, static item registration, `createFilter(locale)`, `collection-navigation` with `active-descendant` (moves incl. pages, loop, repair by key, pointer guard, `scrollToHighlighted`), async status, virtualization contract, collection contract fragment, `set-metadata` trait |
| `add-a11y-foundations` | `core/dom/keyboard` (logical keys, `notComposing`, Safari commit-Enter quirk), press (items, virtual modality), modality, announcer (keys, polite), quirks (`vo-activedescendant`), `messages`, invariants (IME never commits, announcement parity) |
| `add-dialog` | the container: initial focus rule (first tabbable, content on touch), Title naming, Escape closing the topmost layer |
| `add-separator` | `separatorProps({ context: "listbox", scope: "command" })` |
| `add-theme-system` | stylesheet convention, tier-3 tokens, variants, tone |
| `add-foundations` | runtime, `controllable` (`inputValue`), `bindProp` (`page`), contracts (`{ skip }`, prop steps), drivers, `testMachine`, React adapter |

## Goals / Non-Goals

**Goals:**
- No re-specification of the input + listbox behaviour: Command spreads `combobox-pattern`
  and narrows only what a missing popup changes (spec "Built On The Combobox Pattern Without
  A Popup").
- Every item, highlight and result is a key or a derivation in the machine; nothing is read
  back from the DOM and nothing in the DOM is reordered (the cmdk bug class).

**Non-Goals:**
- A ranking engine, a dialog part, global shortcuts, grid navigation.

## Decisions

### 1. Machine: one state, pattern spread in

```
active ── INPUT.CHANGE · NAVIGATE(next|previous|page-next|page-previous) · ENTER · ESCAPE ·
          BACKSPACE_EMPTY · ITEM.CHOOSE · HIGHLIGHT · POINTER_MOVE · COMPOSITION.START/END ·
          COLLECTION.CHANGE · ACTIVEDESCENDANT.FLUSH · PAGE.CHANGE · $sync:inputValue
```

```ts
type CommandEvent =
  | { type: "INPUT.CHANGE"; text: string; inputType: string; composing: boolean }
  | { type: "ENTER" | "ESCAPE"; composing: boolean; modifiers: Modifiers }
  | { type: "BACKSPACE_EMPTY"; composing: boolean } // connect sends it only at caret 0, no selection, empty query
  | { type: "ITEM.CHOOSE"; key: CollectionKey; modality: Modality; modifiers: Modifiers }
  | { type: "PAGE.CHANGE" }                          // onProps: page.key changed (Object.is on the key)
  | { type: "COMPOSITION.START" } | { type: "COMPOSITION.END"; text: string }
  | { type: "ACTIVEDESCENDANT.FLUSH" }
  | CollectionEvent // NAVIGATE (keyboard source), HIGHLIGHT, POINTER_MOVE, COLLECTION.CHANGE
```

- **Why its own machine, not `combobox.machine` with a flag.** Combobox's graph is
  `closed | open` with commit, selection, chips and overlay effects; Command has none of
  them and adds actions and pages. A `selectionMode`-style preset (Autocomplete's approach)
  would leave a `closed` state unreachable but present in the model graph, and the commit
  rules would need a fourth mode. One state keeps the graph honest; the shared behaviour is
  still one implementation because both spread `combobox-pattern` (design §2 of add-combobox).
- **Context**: `composing`, `queryVersion`, `activeDescendantKey`, `pageKey` (last seen, for
  `PAGE.CHANGE`), plus `CollectionContext`. No `dirty`, `committedText`, `frozenResults`,
  `openReason`, `chipHighlight`.
- **Computed** (`view`): `results` = `filter === null ? collection : collection.filter(matcher(query))`
  (no sort); `exposed` = `results.size > 0 && !stale`; `stale` as in the pattern.
- **Guards**: `notComposing`, `hasHighlight`, `hasQuery`, `clearOnEscape`, `hasOnBack`,
  `autoHighlight`, `isDisabledKey`.
- **Actions**: pattern `setQuery` + `highlightFirst` (source `typing`, schedules
  `ACTIVEDESCENDANT.FLUSH`, 500 ms), `runItem` (calls item then root `onAction`; link items:
  connect performs the native activation, see §3), `clearQuery`, `callOnBack`, `onPageChange`
  (`clearQuery` reason `page`, `scrollToTop`, `highlightFirst`, `announcePage`), and
  `repairCollection` from collections (by key; append never resets; empty → highlight cleared;
  options return while nothing highlighted for the current query → `highlightFirst`).
- **Mount**: the initial `highlightFirst` runs in the machine's entry with source `typing` and
  no `scrollToHighlighted` (spec: mount scrolls nothing); `announceCount` is keyed and fires
  only on `INPUT.CHANGE` / `COLLECTION.CHANGE` after mount.
- **Effects (root)**: pattern `announceCount` (keyed `command-count:<rootId>`, debounced
  500 ms) and `abortQuery` (aborted on a newer change and on stop).

*Alternatives:* reuse the combobox machine with `popup: false` (rejected above); cmdk's store
with DOM-registered items and `querySelector` lookups (the stale-activedescendant and
portal bugs).

### 2. Filtering and order

`filter` is `"contains"` (default) | a matcher `(node, query) => boolean` | `null`. The
default matcher is `createFilter(locale).contains` over `textValue` **or any keyword**
(request 2). There is no score, so the derived collection keeps the source order; ranked
palettes render a ranked collection with `filter: null` (Ariakit's match-sorter example).
Sections left empty are dropped by the collection derivation.

*Alternative:* cmdk/Bits `filter → number` with sort by score and groups sorted by their best
item — the DOM-reordering bug class, and a moving list is hard to follow for screen-reader
and low-vision users. Re-open only when a second component needs ranked derivations
(research Open questions).

### 3. Connect

- Input: native `<input type="text">`, pattern input props (`role="combobox"`,
  `aria-autocomplete="list"`, `aria-controls`, `aria-activedescendant` from
  `activeDescendantKey`, `autocomplete="off"` etc.), `aria-expanded` = `exposed`,
  `aria-describedby` → Description when rendered, `enterKeyHint="go"`. The key handler acts
  only when `event.target` is the input (cmdk#353), maps through `core/dom/keyboard`, and calls
  `preventDefault()` only for keys the machine handled (`send` returns `handled`). Backspace is
  sent as `BACKSPACE_EMPTY` only when `selectionStart === selectionEnd === 0` and the value is
  empty (caret read through `core/dom/text-selection`).
- Link items: on Enter with a link item highlighted, connect calls the item element's
  `click()` through `core/dom` with the Enter keydown's modifiers copied onto a single
  synthetic `MouseEvent` — one activation, never a second re-dispatch (RA#9431, RA#8992);
  pointer presses on links are native.
- Options: `aria-selected="false"`; listbox parts give `data-highlighted`,
  `data-focus-visible`, `data-disabled`, ids from keys, set metadata.
- Empty and Loading: siblings of the List inside Root. Root `data-empty`, `data-loading`,
  `data-page`.
- Scrolling: `scrollToHighlighted` uses the nearest scroller of the List (never
  `scrollIntoView` on the window path); `scrollToTop` sets the List scroller's `scrollTop = 0`
  in the layout effect that commits the new results (cmdk#389).

### 4. Dialog composition (no part)

```tsx
<Dialog.Root open={open} onOpenChange={setOpen}>
  <Dialog.Backdrop />
  <Dialog.Content>
    <Dialog.Title render={<VisuallyHidden />}>Command palette</Dialog.Title>
    <Command.Root onAction={(key) => { run(key); setOpen(false) }}>
      <Command.Label render={<VisuallyHidden />}>Search commands</Command.Label>
      <Command.Input placeholder="Type a command…" />
      <Command.List>…</Command.List>
      <Command.Empty>No results</Command.Empty>
      <Command.Description>Enter to run · Esc to close</Command.Description>
    </Command.Root>
  </Dialog.Content>
</Dialog.Root>
```

The input is the first tabbable element, so add-dialog's initial focus lands on it (content on
touch). Escape with a query clears it and is prevented; the next Escape is unhandled by the
input and reaches the dialog's dismissable layer. Resetting the query on reopen is natural:
the content unmounts on close (lazy mount); with `keepMounted`, the docs show resetting
`inputValue` on open, not on close (avoids the closing flash, shadcn#1351). A `Command.Dialog`
part would only rename these five lines and hide the Title choice (cmdk#393), so it is a
story and a docs recipe instead.

### 5. Contract

```ts
export const commandContract = contract(commandMachine, {
  scope: "command",
  locate: { role: "combobox", name: true, part: "input" },
  ...collectionContract({ itemRole: "option", strategy: "active-descendant", select: "enter" }),
  ...omit(comboboxPatternContract, ["open", "close"]),
  traits: ["composite-activedescendant", "set-metadata"],
  announcements: { focusAnnouncement, countAnnouncement },
  invariants: [optionsNeverSelected],
  actions: { run, back },
  queries: { items, highlighted, page },
  events: {
    "INPUT.CHANGE": "type", ENTER: "pressEnter", ESCAPE: "pressEscape", "ITEM.CHOOSE": "run",
    BACKSPACE_EMPTY: "back", "COMPOSITION.START": "compose", "COMPOSITION.END": "compose",
    "PAGE.CHANGE": { skip: "covered by the page prop step" },
    "ACTIVEDESCENDANT.FLUSH": { skip: "fake clock unit test" },
    "$sync:inputValue": { props: (inputValue) => ({ inputValue }) },
    "$props:page": { props: (page) => ({ page }) },
  },
})
```

`open` / `close` from the pattern fragment are declared `{ skip: "no popup" }` by `omit`.
`optionsNeverSelected` is the same per-component invariant Autocomplete declares (shared
from the pattern module, not duplicated).

### 6. Theme

`packages/theme/src/command.css`: `--rind-command-bg`, `-border`, `-radius`, `-shadow`,
`-input-height`, `-input-padding`, `-input-border`, `-list-max-height`, `-item-height`,
`-item-padding`, `-item-radius`, `-item-highlight-bg`, `-item-highlight-text`,
`-item-highlight-outline`, `-item-disabled-text`, `-group-label-text`, `-separator-color`,
`-empty-text`, `-description-text`; defaults from semantic tokens; `data-variant` /
`data-size` on Root and Item; `data-tone="danger"` on Item (destructive commands); forced
colors: `Highlight` outline on the keyboard highlight.

## Requests to other changes

1. **`add-combobox`** (`combobox-pattern`): state in the pattern that it is popup-optional —
   a host without a popup (Command) satisfies it with the list in place, and the
   requirements Opening, Results While Closing, Popup Placement In The DOM and the
   popup-closing/commit steps of Enter, Escape And Tab do not apply to it. Concretely: keep
   `overlay` and `trackPosition` out of `patternEffects` (Combobox's own effects), and let
   `patternConnect`'s input props take `expanded` from the host's computed `exposed` instead of
   reading the `open` state, so Command can spread them unchanged. Export the
   `optionsNeverSelected` invariant (Autocomplete's) from the pattern module so Command reuses
   it. APPLIED (coordinator, 2026-10-14): add-combobox `combobox-pattern` "Usable Without A Popup", task A.5;
   Command's spec keeps its own narrowing (requirement "Built On The Combobox Pattern
   Without A Popup"), consistent with it.
2. **`add-collections`** (`collection-model` "Text Value", "Derivations"; static item
   registration): add optional `keywords: readonly string[]` to item nodes (data accessor
   `getKeywords`, static part prop `keywords`), and make the `contains` / `startsWith`
   filters match the text value or any keyword. Keywords are never used for typeahead or
   announcements. APPLIED (coordinator, 2026-10-14): add-collections `collection-model` "Text Value",
   "Derivations", task A.3.
3. **`add-listbox`**: none required — Command uses the reusable listbox parts as specified,
   with `section` / `section-label` exposed under the part names `group` / `group-label`
   (Combobox's naming); if add-listbox prefers Command to keep `section` names, only the React
   part names change.

## Risks / Trade-offs

- [No built-in fuzzy ranking: cmdk users expect it] → the docs page shows match-sorter and
  command-score recipes with `filter: null`; the default `contains` covers static palettes.
- [Home/End edit text instead of jumping to the ends, unlike cmdk/Bits] → APG combobox rule
  and cmdk#341; PageUp/PageDown and `navigate("first" | "last")` for apps that want more.
- [Escape clears before closing — one extra key press] → matches native search fields and
  Raycast; `clearOnEscape={false}` restores single-Escape close.
- [Request 1 applied in add-combobox, not yet implemented] → the narrowing also lives in this
  spec, so implementation does not wait; the Command spec's list of non-applying
  requirements matches the pattern's "Usable Without A Popup".
- [Mobile screen readers keep virtual focus] → device testing in the manual pass; React Aria's
  real-focus mode is the known fallback (research Open questions).

## Migration Plan

New API. cmdk / shadcn: `Command` → `Command.Root`; `shouldFilter={false}` → `filter={null}`;
`filter(value, search, keywords) → number` → a ranked collection with `filter: null` (or a
boolean matcher); `Item onSelect` → `onAction`; `value` (highlight) → not controllable
(`highlight(key)` on the API); `Command.Dialog` → the add-dialog composition; `loop` default
true; `vimBindings` → app keybindings via `navigate`. Bits UI: same mapping. Reado: no palette
today.

## Open Questions

- Real focus in the list for mobile screen readers (research Open questions) — answered by
  device testing; changes connect only.
