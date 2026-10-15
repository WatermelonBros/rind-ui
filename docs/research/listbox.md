# Listbox — research

Status: done · Wave: 2 (specified with Select, wave 1, because Select's popup **is** a
listbox: the list, option, section and selection parts are written once here and reused by
[select.md](select.md))

Covers the standalone listbox: an always-visible list of options with single, multiple or
no selection, sections, typeahead, select all, the `toggle` / `replace` selection
behaviours, actions, async loading and virtualization. Keys, navigation, selection rules,
typeahead and the virtualization contract are [collections.md](collections.md) and the
`add-collections` change; this note covers only what is listbox-specific: the parts, the
keyboard map of a selectable list, the behaviours, actions and the empty state.

Sources: shallow clones read 2026-10-14 (paths repo-relative; React Aria via
`git show HEAD:`): `zag/packages/machines/listbox/src/*`,
`react-spectrum/packages/react-aria/src/listbox/{useListBox,useOption,useListBoxSection}.ts`,
`react-spectrum/packages/react-aria-components/src/ListBox.tsx`,
`reka-ui/packages/core/src/Listbox/*`, `kobalte/packages/core/src/listbox/*`,
`headlessui/packages/@headlessui-react/src/components/listbox/*` (Headless UI's "Listbox" is
a select; see select.md). Bug history: `gh search issues` over the ten trackers, terms
`listbox`, `ListBox selection`, `listbox multiple`, `listbox shift`, `listbox typeahead`,
`listbox virtual`, `listbox empty`, `listbox section`, `listbox horizontal`.

## Pattern

- WAI-ARIA APG: [Listbox](https://www.w3.org/WAI/ARIA/apg/patterns/listbox/).
- Roles and attributes:
  - List: `role="listbox"`, a name (`aria-labelledby` → a visible label, or `aria-label`;
    a name is required), `aria-multiselectable="true"` in multiple mode,
    `aria-orientation="horizontal"` only when horizontal (vertical is implicit),
    `aria-busy` while loading, `aria-activedescendant` only in the active-descendant
    strategy (not used by rind's Listbox).
  - Option: `role="option"`, `aria-selected="true|false"` on every selectable option
    (explicit, never absent), `aria-disabled="true"`, `aria-setsize` / `aria-posinset`
    when not all options are in the DOM.
  - Groups: `role="group"` labelled by a `presentation` header (APG "Listbox with
    grouped options").
- Keyboard (APG): Down / Up move focus; Home / End first / last; typeahead (recommended
  for lists of more than seven options). Single select: selection may follow focus
  (optional). Multiple select, recommended model: Space toggles the focused option;
  Shift+Down / Shift+Up move and toggle; Shift+Space selects the contiguous range from the
  most recently selected option; Ctrl+Shift+Home / End select to the ends; Ctrl+A selects
  all. Alternative model (no modifier needed for a single option): arrows move and select,
  Ctrl+arrows move without selecting, Ctrl+Space toggles.
- Native counterpart: `<select size="n">` / `<select multiple>`. It cannot render rich
  options, sections other than `<optgroup>`, virtualized lists or actions
  ([native-platform.md](native-platform.md) §7).

## How the others built it

### Zag / Ark UI

- Source: `zag/packages/machines/listbox/src/{listbox.machine,listbox.connect,listbox.types}.ts`.
- API shape: `Root`, `Label`, `Content`, `Item`, `ItemText`, `ItemIndicator`,
  `ItemGroup`, `ItemGroupLabel`, `Input` (a filter field), `ValueText`, `Empty`. Props:
  `selectionMode: "single" | "multiple" | "extended"` (extended = desktop replace with
  modifiers), `selectOnHighlight`, `deselectable`, `disallowSelectAll`, `typeahead`,
  `loopFocus` (false), `orientation`, `scrollToIndexFn`, a `GridCollection` for 2-D
  layouts.
- State model: `idle | focused`; `value` and `highlightedValue` are bindables. The
  content keeps DOM focus with `aria-activedescendant` (`listbox.connect.ts:317`), so
  the Apple VoiceOver problem of cause B applies to a component that has no text field.
- Notable: `selectedItemMap` keeps items that left the collection (filtering), the
  `scrollToIndexFn` hook, the `Input` part reusing the same navigation.
- Problems: activedescendant everywhere; `extended` mixes the behaviour into the mode;
  the collection change is detected by `toString()` (collections.md).

### React Aria / React Aria Components (Kobalte is a port)

- Source: `useListBox.ts`, `useOption.ts`, `useListBoxSection.ts`, `ListBox.tsx`;
  `kobalte/packages/core/src/listbox/*`.
- API shape: `ListBox`, `ListBoxItem` (with `Text slot="label|description"`),
  `ListBoxSection` + `Header`, `ListBoxLoadMoreItem`; `selectionMode`,
  `selectionBehavior: "toggle" | "replace"`, `disallowEmptySelection`, `onAction`,
  `escapeKeyBehavior: "clearSelection" | "none"`, `shouldFocusWrap`, `shouldSelectOnPressUp`,
  `layout: "stack" | "grid"`, `orientation`, `renderEmptyState`, drag and drop,
  `Virtualizer`.
- State model: `useListState` + `SelectionManager`; roving real focus on options
  (`shouldUseVirtualFocus` only for Autocomplete). `replace` in single mode is
  "selection follows focus"; with `replace`, `onAction` runs on Enter and double click
  while Space/click select; touch and screen-reader presses toggle.
- Notable: the most complete behaviour model; options take their name from a label slot
  (`aria-labelledby`) and their description from `aria-describedby`; `aria-posinset` /
  `aria-setsize` only when virtualized; `data-empty`, `data-layout`, `data-orientation`.
- Problems: `aria-labelledby` on options makes WebKit read them as "text"
  (webkit 209279, assistive-tech note cause H); Escape clears the selection by default,
  which surprises users inside dialogs (see Bug history); the hidden-document
  collection builder (collections.md).

### Reka UI

- Source: `reka-ui/packages/core/src/Listbox/{ListboxRoot,ListboxContent,ListboxItem,ListboxFilter,ListboxVirtualizer}.vue`.
- API shape: `ListboxRoot` (`multiple`, `selectionBehavior` default `toggle`,
  `highlightOnHover`, `orientation`, `by`), `ListboxContent`, `ListboxItem`,
  `ListboxItemIndicator`, `ListboxGroup`, `ListboxGroupLabel`, `ListboxFilter`,
  `ListboxVirtualizer` (TanStack Virtual inside).
- State model: roving tabindex on items (`ListboxItem.vue:88`), with a "virtual focus"
  hook switched on when a `ListboxFilter` input owns focus — the roving /
  activedescendant duality inside one component.
- Problems: value equality through `by`/deep compare (O(n²), collections.md RK#1317).

### Headless UI, Radix, Base UI, Ariakit, Bits UI

No standalone listbox. Headless UI's `Listbox` is a select (button + popup), Base UI and
Radix have only `Select`, Ariakit composes `Composite` + `SelectList` (a `SelectList`
without a popover is an inline listbox), Bits UI has `Select` and `Combobox`.

### Reado (consumer)

No Ark listbox. Two hand-rolled `role="listbox"` surfaces that will migrate:
`organisms/SemanticModal.tsx` (a result list: `tabIndex=0` on the list, `<button
role="option">` rows, `aria-selected` used as the *cursor*, loading / error / empty
paragraphs rendered **inside** the listbox) and `organisms/Palette.tsx` (a command
palette — that one belongs to Command, not Listbox). SemanticModal is exactly the
`selectionMode="none"` + `onAction` case, and it shows the three mistakes the component
must make impossible: `aria-selected` as highlight (cause I), non-option children inside
`listbox` (axe `aria-required-children`), and a `button` inside an option role.

## Accessibility

Applies [accessibility.md](accessibility.md) §2, §4.2, §6, §9 and rules 1–24,
[assistive-tech-and-a11y-testing.md](assistive-tech-and-a11y-testing.md) causes B, H, I and
the "Combobox / listbox / autocomplete" paragraph of §1.4, and the Accessibility section
of [collections.md](collections.md) (one tab stop, explicit selection state, set
metadata, disabled items, focus loss). Listbox-specific:

- **Focus strategy: roving.** accessibility.md §4.2 lists the standalone Listbox among the
  roving components; Zag's activedescendant listbox is exactly the case where VoiceOver
  stays silent (cause B, ZG#2936) with no text field to justify it. Roving means no
  Apple announcer is needed.
- **Name required.** `listbox` requires a name: from the Label part (`aria-labelledby`) or
  `aria-label`. An unnamed list fails rule 1 in `testMachine` and warns in development
  (BU#5569 for the same bug in a combobox).
- **Option names from content, not `aria-labelledby`.** WebKit reads labelled options as
  "text" (cause H). An option with a description keeps its name from content by rendering
  the description part with `aria-hidden="true"` and pointing the option's
  `aria-describedby` at it: hidden content still contributes to a description through an
  IDREF (accname 1.2 §4.3.2 step 2B), and is excluded from name-from-content. One
  attribute, no WebKit path. (Manual protocol: confirm VO macOS/iOS read the
  description; fallback is to drop `aria-hidden` and accept the description in the name.)
- **Phrasing content in options**: `span`, not `div`, for item text and description, and
  never interactive elements (`button`, links) inside an option (BU#4435 TalkBack; Reado
  SemanticModal's `<button role="option">` is a role conflict).
- **Nothing but options and groups inside the list.** Loading, error and empty messages
  are not options; inside `role=listbox` they break `aria-required-children`
  (BU#5443). The empty part renders *after* the list, and the list references it with
  `aria-describedby` while empty so the reason is read when focus lands on the list.
- **Selection state** (cause I): `aria-selected` explicit on every selectable option,
  following the selection, never the highlight; `aria-multiselectable` in multiple mode;
  `selectionMode="none"` renders **no** `aria-selected` at all (options are not
  selectable, and `aria-selected="false"` would make NVDA say "not selected" on every
  row of an action list).
- **Selection follows focus** only by key: in single `replace` mode arrows select, but a
  screen-reader focus move with no key never does (rule 13, RX#1047 class).
- **Touch / virtual presses toggle** in multiple `replace` mode (collections
  selection-model), because those users have no modifier keys.
- **Forced colors**: selected must be visible without colour (`data-selected` → a check
  indicator or `Highlight`/`SelectedItem` system colours), highlight as an outline.
- **Target size**: option rows ≥ 24 × 24 CSS px in the theme (WCAG 2.5.8).
- **RTL**: horizontal lists mirror arrows (rule 17); typeahead and collation use the
  locale.
- **Escape**: a standalone listbox does nothing on Escape by default (APG defines none),
  so Escape keeps reaching the enclosing dialog (see Bug history).

## Bug history

Method: `gh search issues` over the ten trackers (terms in the header), every row read
with `gh issue view`; raw results in the session scratchpad. Rows from
[collections.md](collections.md) are not repeated except where a listbox scenario cites
them.

| Library | Issue | Symptom | Root cause | Fix / status | Lesson for rind-ui |
|---|---|---|---|---|---|
| Zag | [zag#3347 (closed)](https://github.com/chakra-ui/zag/issues/3347) | Shift+click selects the wrong range when `highlightOnHover` is on | Hover moves overwrite the highlighted value, which is also the range anchor | Closed (fixed) | Keep the selection anchor separate from the highlight/hover. |
| Zag | [zag#3273 (closed)](https://github.com/chakra-ui/zag/issues/3273) / [hui#3739 (closed)](https://github.com/tailwindlabs/headlessui/issues/3739) | Arrow-key navigation that scrolls the list lets a resting mouse steal the highlight | Content scrolling under the cursor fires `pointermove`/`pointerleave` that look like hover | zag: modality guard (after c15e7ec). hui: PR #3769 | Ignore pointer hover while modality is keyboard, or when the pointer has not actually moved. |
| Zag | [zag#1433 (closed)](https://github.com/chakra-ui/zag/issues/1433) | Multi-select value gets re-sorted when the list reopens | Collection sort mutated the value array in place | Fixed in PR #1434 | Never mutate the user's value array. Keep the order of selection. |
| React Aria | [rsp#10147 (open)](https://github.com/adobe/react-spectrum/issues/10147) | Shift+click range selection does not work in a multiple Select (works in ListBox) | Select stores a flat `Key[]` and rebuilds `Selection` each render, which loses `anchorKey` | PR #10150 merged then reverted, issue reopened | Range anchor is state. Do not rebuild it from the value array. |
| React Aria | [rsp#10720 (closed)](https://github.com/adobe/react-spectrum/issues/10720) | Home/End/PageUp/PageDown move focus but also scroll the page | Missing `preventDefault` after a keyboard-handler rewrite | Fixed in PR #10728 | `preventDefault` every navigation key you consume. |
| React Aria | [rsp#10129 (open)](https://github.com/adobe/react-spectrum/issues/10129) | Virtualized async ListBox: repeated End stops focusing or scrolling to the last item | Overscan/layout does not request the target rect for not-yet-loaded items | Open | Virtualization and keyboard navigation must agree on how far to scroll for unrendered keys. |
| React Aria | [rsp#10711 (open)](https://github.com/adobe/react-spectrum/issues/10711) | Virtualized filtered ListBox announces "14 of 2" | `aria-posinset` from the unfiltered index, `aria-setsize` from the filtered count | Open | Compute posinset and setsize from the same (filtered) collection. |
| React Aria | [rsp#10690 (open)](https://github.com/adobe/react-spectrum/issues/10690) | Opening with leading disabled options: the first enabled option is focused but left off-screen (StrictMode) | Scroll-into-view lost on the StrictMode remount | Open | Scroll-into-view must survive effect double-invocation. |
| React Aria | [rsp#9803 (open)](https://github.com/adobe/react-spectrum/issues/9803) | An empty ListBox keeps stealing focus from an input in the same popover | Empty collection still auto-focuses itself | Open | Empty state: do not grab focus, and let siblings keep it. |
| React Aria | [rsp#5837 (open)](https://github.com/adobe/react-spectrum/issues/5837) | Cannot disable a whole ListBox without listing every key | No `isDisabled` on ListBox | Open (contribution welcome) | Provide root-level `disabled` + `aria-disabled`. |
| React Aria | [rsp#10731 (open)](https://github.com/adobe/react-spectrum/issues/10731) | Every ListBoxItem re-renders on each parent render (1000 rows ≈ 40 ms), including in an open Select | No memoization of rows | Open (maintainers suggest Virtualizer or React Compiler) | Memoize rows on (item, selected, focused, disabled). |
| Headless UI | [hui#3856 (open)](https://github.com/tailwindlabs/headlessui/issues/3856) | Removing the active option while open crashes on the next key (`Cannot destructure 'dataRef'`) | Unregister reducer does not adjust `activeOptionIndex` | Open | Track the active item by key, not index, and re-validate when items unregister. |
| Headless UI | [hui#3838 (open)](https://github.com/tailwindlabs/headlessui/issues/3838) | `aria-activedescendant` is on the listbox, not the combobox button, so screen readers miss the focus moves | Focus model mismatch | Open | If DOM focus stays on the trigger, `aria-activedescendant` must be on the trigger. |
| Reka | [reka#1297 (closed)](https://github.com/unovue/reka-ui/issues/1297) | `multiple` + horizontal Listbox missing or wrong ARIA (`aria-multiselectable`, `aria-orientation`) | Attributes not emitted | Fixed in PR #1300 | Emit `aria-multiselectable` and `aria-orientation` from props. |
| Reka | [reka#1295 (closed)](https://github.com/unovue/reka-ui/issues/1295) | Horizontal Listbox: arrow keys do not navigate | Keymap hardcoded to vertical | Fixed in PR #1299 | Map arrow keys by orientation (and by RTL). |
| Reka | [reka#2056 (open)](https://github.com/unovue/reka-ui/issues/2056) | Listbox focuses its first item on mount, and `auto-focus=false` does not help | Highlight-on-mount logic calls `focus()` | Open | Never move focus on mount unless asked. |
| Reka | [reka#1808 (closed)](https://github.com/unovue/reka-ui/issues/1808) | Adding ListboxFilter breaks keyboard navigation | Focus lands on ListboxContent instead of staying in the filter input | Fixed in PR #2090 | With a filter input, keep DOM focus in the input and use activedescendant. |
| Reka | [reka#1288 (closed)](https://github.com/unovue/reka-ui/issues/1288) / [reka#1967 (closed)](https://github.com/unovue/reka-ui/issues/1967) | Virtualizer renders all items (no fixed-height scroller). In jsdom it renders 0 options | Virtualizer needs measured layout. jsdom has none | Docs added. jsdom: mock element sizes (TanStack/virtual#641) | Warn when the scroller has no bounded height. Document jsdom setup. |
| Reka | [reka#2904 (closed)](https://github.com/unovue/reka-ui/issues/2904) / [reka#2644 (closed)](https://github.com/unovue/reka-ui/issues/2644) | Virtualized rows keep stale attributes/`data-disabled` when options change | `v-memo` deps omit `$attrs` and `disabled` | Fixed in PRs #2905 and #2653 | Memo deps must cover every input of the row. |
| Reka | [reka#2911 (closed)](https://github.com/unovue/reka-ui/issues/2911) | Highlight changes do full DOM collection scans (60 highlights × 1000 options = 60k nodes) | `getItems().find()` instead of the existing element→item map | Fixed in PR #2912 | Index items by element and key. Avoid DOM queries in hot paths. |
| Ark | [ark#4006 (closed)](https://github.com/chakra-ui/ark/issues/4006) | Solid: `Listbox.ItemContext.selected` stays false after selection, while the DOM is correct | Context provided a snapshot, not a reactive accessor | Fixed in e607c502f (accessor `item().selected`) | Item state exposed to children must be reactive. |
| Ark | [ark#3642 (closed)](https://github.com/chakra-ui/ark/issues/3642) | `useListbox` did not seem to react to a filtered `collection` | Typing only (the getter form works) | Types fixed | Accept reactive or getter collections and type them. |
| Kobalte | [kobalte#340 (closed)](https://github.com/kobaltedev/kobalte/issues/340) | `virtualized` on Combobox.Root is not passed to the inner Listbox | Prop not forwarded | Closed (fixed) | Root-level options must reach the inner listbox. |
| Ariakit | [ariakit#7792 (closed)](https://github.com/ariakit/ariakit/issues/7792) | Virtualized list with variable-size items updates without end after measuring | Estimated offsets keep changing as measurements arrive, which re-triggers effects | Fixed in PR #7765 | Measurement feedback loops: make estimates stable or converge. |
| Ariakit | [ariakit#7777 (closed)](https://github.com/ariakit/ariakit/issues/7777) | Far keyboard move ends off-screen in a virtualized list inside a CSS-scaled container | Rendered positions mix scaled and layout px | Fixed in PR #7827 | Measure in layout px and handle `transform: scale` ancestors. |
| Zag | [zag#2947](https://github.com/chakra-ui/zag/issues/2947) (closed) | `aria-selected` on the highlighted option | Highlight and selection conflated | Fixed | `aria-selected` follows the selection only (spec scenario) |
| Headless UI / Radix | [hui#1599](https://github.com/tailwindlabs/headlessui/issues/1599), [radix#1907](https://github.com/radix-ui/primitives/issues/1907) | VO reads every option as selected / NVDA reads no state | `aria-selected` absent on unselected options (Radix: `isSelected && isFocused`) | HUI fixed; Radix contested | Explicit `"true"`/`"false"` (spec scenario) |
| Base UI | [base-ui#5443](https://github.com/mui/base-ui/issues/5443) | axe `aria-required-children` on the list | `role=status` (empty/loading) rendered inside `listbox` | Fixed | `empty` part outside the list (spec scenario) |
| Base UI | [base-ui#5569](https://github.com/mui/base-ui/issues/5569) | Listbox without a name | No label wiring | Fixed | Name required; dev warning + rule 1 (spec scenario) |
| Base UI | [base-ui#4435](https://github.com/mui/base-ui/issues/4435) | TalkBack cannot swipe onto options | `div` wrapper inside `role=option` | Fixed | Phrasing content in options |
| React Aria | [rsp#7947](https://github.com/adobe/react-spectrum/issues/7947) (closed) | Controlled `new Set()` breaks Shift+click and ⌘A | Anchor stored on the `Selection` value | Usage answer | Anchor in machine context (spec scenario) |

## Known pitfalls

1. `aria-selected` used as the highlight or cursor (Zag#2947, Reado SemanticModal).
2. Activedescendant on a list that has no text field: silent in VoiceOver.
3. Non-option content (status, empty, loading rows, buttons) inside `role=listbox`.
4. Shift ranges and select all broken by the controlled value (anchor stored on the value;
   collections.md RA#7947 / #10147).
5. Escape clearing the selection or being swallowed instead of closing the dialog around
   the list.
6. Option names that include the description, or options labelled with
   `aria-labelledby` (WebKit "text").
7. Virtualized lists: setsize/posinset stale after filtering, typeahead and End limited to
   mounted rows (collections.md).

## Testing notes

- The collection modules carry most of the behaviour and are tested in Node
  (`add-collections`); the Listbox adds keyboard-map, behaviour and action tests.
- jsdom has no layout: PageUp/PageDown use the 10-item fallback; browser mode tests real
  paging.
- Contract: the collection fragment (`highlight`, `choose`, `toggle`, `chooseRange`,
  `selectAll`, `typeahead`; `items`, `highlighted`, `selected`, `isDisabled`,
  `focusedItem`) plus `act(name)` (onAction) and `isEmpty()`. Traits:
  `composite-roving`, `selectable` (unless `selectionMode="none"`), `set-metadata`
  (when virtualized), `directional` (horizontal).
- Model classes: single toggle, single replace, multiple toggle, multiple replace, none +
  action, horizontal RTL, and the collection argument classes (empty, all disabled…).

## Decisions

- **Parts** (`scope: "listbox"`): `root` (no element; service and context), `label`
  (`span`), `list` (`div`, `role=listbox`), `item` (`div`, `role=option`), `item-text`
  (`span`), `item-description` (`span`, `aria-hidden`), `item-indicator` (`span`,
  `aria-hidden`), `section` (`div`, `role=group`), `section-label` (`span`),
  `separator` (`div`, `role=separator`), `empty` (`div`, after the list),
  `load-more` (sentinel, `aria-hidden`). The parts `list` … `load-more` are the
  **listbox parts** reused by Select's popup.
- **Machine**: `idle | focused` (the collections fixture graph), plus the collection events
  (`NAVIGATE`, `HIGHLIGHT`, `POINTER_MOVE`, `TYPEAHEAD`, `SELECT`, `SELECT_ALL`,
  `CLEAR_SELECTION`, `COLLECTION.CHANGE`), `ACTION { key }`, `$sync:value`, `$reverted`.
  The listbox-specific pieces (keyboard map for a selectable list, the `replace`
  navigation-selects rule, `onAction` routing) are exported as a reusable fragment the
  Select machine spreads.
- **Props**: `selectionMode` (`single` default | `multiple` | `none`),
  `selectionBehavior` (`toggle` default | `replace`), `disallowEmptySelection`,
  `value`/`defaultValue`/`onValueChange` (`string | null` single, `string[] | "all"`
  multiple), `onAction`, `focusableWhenDisabled` (false), `loop` (false),
  `orientation` (`vertical`), `typeahead` (true), `collection`, `loading`,
  `onLoadMore`, `virtualized`, `scrollToIndex`, `disabled`.
- **Keyboard**: collections' logical moves; Space and Enter select (single) / toggle
  (multiple, `toggle`); `replace`: arrows select, mod+arrows move only, mod+Space
  toggles, Shift+arrows / Shift+click extend; Shift+Space extends from the anchor;
  mod+A selects all (multiple); Escape: nothing. With `selectionMode="none"`, Enter and
  press call `onAction`; with `replace`, Enter and double click call `onAction`.
- **`data-*`**: collections' item/list/section attributes, plus `data-selection-mode`,
  `data-orientation` on the list, `data-disabled` on the root-level parts, `data-empty`
  on `list` and `empty`.
- **Contract**: `listboxContract` = collection fragment + `act(name)` + `isEmpty()`,
  located by role `listbox` and exact name.
- **Deliberately different**:

| Others | rind-ui | Why |
|---|---|---|
| Activedescendant listbox (Zag) | Roving | VoiceOver silent without an announcer; no text field to keep focus in |
| `selectionMode: "extended"` (Zag) | `selectionBehavior` separate from mode (RA) | Two independent choices; four combinations tested |
| Escape clears selection (RA default) | Escape does nothing | APG defines no Escape; keeps Escape for the enclosing layer |
| Option name via `aria-labelledby` (RA, Kobalte) | Name from content; description `aria-hidden` + `aria-describedby` | WebKit 209279 |
| Empty state inside the list (RA `renderEmptyState`) | `empty` part after the list, referenced while empty | `aria-required-children` |

## Open questions

- Grid layout (`layout="grid"`, 2-D navigation) waits for Grid List (collections defers
  grid navigation). Drag and drop reordering is a separate change.
