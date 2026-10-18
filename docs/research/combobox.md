# Combobox — research

Status: done · Wave: 2

A text input with a listbox popup: the user types to filter suggestions and picks one
(or several) of them. The **value is a selection of items**; the input text is a query
that is reconciled with the selection at defined commit points. Its sibling
[Autocomplete](autocomplete.md) shares the whole input + popup behaviour, but its value
is the text itself. Both are built from one shared capability, `combobox-pattern`,
specified in `add-combobox` (see Decisions).

Sources read (local clones, 2026-10-14; paths relative to each repo):

| Library | Files |
|---|---|
| Zag / Ark | `zag/packages/machines/combobox/src/{combobox.machine,combobox.connect,combobox.types}.ts`; `ark/packages/react/src/components/combobox/*` |
| React Aria | `packages/react-stately/src/combobox/useComboBoxState.ts` (via `git show HEAD:`), `packages/react-aria/src/combobox/useComboBox.ts` (@ `e04377c`), PR [#10503](https://github.com/adobe/react-spectrum/pull/10503) (merged 2026-10-12) |
| Base UI | `packages/react/src/combobox/{root/AriaCombobox.tsx,input,status,empty,chips,list,utils}`, `autocomplete/root/AutocompleteRoot.tsx` |
| Headless UI | `packages/@headlessui-react/src/components/combobox/{combobox.tsx,combobox-machine.ts}` |
| Ariakit | `ariakit-components/src/combobox/combobox-store.ts`, `ariakit-react-components/src/combobox/{combobox,combobox-item,combobox-list,combobox-popover,combobox-cancel}.tsx` |
| Reka UI | `packages/core/src/Combobox/*`, `Listbox/{ListboxRoot,ListboxFilter,ListboxContent}.vue`, `shared/useComposing.ts` |
| Bits UI | `bits/combobox/*`, `bits/select/select.svelte.ts` (combobox is Select with `isCombobox`) |
| Kobalte | `packages/core/src/combobox/{combobox-base,combobox-input,combobox-listbox,combobox.intl}.tsx`, `select/hidden-select-base.tsx` |

Reado: no combobox today. `molecules/CompletingTextarea.tsx` is a caret-anchored
`role=combobox` textarea — that is the future **Mentions** component, which will reuse
`combobox-pattern`, not this component.

## Pattern

- WAI-ARIA APG: [Combobox](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/) (editable
  combobox with list autocomplete; "list with inline autocomplete" for
  `aria-autocomplete="both"`), popup = [Listbox](https://www.w3.org/WAI/ARIA/apg/patterns/listbox/).
- Roles and attributes: input `role="combobox"` with `aria-expanded`, `aria-controls`
  (the listbox), `aria-autocomplete` (`list` | `both`), `aria-activedescendant` (the
  highlighted option, or absent); popup `role="listbox"` with an accessible name,
  `aria-multiselectable` in multiple mode; options `role="option"` with explicit
  `aria-selected`, `aria-disabled`; groups `role="group"` labelled by their label.
  Optional button: `aria-label`, `aria-expanded`, `aria-controls`, `tabindex=-1`.
- Keyboard (APG, focus in the input): Down Arrow opens and/or moves to the next option;
  Alt+Down opens without moving; Up Arrow / Alt+Up (closes); Enter accepts the
  highlighted option and closes; Escape closes the popup (optionally clears the
  combobox when closed); printable characters edit the text; Left/Right/Home/End move
  the caret (APG: they "return focus to the textbox" — i.e. clear the highlight).

## How the others built it

### Zag.js / Ark UI

- Source: `combobox.machine.ts` (1,069 lines), `combobox.connect.ts`.
- API: Root, Label, Control, Input, Trigger, ClearTrigger, Positioner, Content, List,
  ItemGroup(+Label), Item, ItemText, ItemIndicator, Empty (Ark only, `role=presentation`).
  Props: `value[]`, `inputValue`, `open`, `highlightedValue` all controllable;
  `multiple`, `allowCustomValue`, `inputBehavior: none | autohighlight | autocomplete`,
  `selectionBehavior: replace | clear | preserve`, `openOnClick`, `openOnChange`,
  `openOnKeyPress`, `closeOnSelect`, `alwaysSubmitOnEnter`, `composite` (false →
  popup is a `dialog` containing a listbox), `scrollToIndexFn`.
- State model: **hierarchical** — `closed.{idle,focused}`, `open.{interacting,suggesting}`.
  `suggesting` = the user is typing (auto-highlight, keep text), `interacting` = arrowing
  or hovering. Every transition is duplicated for "open is controlled" (`isOpenControlled`
  guard). Input text is written to the DOM imperatively (`syncInputValue` sets
  `inputEl.value`), selection-to-text via `selectionBehavior`. Collection change detected
  with `collection.toString()`.
- Notable: Apple-only announcement of the highlighted item (`announceHighlightedItem`,
  `isApple()`, "text, selected"); pointer-move highlight ignored unless modality is
  pointer ("keyboard-driven scroll fires pointermove"); revert-on-Escape/outside when the
  text is custom and custom values are not allowed; Enter `preventDefault`s only when it
  selects or rejects.
- Problems: `aria-selected` via `ariaAttr()` is **absent when false**; assertive live
  region for the Apple announcement (should be polite); the `isOpenControlled` doubling;
  imperative DOM writes race with React's controlled input.

### React Aria (and Kobalte, its Solid port)

- Source: `useComboBoxState.ts` (715 lines), `useComboBox.ts` (580 lines).
- API: ComboBox (RAC) with Input, Button, Popover, ListBox, ListBoxItem, sections;
  `selectedKey`/`value`, `inputValue`, `allowsCustomValue`, `menuTrigger: input | focus |
  manual`, `allowsEmptyCollection`, `defaultFilter`, `shouldFocusWrap`, `selectionMode`
  (multiple added 2026, with TokenField).
- State model: an overlay trigger state plus a selection manager; input/selection sync is
  one large `useEffect` that compares `lastValue`, `lastValueRef`, `lastSelectedKeyText`
  every render (the maintainers' own TODO: "refactor useComboBoxState to avoid this").
  Opening from the button or Arrow shows **all items** (`showAllItems`); while closing it
  keeps rendering `lastCollection` so the exit animation does not flash the unfiltered
  list. Closes automatically when the filtered list becomes empty (`closedDueToEmpty`)
  and reopens when results return. Emptying the input clears a single selection.
  `commitValue` on blur: custom value allowed → selection `null`, text kept; otherwise
  `resetInputValue()` to the selected item's text.
- Notable:
  - **Announcements**: count on open (when nothing is focused, or always on Apple) and on
    count change, all platforms; selection on Apple; highlight on Apple — narrowed by
    [PR #10503](https://github.com/adobe/react-spectrum/pull/10503) (2026-10-12, fixing
    [RA#10220](https://github.com/adobe/react-spectrum/issues/10220)) to **section entry
    only**, because current VoiceOver (macOS 26, Chrome) speaks per-item details natively
    and the live text interrupted it. [RA#10326](https://github.com/adobe/react-spectrum/issues/10326)
    (open) shows the opposite in Safari 26.5 for Autocomplete: VO silent. The behaviour is
    browser-dependent — see Accessibility.
  - `ariaHideOutside([input, popover])` while open (so the iOS VO cursor stays in the
    widget), the trigger button is `excludeFromTabOrder` + `preventFocusOnPress`, opens on
    press *start* for mouse, on press *end* for touch; `onTouchEnd` treats a touch at the
    exact centre of the input as an iPad VoiceOver activation and ignores VO iOS's double
    `touchend` (500 ms).
  - Escape `revert()`s and lets the event propagate when there was nothing to revert.
  - `aria-describedby` of the input includes a value element (multiple mode chips).
  - `autoCorrect="off"`, `spellCheck="false"` on the input (iOS / Safari autocorrect).
- Problems: effect-driven sync (double `onSelectionChange` in React 18, documented in
  `useValueId`); `aria-posinset` arithmetic with sections (RA#9556, #10711).

### Base UI

- Source: `AriaCombobox.tsx` (2,046 lines — one engine for Combobox and Autocomplete).
- API: Root, Label, InputGroup, Input, Trigger, Clear, Value, Chips/Chip/ChipRemove,
  Portal, Positioner, Popup, Arrow, List, Item, ItemIndicator, Group/GroupLabel,
  Separator, Empty, Status, Row (grid), Collection. Props: `items` / `filteredItems`,
  `filter` (`null` disables), `itemToStringLabel/Value`, `isItemEqualToValue`,
  `autoHighlight: boolean | "always"`, `keepHighlight`, `highlightItemOnHover`,
  `openOnInputClick`, `autoComplete: list | both | inline | none`, `inline` (list without
  popup), `modal`, `limit`, `grid`, `virtualized`, `submitOnItemClick`,
  `fillInputOnItemPress`, `formAutoComplete`, `locale`.
- Notable: **Autocomplete is AriaCombobox with `selectionMode="none"`,
  `fillInputOnItemPress`, value = input value, `mode` = `autoComplete`** — one machine,
  presets. Freezes the query while the popup exits ("so filtering remains stable while
  exiting"); `shouldBypassFiltering` when the text equals the selected label; browser
  autofill matched against values then labels on the hidden input; hidden input focus
  forwards to the input; `Empty` and `Status` are polite `role=status` regions with Base
  UI's U+2060 initial-mutation trick; chips container is `role=toolbar` so NVDA stays in
  focus mode (BU#3629); a touch open waits for the viewport/keyboard to settle before
  positioning.
- Problems: a `role=status` child inside the listbox broke `aria-required-children`
  (BU#5443) — Empty moved out; listbox without a name (BU#5569); VO activedescendant
  (BU#5721, open).

### Headless UI

- Source: `combobox.tsx` (1,672 lines), `combobox-machine.ts`.
- API: Combobox, ComboboxInput (`displayValue`), ComboboxButton, ComboboxOptions,
  ComboboxOption, `immediate` (open on focus), `virtual`, `multiple`, `by`, `nullable`.
- Notable: the clearest written **input-sync rules** (comment above the watcher): never
  touch the input while the user is typing (`isTyping`, IME-safe); re-sync from the
  selection on close or when the selection/display value changes; caret to the end.
  "Trick VoiceOver": on open (not while typing) set `input.value = ''` and back, so VO
  announces the value. Tab selects the active option unless the popup was opened by focus
  (`ActivationTrigger.Focus`, so tabbing through a form never selects). Blur with an empty
  single value clears. Android: `onChange` fires during composition, otherwise filtering
  would wait for `compositionend`.
- Problems: VO silent on arrows (HUI#3593, #2736); VO in Firefox/Chrome eats arrows
  (HUI#3810, open); quadratic option registration (HUI#3898).

### Ariakit

- Store: `combobox-store.ts`; components `combobox*.tsx`. No built-in filter; free text by
  default; `selectedValue` string | string[] (array ⇒ multiple); `autoSelect`,
  `autoComplete: list | inline | both | none`, `showOnChange/Click/KeyPress`,
  `showMinLength`, `resetValueOnHide`, `resetValueOnSelect`, `setValueOnClick`.
- Notable: **turns virtual focus off on touch Safari** — "Safari doesn't support
  aria-activedescendant on combobox elements … moving the VoiceOver virtual cursor through
  the combobox items will always move the focus to the input element"; then printable keys
  and Backspace on a focused item return focus to the input. Inline completion only for
  `insertText`/`insertCompositionText` with the caret at the end; refuses completion when
  diacritic normalisation changes the length; skips just-deselected values "so Enter does
  not invert the user's last action"; auto-select stops when the user scrolls the list,
  waits for positioning, and never re-moves to the same item (AK#3837). `aria-selected`
  set only in select / multiple mode. Enter while open always `preventDefault`s.
- Problems: no announcements at all; `aria-selected` missing in single mode.

### Reka UI

- `Combobox/*` on top of `Listbox/*`. `resetSearchTermOnBlur` (true),
  `resetSearchTermOnSelect` (true), `openOnFocus`, `openOnClick`, `ignoreFilter`, built-in
  accent-insensitive `contains`. Empty part ("No options", plain div, inside content).
- Notable: the best IME code (`shared/useComposing.ts`): defer input until
  `compositionend` only for Han/Kana/Hangul/Bopomofo text, process Android Latin
  composition live (nuxt/ui#6717), never swallow arrows or Enter mid-composition. Blur
  close waits a frame so FocusScope's restore runs first (two comboboxes side by side).
- Problems: `useHideOthers` on every open, **even non-modal** (RK#2240); no listbox name;
  no announcer; first item highlighted by synthesising a `PageUp` keydown.

### Bits UI

- Combobox = Select machine with `isCombobox`. No filter, no reset on blur, any
  non-navigation key opens. Touch: select on the `click` after pointerup (ghost click),
  no hover highlight on touch, trigger opens on touch pointerup only. Hidden inputs, one
  per value; hidden input focus forwards to the input.
- Problems: no `aria-controls` on the input; `aria-selected` absent when false
  (BITS#2173); multiple mode writes the last label into the input.

### Kobalte

- React Aria port (data-driven `options`). Same announcements (Apple-gated highlight and
  selection, count everywhere) — with a bug: `countAnnouncement`'s `default:` case lacks a
  `return`, so every count other than 1 is announced as "undefined". Escape while closed
  clears the input (and the selection in single mode). Hidden `<select>` for autofill
  (Safari needs it not `display:none`; Firefox needs a `<label>`; font-size ≥ 16 px to stop
  iOS zoom). Backspace on an empty input removes the last selection.

## Accessibility

Applies [accessibility.md](accessibility.md) §4.2 (active descendant only where focus must
stay in a text field), §6 (IME guard, logical keys), §7 (Announcer), §9 (collator), and
[assistive-tech-and-a11y-testing.md](assistive-tech-and-a11y-testing.md) cause B, E, I, J
and the "Combobox / listbox / autocomplete" row of §1.4.

- **Focus**: DOM focus never leaves the input (`aria-activedescendant`); option
  `pointerdown` is prevented so a click does not blur the input; the trigger and clear
  buttons are `tabindex=-1` and do not take focus on press (they stay reachable to the
  screen-reader cursor, which is how iOS/Android SR users open the list — mobile ATs send
  no arrow keys, cause J).
- **Names**: input named by the Label (`<label for>` — native, so label clicks focus the
  input); listbox `aria-labelledby` the label (BU#5569, Reka and Bits have none); trigger
  and clear buttons named from `messages`.
- **Explicit `aria-selected="false"`** on every unselected option (HUI#1599, BITS#2173;
  Zag and Ariakit still omit it).
- **Set metadata**: options carry `aria-posinset`/`aria-setsize` computed from the filtered
  collection whenever the list is filtered or virtualized (RA#10711, AK#6301).
- **VoiceOver and `aria-activedescendant`** (cause B) — the state in October 2026:
  - Safari (macOS 26.x) and every iOS browser (WebKit): VO does not follow
    activedescendant changes on a `combobox` (RA#10326 open on Safari 26.5; Ariakit's
    comment; ZG#2936).
  - Chrome on macOS 26: VO speaks the option natively ("Item 01, not selected, 1 of 20"),
    and a live announcement of the item text *interrupts* it (RA#10220 → PR #10503).
  - Section changes are silent in VO everywhere (RA#10503 keeps that announcement).
  - So a per-item announcement gated on "Apple" doubles speech in Chrome, and one
    removed entirely silences Safari. rind-ui gates the per-item announcement on Apple
    **and WebKit**, keeps section-entry and selection announcements on all Apple
    platforms — a change to the `vo-activedescendant` quirk condition requested from
    `add-a11y-foundations` (design.md, Requests).
- **Result count** is a WCAG 4.1.3 status message ("5 results returned" is the
  Understanding document's own example) and is announced on every platform, coalesced by
  key while typing (React Aria and Kobalte do this everywhere; the foundations' Apple-only
  gate for counts is a second request).
- **Empty state** is outside the listbox (BU#5443: an Empty placed inside the listbox
  fails `aria-required-children` — a usage error there, made impossible here), not a live
  region of its own (the Announcer speaks "No results"; BU#4181), and the listbox is not
  exposed while it has no options. The open *state* never depends on the item count
  (RA#5690, RA#7791, RA#2333: async misses closed the popup for good).
- **Portalled popup and the touch screen-reader cursor**: the assistive-tech note (§1.4)
  lists ZG#2936 as "a portalled listbox is unreachable by the VO virtual cursor"; reading
  the issue, the portal was a commenter's guess and the maintainer's confirmed cause is
  VoiceOver ignoring activedescendant (cause B). The swipe-order concern itself is real:
  Base UI aria-hides the outside of a *non-modal* popup on purpose "for touch screen
  readers" (BU#5528) and React Aria does the same (`ariaHideOutside`), at the price of
  ARK#3699 / RK#2240 / RA#4937. rind-ui hides nothing (overlay spec) and answers the
  concern with DOM order instead: the popup renders **in place by default** (positioned
  with `strategy: fixed`, escaping overflow without moving in the DOM), so swiping from
  the input reaches the options next; a consumer who wraps it in `Portal` accepts the
  cost, documented. Verified on devices in the manual protocol before `done`.
- **IME**: Enter, Escape, arrows and Tab are ignored while composing (keyboard-interactions
  guard); input events during composition still update the query on Android-style Latin
  composition (Reka, Headless UI), and highlight/aria-activedescendant never changes
  mid-composition (RA#10126, AK#6663).
- **Typed character before the option**: React Aria's Autocomplete delays the
  activedescendant update after forward typing (500 ms) "to not interrupt the native screen
  reader announcement of the letter you just typed". rind-ui adopts it for highlights made
  by typing (`autoHighlight`).
- **Forced colors**: highlight shown with `outline` + `Highlight`/`HighlightText`, selected
  with a check glyph (`currentColor`), not background only (AK#558, RA#2949). **Target
  size**: options, trigger, clear and chip-remove buttons ≥ 24×24 CSS px; chip remove uses
  `--rind-hit-area`.
- **Native**: `<datalist>` gives no styling, no async control, no announcements and poor
  mobile AT support; customizable `<select>` has no text input. Neither covers this
  (native-platform §7). The input itself is native, so labels, autofill attributes and
  form behaviour come from the platform.

## Bug history

Method (2026-10-14): `gh search issues` over chakra-ui/zag, chakra-ui/ark, mui/base-ui,
adobe/react-spectrum, tailwindlabs/headlessui, ariakit/ariakit, unovue/reka-ui,
huntabyte/bits-ui and kobaltedev/kobalte (radix-ui/primitives ships no combobox): ~170
searches over sync/blur, custom value, multiple/chips, open triggers, IME, inline
completion, async/stale, empty, virtualization, VoiceOver/NVDA/TalkBack, portal/dialog,
forms, mobile, performance. About 120 issues read in full with comments; every row below
was read. Abbreviations as in the assistive-tech note (ZG, ARK, BU, RA, HUI, AK, RK,
BITS, KB). Autocomplete-specific rows are in [autocomplete.md](autocomplete.md#bug-history).

| Library | Issue | Symptom | Root cause | Fix / status | Lesson for rind-ui |
|---|---|---|---|---|---|
| **Text / selection sync** | | | | | |
| Ark | [ARK#3526](https://github.com/chakra-ui/ark/issues/3526) closed | `defaultInputValue` wiped on outside click | Blur resets text to the selected label, "" with no selection | Intended | Seed text without a selection is uncommitted text: the commit rules decide, documented |
| React Aria | [RA#7387](https://github.com/adobe/react-spectrum/issues/7387) closed | Tabbing through a pre-filled field clears it | Matching text is not a selection | Docs: pass `selectedKey` | Exact-match commit only when exactly one option matches; names can collide |
| Headless UI | [HUI#2932](https://github.com/tailwindlabs/headlessui/issues/2932), [#2934](https://github.com/tailwindlabs/headlessui/issues/2934) closed, [#3771](https://github.com/tailwindlabs/headlessui/issues/3771), [#3567](https://github.com/tailwindlabs/headlessui/issues/3567) open | Tab / outside click / blur commits the highlighted (even auto-highlighted) option | "Tab selects" for datalist parity; blur commit with pointer away | Intended / open (PR #3628) | Highlight ≠ selection; `selectOnTab` opt-in, never after focus open, never on blur |
| React Aria | [RA#2809](https://github.com/adobe/react-spectrum/issues/2809), [RA#8744](https://github.com/adobe/react-spectrum/issues/8744) closed | Tab while hovering selects the hovered option; Tab commits the focused item | Hover is virtual focus; Tab runs `commit()` | Intended, no recorded reason | Same; pointer highlights never commit |
| React Aria | [RA#4728](https://github.com/adobe/react-spectrum/issues/4728) closed | With custom values, Tab nulls the key but outside click keeps it | Two exit paths, two commit functions | Stale PR | One `commitText` for every exit path |
| React Aria | [RA#9874](https://github.com/adobe/react-spectrum/issues/9874), [RA#7698](https://github.com/adobe/react-spectrum/issues/7698) closed | `onSelectionChange` fires on blur with no change | Blur re-emits the selection for controlled parents | PR #9729 / intended | Callbacks only for real changes, once per action |
| Headless UI | [HUI#1875](https://github.com/tailwindlabs/headlessui/issues/1875) closed | After outside click the input is empty but the consumer's query keeps old text | `input.value` written through the ref, no event | #1916 | Never write the input imperatively; text is a controllable |
| Headless UI | [HUI#1735](https://github.com/tailwindlabs/headlessui/issues/1735) closed | `displayValue` overwrites text while typing | Sync ran during editing | #1755 | Text follows external changes only when not dirty |
| Headless UI | [HUI#1339](https://github.com/tailwindlabs/headlessui/issues/1339) closed | Deleting all text does not clear the selection; reverts on blur | Fixed-list design | `nullable` prop | Empty text at commit clears a single selection |
| Kobalte | [KB#638](https://github.com/kobaltedev/kobalte/issues/638) closed | Reset on blur only when the list had matches | Reset ran only while open; no-match closed the popup | `noResetInputOnBlur` | Commit rules independent of popup visibility |
| Ark / Base UI | [ARK#2930](https://github.com/chakra-ui/ark/issues/2930), [BU#4204](https://github.com/mui/base-ui/issues/4204) closed | Enter with nothing highlighted leaves orphan text / wipes the query | Enter path undefined without highlight | Fixed in zag / PR #4235 | Enter without highlight = commit |
| React Aria | [RA#6362](https://github.com/adobe/react-spectrum/issues/6362), [#6675](https://github.com/adobe/react-spectrum/issues/6675) closed | Input resets when long text scrolls horizontally | Close-on-scroll saw the input's own scroll | PR #6461 | No close-on-scroll for the popup; positioning tracks instead |
| React Aria | [RA#2181](https://github.com/adobe/react-spectrum/issues/2181) closed | Clicking below a filtered list selects an item | Close → unfiltered list re-renders under the pointer → mouseup selects | PRs #3999/#4060 | Frozen results while closing; presses ignored while exiting |
| **Selection vs changing items** | | | | | |
| Zag / Ark / Base UI / RA | [ZG#1947](https://github.com/chakra-ui/zag/issues/1947), [ARK#3523](https://github.com/chakra-ui/ark/issues/3523), [BU#3064](https://github.com/mui/base-ui/issues/3064), [RA#1645](https://github.com/adobe/react-spectrum/issues/1645) closed | Preset value never shows when items load later | Label sync only on value change | Various | Text recomputed when the collection resolves the selected key (not dirty) |
| Base UI | [BU#3818](https://github.com/mui/base-ui/issues/3818) closed | Value cleared when async results no longer contain it | Regression PR #3607 validated selection against `items` | PR #3824 | Selection never derived from the current items (collections rule) |
| Zag / Kobalte | [ZG#2967](https://github.com/chakra-ui/zag/issues/2967), [KB#217](https://github.com/kobaltedev/kobalte/issues/217) closed | External value shows placeholder; filtered-out selections vanish | Labels/objects from the current (filtered) list | Workarounds | Label map for selected keys (collections) |
| Kobalte | [KB#719](https://github.com/kobaltedev/kobalte/issues/719) closed | Click after filtering selects the item at that index of the unfiltered list | Index lookup in a stale collection | PR #731 | Keys, never indexes |
| Bits UI | [BITS#2124](https://github.com/huntabyte/bits-ui/issues/2124) closed | Highlight on an unmounted item, arrows dead | Highlight held a removed DOM node | Fixed | Highlight is a key repaired on every collection change |
| Ariakit | [AK#3914](https://github.com/ariakit/ariakit/issues/3914) closed | Controlled `activeId` lags the filtered list (flicker) | Async update ordering | `flushSync` workaround | Results and highlight derived in the same step |
| **Free text / custom values** | | | | | |
| React Aria | [RA#9837](https://github.com/adobe/react-spectrum/issues/9837) closed | Multiple + custom values: Escape/Enter/Tab wipe all keys | `selectedKey` null in multiple → custom-value commit | PR #9945 | Commit rules per mode; a commit never clears a multiple selection |
| React Aria | [RA#1690](https://github.com/adobe/react-spectrum/issues/1690) closed | Form submits the text, not the key | `name` on the text input | Hidden input | Key in a hidden input; visible input unnamed by default |
| Headless UI | [HUI#2439](https://github.com/tailwindlabs/headlessui/issues/2439) closed | Custom value replaced by the first option after Tab | Object identity + Tab commits | Usage | String keys (collections); Tab does not select |
| **Multiple / chips** | | | | | |
| Zag | [ZG#1276](https://github.com/chakra-ui/zag/issues/1276) closed | `selectionBehavior=clear` does not keep the input empty | Text sync effect ran after the selection change | Fixed | Selection and text written in one action |
| Base UI / Reka | [BU#3181](https://github.com/mui/base-ui/issues/3181) open, [RK#2151](https://github.com/unovue/reka-ui/issues/2151) open, [RK#1559](https://github.com/unovue/reka-ui/issues/1559) closed | Close / clear-query on select in multiple mode contested | Both behaviours wanted | Debated | `closeOnSelect` and `clearInputOnSelect` props with stated defaults |
| Ariakit | [AK#3580](https://github.com/ariakit/ariakit/issues/3580) closed | Typing impossible: text reset each keystroke | New array reference read as a new selection | Usage | Selection compared by content (`equal` on sets) |
| Base UI | [BU#5547](https://github.com/mui/base-ui/issues/5547) open | ArrowLeft onto a chip closes the popup, discards the query | Chips not counted as inside | Draft PR #5546 | Chips are inside the component for focus and dismissal |
| Base UI | [BU#3629](https://github.com/mui/base-ui/issues/3629) closed | NVDA: Left/Right between input and chips broken | Browse mode eats arrows without a container role | `role=toolbar`, PR #3647 | Chips toolbar |
| Kobalte | [KB#499](https://github.com/kobaltedev/kobalte/issues/499) open | Ctrl+A in the input selects all items | Collection select-all wired to the input | Open | Text shortcuts never become collection commands |
| Zag / Ark | [ZG#1661](https://github.com/chakra-ui/zag/issues/1661), [ARK#2742](https://github.com/chakra-ui/ark/issues/2742) closed | Combobox + tags: tag added twice / removed tags return | Two machines own one commit | Fixed / usage | One owner per commit (chips in this machine) |
| Zag / Base UI | [ZG#1433](https://github.com/chakra-ui/zag/issues/1433), [BU#5549](https://github.com/mui/base-ui/issues/5549) closed | Multiple: value re-sorted; open jumps to the first selected item | Value rebuilt in collection order; single-mode open logic | Fixed | Keep selection order; multiple opens on the first option |
| **Opening and keyboard** | | | | | |
| Zag / Reka | [ZG#1664](https://github.com/chakra-ui/zag/issues/1664) closed, [RK#1978](https://github.com/unovue/reka-ui/issues/1978) open | VoiceOver Ctrl+Opt+Space does not open | Opening on `pointerup`; VO sends a bare `click` | `openOnClick` / open | Trigger activation on click (press module), virtual modality runs |
| Base UI | [BU#3825](https://github.com/mui/base-ui/issues/3825) closed | Programmatic `.focus()`/`.click()` does not open | Parity with `<select>` | Intended | Focus/press opening are explicit opt-ins |
| Headless UI / RA | [HUI#3558](https://github.com/tailwindlabs/headlessui/issues/3558), [RA#7228](https://github.com/adobe/react-spectrum/issues/7228) closed | Home/End dead or Shift+Home/End selection broken | Keys routed to the list | Deferred to the browser | Home/End always belong to the caret |
| React Aria | [RA#8298](https://github.com/adobe/react-spectrum/issues/8298) closed | Arrowing scrolls the window, closing the combobox | `scrollIntoView` scrolled ancestors | Fixed | Scroll only the list, nearest edge |
| Base UI | [BU#4002](https://github.com/mui/base-ui/issues/4002) closed | Safari: keyboard scroll lets the resting mouse steal the highlight | Zero-delta `mousemove` | PR #5265 | Collections pointer guard |
| Ariakit | [AK#7118](https://github.com/ariakit/ariakit/issues/7118) closed | Hover moves focus into a closed combobox | Override skipped the open gate | PR #7119 | Pointer highlight only while open |
| **IME** | | | | | |
| Ariakit | [AK#6663](https://github.com/ariakit/ariakit/issues/6663) closed | `autoSelect` breaks Korean ("사과" → "사ㅏ") | Auto-select moved focus mid-composition | PR #6664 | No highlight/focus change while composing |
| React Aria | [RA#10126](https://github.com/adobe/react-spectrum/issues/10126) closed | CJK typing never highlights the first item | Only `insertText` counted as typing | PR #10156 | Composition commit counts as forward typing ([RA#10279](https://github.com/adobe/react-spectrum/issues/10279): paste excluded on purpose) |
| Base UI / HUI | [BU#2942](https://github.com/mui/base-ui/issues/2942), [BU#3079](https://github.com/mui/base-ui/issues/3079), [HUI#2575](https://github.com/tailwindlabs/headlessui/issues/2575) closed | Android predictive keyboards: no filtering until the keyboard closes | Filtering waited for `compositionend` | PR #2944 | Filter during composition; block only commit/highlight |
| Base UI | [BU#5574](https://github.com/mui/base-ui/issues/5574) open | Mouse choice during composition leaves the preedit; deleting it clears the value | IME commit overwrites the chosen label | Open | A choice during composition writes the text after `compositionend` |
| Reka | [RK#2540](https://github.com/unovue/reka-ui/issues/2540) closed | Requests fired on partial preedit | Input handled before composition ended | PR #2541 | Query reported with `composing` in the details; abort on next |
| RA / Ariakit | [RA#10249](https://github.com/adobe/react-spectrum/issues/10249), [AK#6579](https://github.com/ariakit/ariakit/issues/6579), [AK#6294](https://github.com/ariakit/ariakit/issues/6294), [AK#2203](https://github.com/ariakit/ariakit/issues/2203) closed | Enter/Escape during composition submit or clear; Pinyin split into tags; dead keys break autoSelect | Unguarded sibling handlers | PRs #10200, #6580, #6420 | One shared IME guard on every key transition |
| **Inline completion / auto highlight** | | | | | |
| Ariakit | [AK#6315](https://github.com/ariakit/ariakit/issues/6315), [AK#6329](https://github.com/ariakit/ariakit/issues/6329) closed | NFD "café" completes to "caféeria"; wrong offsets for Hangul/kana | Offsets from the normalised string | PRs #6457, #6593 | Refuse completion when normalisation changes length; test NFD/CJK |
| Ariakit | [AK#6916](https://github.com/ariakit/ariakit/issues/6916) closed | Late results re-apply the completion over a moved caret | No caret check | PR #6923 | Completion only with the caret at the end, re-checked |
| Ariakit | [AK#1652](https://github.com/ariakit/ariakit/issues/1652) closed | Clear leaves the auto-selected item active | Flag not reset | Workaround | Clear resets highlight |
| Ark | [ARK#3231](https://github.com/chakra-ui/ark/issues/3231) closed | Auto-highlight fails with `useDeferredValue` | Highlight followed the DOM, not data | Not a bug | Auto highlight from derived results |
| **Async, empty state** | | | | | |
| React Aria | [RA#5690](https://github.com/adobe/react-spectrum/issues/5690), [RA#7791](https://github.com/adobe/react-spectrum/issues/7791), [RA#8643](https://github.com/adobe/react-spectrum/issues/8643) closed, [RA#2333](https://github.com/adobe/react-spectrum/issues/2333) open | After a miss the popup never reopens on a hit; empty state never shows | Open state derived from `collection.size`, lagging async input | `allowsEmptyCollection`; refactor pending | Open state never depends on item count; "not exposed" is separate |
| Base UI | [BU#2703](https://github.com/mui/base-ui/issues/2703) closed | Controlled async: caret jumps to the end each keystroke | Store re-wrote the input | PR #2707 | Synchronous controlled round-trip; no imperative writes |
| Kobalte | [KB#514](https://github.com/kobaltedev/kobalte/issues/514) closed | Closing flashes stale options | Frozen options were an older list | PR #731 | Freeze the list shown at close start |
| Base UI | [BU#5443](https://github.com/mui/base-ui/issues/5443) closed (not planned) | `role=status` Empty inside the listbox fails axe | Consumer put Empty in List (docs: in Popup) | Usage | Empty is a sibling of the list by construction |
| Base UI | [BU#4181](https://github.com/mui/base-ui/issues/4181) closed | Status message never announced | Live region mounted with its text | PR #4286 | Announcer, not component live regions |
| **Virtualization, set metadata** | | | | | |
| React Aria | [RA#10711](https://github.com/adobe/react-spectrum/issues/10711) open | Filtered virtualized list: "14 of 2" | Clones keep unfiltered index | Patch proposed | Derivations renumber (collections) |
| Reka / Ariakit | [RK#2904](https://github.com/unovue/reka-ui/issues/2904), [AK#6301](https://github.com/ariakit/ariakit/issues/6301) closed | Stale setsize after filter; duplicate posinset with groups | Memo deps; counting arithmetic | PRs #2905, #6426 | Set metadata from the derived collection, unit-tested |
| React Aria | [RA#2578](https://github.com/adobe/react-spectrum/issues/2578), [RA#5839](https://github.com/adobe/react-spectrum/issues/5839) open | TalkBack "3 of 0" in sections; VO counts section headers | Unknown (AT side) | Open | Manual protocol on devices for sectioned lists |
| Bits UI / Base UI / Ariakit | [BITS#1696](https://github.com/huntabyte/bits-ui/issues/1696), [BU#4160](https://github.com/mui/base-ui/issues/4160), [AK#5165](https://github.com/ariakit/ariakit/issues/5165) closed | Highlight resets on row mount; wrap to first rendered item; append jumps to top | DOM-driven navigation and resets | Fixed | Data-driven navigation; no reset on mount or append |
| **Assistive technology** | | | | | |
| Zag | [ZG#2936](https://github.com/chakra-ui/zag/issues/2936) closed | VO (macOS/iOS) cannot explore options; title blames Portal | Maintainer: VO ignores activedescendant changes; the portal was a commenter's guess | Apple live announcer | Announcer from day one; the portal is not the proven cause (correcting the assistive-tech note §1.4) |
| React Aria | [RA#10326](https://github.com/adobe/react-spectrum/issues/10326) open | Autocomplete silent in VO (Safari 26.5) | Announcer only in `useComboBox` | Open | Announcer in the shared pattern |
| React Aria | [RA#10220](https://github.com/adobe/react-spectrum/issues/10220) closed | VO (Chrome, macOS 26) reads only the item name | Live announcement interrupts VO's native reading | PR #10503: section entry only | Per-item announcement only where VO is silent (WebKit) |
| Base UI | [BU#5721](https://github.com/mui/base-ui/issues/5721) open | VO+Safari: after ArrowDown-open no option is read (typing first works) | Opening path differs; not reproduced on 26.4 | Open | Manual VO test per opening path |
| Headless UI | [HUI#3810](https://github.com/tailwindlabs/headlessui/issues/3810) open | Arrows broken with VO in Firefox and Chrome (not Safari) | VO extra arrow handling | Open | Tested-with matrix includes VO + Chrome |
| Headless UI | [HUI#3593](https://github.com/tailwindlabs/headlessui/issues/3593), [HUI#2736](https://github.com/tailwindlabs/headlessui/issues/2736) open | No open/close announcement; auto-highlight preempts it; first option always highlighted | Untriaged | Open | `autoHighlight` off by default; count announced on open |
| React Aria / Ariakit | [RA#4941](https://github.com/adobe/react-spectrum/issues/4941) open, [AK#1648](https://github.com/ariakit/ariakit/issues/1648) closed | "N suggestions" before the role on focus-open; truncated initial announcement | Assertive announcement races focus speech | Open / stale | Polite, keyed, debounced count |
| Zag | [ZG#2947](https://github.com/chakra-ui/zag/issues/2947) closed | Every highlighted option read "selected" | `aria-selected` bound to the highlight | Fixed | `selectable` invariant |
| Ariakit | [AK#1647](https://github.com/ariakit/ariakit/issues/1647), [AK#3030](https://github.com/ariakit/ariakit/issues/3030) closed | Multi-select changes not announced; VO "selected, selected" | Missing `aria-multiselectable`; VO verbosity | Example fixed / intended | `aria-multiselectable` always in multiple mode |
| Reka | [RK#1500](https://github.com/unovue/reka-ui/issues/1500) closed | Extra focus/blur events while arrowing | Focuses option then input as a VO workaround | Intended | No focus juggling; announcer instead |
| Base UI | [BU#4247](https://github.com/mui/base-ui/issues/4247) closed | Command input never announced; virtual focus stuck on an option | Initial highlight before the input was read | PR #4949 | No highlight on open unless by arrow |
| Base UI | [BU#5569](https://github.com/mui/base-ui/issues/5569) closed | Listbox without a name | APG/axe exempt combobox-owned listboxes (w3c/aria#2767) | Not a confirmed bug | Name it anyway (label), harmless and ARIA-valid |
| **Portals, dialogs, hide-outside, Escape** | | | | | |
| Ark / Reka | [ARK#3699](https://github.com/chakra-ui/ark/issues/3699), [RK#2240](https://github.com/unovue/reka-ui/issues/2240) closed | Opening aria-hides the page | Hide-others on a non-modal popup | Fixed | Non-modal layer hides nothing (outside-inert) |
| Base UI | [BU#5528](https://github.com/mui/base-ui/issues/5528) closed | Non-modal popup aria-hides tabbable content | Deliberate, for touch screen readers | Intended | The touch-SR concern is real; rind-ui answers it with DOM placement, not hiding |
| React Aria | [RA#4937](https://github.com/adobe/react-spectrum/issues/4937) open, [RA#8934](https://github.com/adobe/react-spectrum/issues/8934), [RA#7377](https://github.com/adobe/react-spectrum/issues/7377) closed | Cannot opt out of hide-outside; stuck `aria-hidden`; seconds on huge DOMs | Global walk, nested owners | Won't fix / reverted | Same |
| Reka | [RK#1743](https://github.com/unovue/reka-ui/issues/1743), [RK#1846](https://github.com/unovue/reka-ui/issues/1846) closed | Tab freeze with a portalled combobox in a dialog / two comboboxes | FocusScope vs DismissableLayer loop | Workarounds | No focus scope on the popup; focus never leaves the input |
| Ariakit / RA | [AK#7632](https://github.com/ariakit/ariakit/issues/7632), [RA#3306](https://github.com/adobe/react-spectrum/issues/3306) closed | One Escape closes popup and dialog / Escape never reaches the dialog | Escape not layered | PR #7644 | Escape order: completion, popup, revert, then unhandled |
| Ariakit | [AK#6848](https://github.com/ariakit/ariakit/issues/6848) closed | Clicking popup padding moves focus out, arrows dead | Popup focusable | Fixed | Popup `pointerdown` prevented |
| **Forms** | | | | | |
| React Aria | [RA#1646](https://github.com/adobe/react-spectrum/issues/1646) closed | Enter on an open list submits the form | No `preventDefault` | PR #1651 | Enter prevented when it chooses |
| Zag / RA / BU / HUI | [ZG#2521](https://github.com/chakra-ui/zag/issues/2521) closed, [RA#6228](https://github.com/adobe/react-spectrum/issues/6228) open, [BU#2686](https://github.com/mui/base-ui/issues/2686), [HUI#2611](https://github.com/tailwindlabs/headlessui/issues/2611) closed | Enter twice to submit with custom values | Enter always swallowed while open | Fixed / open | Enter with no highlight is not prevented |
| Base UI / RA | [BU#2913](https://github.com/mui/base-ui/issues/2913), [RA#9788](https://github.com/adobe/react-spectrum/issues/9788) closed | `required` + `multiple` never validates | Validity on the empty text input | PRs #2925, #9792 | Validity on the value carrier (hidden input) |
| Reka / Ariakit | [RK#1861](https://github.com/unovue/reka-ui/issues/1861), [AK#5058](https://github.com/ariakit/ariakit/issues/5058) closed | `name[0]` serialisation; `name` submits search text | Hard-coded naming; input is a field | By design | Repeated `name`, one entry per key |
| Headless UI / Ariakit | [HUI#2851](https://github.com/tailwindlabs/headlessui/issues/2851), [AK#1861](https://github.com/ariakit/ariakit/issues/1861) closed | `form.reset()` ignored | No `reset` listener | HUI v2 | `hidden-form-input` reset |
| React Aria | [RA#9057](https://github.com/adobe/react-spectrum/issues/9057) open | Chrome autofill fills text, nothing selected, required submits empty | Autofill bypasses state | Open | Autofill matched to an option |
| Base UI | [BU#4120](https://github.com/mui/base-ui/issues/4120), [BU#5584](https://github.com/mui/base-ui/issues/5584) closed | Search input inherits `aria-invalid`; `readOnly` blocks opening | Field props on every input; readOnly as disabled | PRs #4154, #5541 | Field props on the value control; readOnly browses |
| **Mobile** | | | | | |
| RA / Bits | [RA#5522](https://github.com/adobe/react-spectrum/issues/5522), [BITS#1108](https://github.com/huntabyte/bits-ui/issues/1108) closed | Tapping an option clicks what is behind it | Selected on pointer events, ghost `click` lands below | Fixed | Touch choice on `click` |
| React Aria | [RA#4088](https://github.com/adobe/react-spectrum/issues/4088) closed | Popup behind the on-screen keyboard | No `visualViewport` tracking | PR #4330 | floating-positioning viewport rules |
| Ariakit | [AK#5047](https://github.com/ariakit/ariakit/issues/5047) closed | iOS: deleting a character blurs the input | Item `autoFocus` re-fired | PR #5608 | Items never take focus |
| Headless UI | [HUI#2672](https://github.com/tailwindlabs/headlessui/issues/2672) closed | Android "Next" key leaves the popup open | Close bound to Tab keydown | PR #2712 | Close and commit on `blur`, not on Tab |
| **Performance** | | | | | |
| HUI / Reka / RA | [HUI#3898](https://github.com/tailwindlabs/headlessui/issues/3898) open, [RK#1317](https://github.com/unovue/reka-ui/issues/1317), [RA#7814](https://github.com/adobe/react-spectrum/issues/7814) closed, [RA#5897](https://github.com/adobe/react-spectrum/issues/5897) open | Seconds per keystroke with 500–10,000 options; every hover re-renders all items | Per-item registration, O(n²) equality, highlight in shared context | Batching PR / refactor / open | Collections: one flush, key lookups, per-key selectors |
| Reka / Ariakit | [RK#2415](https://github.com/unovue/reka-ui/issues/2415), [AK#3451](https://github.com/ariakit/ariakit/issues/3451) closed | Positioning re-renders the list on open | Positioning state in list context | Closed | Positioning state isolated from items |

## Known pitfalls

1. **The input text reverts or is lost** (ZG/ARK, HUI, RA, BU, RK): the text is written
   from several places (selection change, close, blur, parent value) with no single owner.
   Fix: one rule — the text is a controllable value owned by the machine; it changes only
   on typing or at commit points (select, close/blur/Escape commit, parent value change
   while not dirty, collection label arriving while not dirty).
2. **Highlight leaks into selection** (`aria-selected` on the highlighted option, ZG#2947).
3. **VoiceOver silence or double speech** around activedescendant (cause B; browser-split).
4. **Opening from focus/restore**: opening on focus also fires on focus restore after a
   dialog closes and on VO cursor focus; Tab through a form must never select.
5. **IME**: Enter that commits a candidate selects/submits; filtering frozen until
   `compositionend` on Android; highlight moved mid-composition breaks Korean syllables.
6. **Stale async results** overwrite newer ones; highlight jumps while results stream.
7. **Flash while closing**: the list re-renders unfiltered (or empty) during the exit
   animation once the query is reset.
8. **Hide-outside on a non-modal popup** silences live regions and breaks the page.
9. **Form**: hidden input missing, duplicated name with the visible input, required not
   validated, autofill ignored, reset not restoring.

## Testing notes

- jsdom has no layout: page moves fall back to 10 (collections), positioning is not
  asserted; the IME runs (`isComposing`/`keyCode 229`) are DOM-only and run there too.
- The announcement parity invariant runs Apple+WebKit, Apple+Chromium and Windows
  platforms (once the quirk condition is narrowed).
- Driver must expose: `type(text)` (real key events per character, so `inputType` is
  `insertText`), `compose(text)` (IME sequence), `open(modality)`, `choose(name)`,
  `highlight(name)`, `pressEnter/Escape/Tab`, `clear()`, `removeChip(name)`, `blur()`;
  queries `inputValue()`, `value()` (selected names), `isOpen()`, `items()`,
  `highlighted()`, `isEmpty()`, `announcements()`.
- Async: a fake "server" in stories/tests resolving out of order proves the stale-result
  rule.

## Decisions

- **One shared capability, `combobox-pattern`** (specified in `add-combobox`, reused by
  the Combobox's free-text and inline modes (Autocomplete and Command, `add-combobox-variants`),
  Tags Input and later Mentions): input + listbox popup,
  open triggers, highlight while typing, inline completion, IME, async/stale results,
  empty state, announcements, virtualization, popup placement in the DOM. **Combobox**
  adds the selection value, text/selection reconciliation, custom values, multiple
  selection with chips and form participation. One machine (`combobox`) with
  `selectionMode: "single" | "multiple" | "none"`; Autocomplete is its `none` preset with
  the text as value (Base UI's design, confirmed in its source).
- **Parts**: Root, Label, Control (anchor; contains chips + input + buttons), Input,
  Trigger, ClearTrigger, Positioner, Popup, List (`listbox`), Item, ItemText,
  ItemIndicator, Group, GroupLabel, Separator, Empty, Chips, Chip, ChipRemove; generic
  `Portal` optional. Description / ErrorMessage come from Field later.
- **Machine** (answers machine-runtime open question 1 for Combobox: **no hierarchical
  states**): states `closed | open`. Zag's `idle/focused` is a `focused` context flag;
  `suggesting/interacting` is the collections' `highlightSource` (typing vs keyboard vs
  pointer). Events: `INPUT.CHANGE`, `INPUT.FOCUS`, `INPUT.BLUR`, `INPUT.PRESS`,
  `TRIGGER.PRESS`, `CLEAR.PRESS`, `NAVIGATE` / `HIGHLIGHT` / `POINTER_MOVE` (collections),
  `ENTER`, `ESCAPE`, `TAB`, `ITEM.PRESS`, `CHIP.REMOVE`, `CHIP.NAVIGATE`,
  `OUTSIDE_PRESS`, `COMPOSITION.START/END`, `COLLECTION.CHANGE`, `OPEN`, `CLOSE`,
  `$sync:open`, `$sync:value`, `$sync:inputValue`, `$reverted`.
- **Values**: three controllables — `value` (`string | null`, or `string[]` in multiple),
  `inputValue` (string), `open`. Text rules (Known pitfall 1): typing sets the text and
  marks it dirty; select writes the item's text (single) or clears it (multiple, default);
  commit on close/blur: dirty + text equals an item's text exactly → no change; dirty +
  `allowCustomValue` → keep text, single selection becomes `null` unless it matches;
  dirty + not allowed → revert to the selected text (or `""`); empty text at commit clears
  a single selection; a parent `value` change, or the selected label arriving with a late
  collection, rewrites the text only when not dirty.
- **Defaults**: `openOnInput: true`, `openOnArrow: true`, `openOnFocus: false`,
  `openOnInputPress: false`; `autoHighlight: false`; `autoComplete: "list"` (`"both"`
  opt-in); `loop: true`; `selectOnTab: false` (Tab never selects; HUI's
  focus-activation lesson generalised); `closeOnSelect: !multiple`; `allowCustomValue:
  false`; built-in locale `contains` filter, `filter: null` for consumer/async filtering;
  opening from the trigger or Arrow when the text equals the selection shows all items;
  popup rendered in place; `focusableWhenDisabled: false` for options (APG listbox
  allows either; filtering makes disabled options noise).
- **Keyboard**: per the spec (APG + Alt+Arrow, Home/End stay with the caret unless an
  option is highlighted, Left/Right clear the highlight, Backspace on empty input focuses
  / removes the last chip).
- **Escape**: open → close (removes an inline completion, text otherwise kept); closed and
  dirty → revert; closed and clean → not handled, so a surrounding dialog closes
  (dismissable-layer `preventDefault` rule; Kobalte's clear-on-Escape is destructive).
- **Open state is independent of the item count** (RA#5690 class): zero results hide the
  listbox and set `aria-expanded="false"`, but the machine stays `open`.
- **Async**: no fetching. `onInputValueChange` details carry an `AbortSignal` aborted when
  a newer query is emitted or the popup closes; the consumer passes `itemsQuery` (the
  query the current collection answers) and the machine ignores a collection whose
  `itemsQuery` is not the current query for highlight repair and count announcements;
  `loading` from collections drives `aria-busy` and a "Loading" announcement.
- **Announcements**: count (all platforms, keyed, debounced), "No results", highlight
  (Apple + WebKit), section entry and selection (Apple), all polite.
- **Chips** (multiple): Chips is `role="toolbar"` (BU#3629: NVDA stays in focus mode),
  chips roving; Backspace/Delete removes; chip remove buttons `tabindex=-1`. Chips are the
  shared `input-chips` capability owned by add-combobox, used by Combobox and Tags Input
  (not a Tag Group composition).
- **Form**: hidden input(s) through `hidden-form-input` (one per selected key in multiple
  mode — an extension requested from `add-checkbox`); the visible input has no `name`
  by default (`inputName` opt-in).
- **`data-*`**: per spec (root/control/input `data-state`, `data-focus(-visible)`,
  `data-disabled`, `data-readonly`, `data-invalid`, `data-placeholder-shown`; items from
  collections; popup/positioner placement from positioning; `data-empty` on list and
  popup; chip `data-highlighted`).
- **Contract**: collection fragment (`active-descendant`, `itemRole: "option"`, `select:
  "enter"`) + `type`, `compose`, `open`, `close`, `clear`, `removeChip`, `pressEscape`,
  `tabOut`, `blur`; queries `inputValue`, `value`, `isOpen`, `isEmpty`, `chips`;
  traits `composite-activedescendant` (all three announcements declared), `selectable`,
  `set-metadata`, `layer`, `presence`, `anchored`, `form-associated`.
- **Deliberately different**:

| Others | rind-ui | Why |
|---|---|---|
| Hierarchical or doubled states (Zag) | Flat `closed/open`, focus flag, highlight source | Graph stays small; runtime stays flat |
| Text written to the DOM imperatively (Zag, HUI) | Controlled input, text is a controllable | No races with React, IME-safe by rule |
| Effect-driven sync (React Aria) | Commit points as transitions | One callback per action; testable in Node |
| `aria-selected` omitted when false (Zag, AK, Bits) | Always explicit | VO/NVDA misreport |
| Hide outside on open (RA, Reka, BU non-modal) | Nothing hidden; popup in place | ARK#3699, RK#2240, RA#4937, BU#5528 |
| Apple-gated per-item announcement (RA/Zag/KB) | Apple + WebKit only; section/selection Apple; count everywhere | RA#10220/#10503 vs RA#10326; WCAG 4.1.3 |
| Escape while closed clears (Kobalte) | Reverts if dirty, otherwise propagates | Destructive; dialogs must close |

## Open questions

- HUI's "reset the input to trick VoiceOver" on open: not adopted; re-test with VO on the
  manual protocol and add a quirk entry only if VO still fails to read the value on open.
- React Aria's iPad "touch at the exact centre" heuristic: needs device testing before a
  quirk entry.
- Grid popups (Base UI `grid`, emoji pickers) wait for 2D navigation (Grid List).
