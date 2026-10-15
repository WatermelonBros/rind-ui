# Command — research

Status: done · Wave: 2

A command palette: a text input that filters an **always-visible** list of actions, usually
inside a modal dialog opened by an app shortcut (⌘K). Choosing an item runs its action; nothing
is selected. It is the `combobox-pattern` of [combobox.md](combobox.md) without a popup —
React Aria calls it Autocomplete + ListBox/Menu, Base UI an `inline` Autocomplete, cmdk /
Bits UI a Command. Everything about the input + listbox relation (activedescendant, typing
highlight lag, IME, async, empty state, set metadata, announcements) is already specified by
`add-combobox`; this note covers how Command differs and the bugs specific to palettes.

Sources read (2026-10-14, read-only):

| Library | Files |
|---|---|
| cmdk (`dip/cmdk`, formerly `pacocoursey/cmdk`; shadcn's `Command`) | `cmdk/src/index.tsx` @ `main` (fetched through the GitHub API), `command-score.ts` |
| Bits UI | `packages/bits-ui/src/lib/bits/command/{command.svelte.ts,compute-command-score.ts,types.ts,components/*}` (a cmdk port, plus grid `columns`, `LinkItem`, `Viewport`) |
| React Aria | `packages/react-aria/src/autocomplete/useAutocomplete.ts` (sparse clone), `react-aria-components/src/Autocomplete.tsx` |
| Base UI | `autocomplete/root/AutocompleteRoot.tsx`, `combobox/root/AriaCombobox.tsx` (`inline`), docs demo "command palette" |
| Ariakit | `components/command.md` (an abstract *command-role* clickable — **not** a palette), `examples/dialog-combobox-command-menu/*`, `examples/dialog-combobox-tab-command-menu/*` |
| Reka UI | `Listbox/ListboxFilter.vue` (a filter input for a standalone Listbox) |
| Kobalte, Ark/Zag, Radix, Headless UI | no palette (Kobalte #224 is an open request) |

components.md marks Ariakit as shipping Command: its `Command` is the ARIA `command`
abstract role helper (Button's base), so the palette comparison uses its Dialog + Combobox
example instead.

## Pattern

- WAI-ARIA APG: no palette pattern. The closest is
  [Combobox](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/) with list autocomplete
  ("Editable Combobox With List Autocomplete"), kept permanently expanded — exactly the
  shape cmdk, Bits, Base UI (`inline`) and Ariakit produce. React Aria instead leaves the
  input a plain `textbox`/`searchbox` with `aria-controls` + `aria-activedescendant` and
  no `role="combobox"`.
- Roles: input `role="combobox"`, `aria-autocomplete="list"`, `aria-expanded` (true while
  the list has options), `aria-controls` → listbox, `aria-activedescendant` → highlighted
  option; `listbox` with a name; `option`s; `group` per section labelled by its heading;
  the dialog around it has its own name.
- Keyboard (from the combobox pattern, minus opening/closing): ArrowDown/ArrowUp move the
  highlight (wrapping, as every palette does), Enter runs the highlighted item, Escape
  clears the query then closes the enclosing dialog, Tab leaves, typing filters,
  Left/Right/Home/End edit the text. PageUp/PageDown move by a page (cmdk users asked for
  it, cmdk#341).

## How the others built it

### cmdk (and shadcn/ui's `Command`)

- Parts: `Command` (root, `label`, `shouldFilter`, `filter(value, search, keywords) →
  number`, `value`/`onValueChange` = the **highlighted** item, `loop`,
  `disablePointerSelection`, `vimBindings` default true), `Input`, `List` (listbox,
  `label` default "Suggestions"), `Item` (`value`, `keywords`, `onSelect`, `disabled`,
  `forceMount`), `Group` (`heading`), `Separator`, `Empty`, `Loading` (`progress`),
  `Dialog` (a Radix Dialog with `aria-label`).
- State: a `useSyncExternalStore` store; items register through context and are scored by
  `command-score` (Superhuman's fuzzy scorer: word jumps, transpositions, case penalty);
  **sorting moves DOM nodes with `appendChild`** behind React's back and groups are sorted
  by their best item. The highlighted item is found by querying `[aria-selected="true"]`
  in the DOM.
- Notable: the first item is highlighted at mount and after every query change; keywords
  join the matched string; Alt+Arrow jumps groups, ⌘+Arrow to the ends; IME guard on Enter
  (`isComposing || keyCode === 229`, cmdk#206).
- Problems: `aria-selected` marks the highlight, not a selection (cmdk#83 — and `false`
  was never emitted); `aria-activedescendant` missing at mount and stale after filtering
  (cmdk#413, #373, #253, #139 — the DOM read-back runs before React commits); `separator`
  and `progressbar` as listbox children (cmdk#179); listbox labelled twice (cmdk#196);
  `Home`/`End` stolen from the input (cmdk#341); sort order not restored after clearing
  (cmdk#264, #375, #161); scroll to a stale item (cmdk#389, #233); a portalled `List`
  loses keyboard (cmdk#95); `Command.Dialog` without a title (cmdk#393).

### Bits UI

- A port of cmdk with the same API and scorer (`compute-command-score.ts`), plus `columns`
  for grids, `LinkItem`, `Viewport`, `GroupItems`; root `role="application"` (!) with
  `tabindex=-1`; Home/End move the highlight; Ctrl+N/J/P/K vim bindings.
- Problems inherited from the DOM-sorting design: items out of order after clearing
  (BITS#1241, closed by re-keying), arrows dead after an empty result until the query is
  cleared (BITS#996), `Empty` never shows (BITS#982), Ctrl+K moving the highlight because
  of vim bindings (BITS#1067), click resetting the highlight to the first item (BITS#2063,
  open), keybindings not configurable (BITS#1129).

### React Aria (Autocomplete + ListBox / Menu / GridList / TagGroup)

- `useAutocomplete` connects a SearchField/TextField to **any** collection component through
  context: `aria-controls`, `aria-activedescendant` (virtual focus), `enterKeyHint="go"`,
  `aria-autocomplete="list"`; keys typed in the input are **re-dispatched as synthetic
  events** on the collection or the focused item (Enter becomes a synthetic `click`).
  Filtering is a boolean `filter(textValue, inputValue, node)`; no sorting.
- Clever (and already in `combobox-pattern`): 500 ms activedescendant delay after forward
  typing; `inputType`-based forward-typing detection; Left/Right clear the virtual focus
  "so NVDA announcements aren't interrupted"; virtual focus disabled for **mobile screen
  readers** (`modality === "virtual"` on iOS/Android) — real focus moves into the list.
- Home/End/PageUp/PageDown go to the collection when an item has virtual focus (Shift+Home
  with no item selects text).
- Problems: no VoiceOver announcer (RA#10326, open); posinset > setsize after filtering a
  virtualized list (RA#10711, open); the synthetic Enter click fires twice through a router
  link (RA#9431, open) and loses ⌘/Ctrl for "open in new tab" (RA#8992); CJK and paste
  first-item focus (RA#10126, RA#10279); focus state lost after hovering (RA#8198);
  Autocomplete cannot filter a Tree (RA#10664, open).

### Base UI (Autocomplete `inline`)

- `<Autocomplete.Root inline open>` inside a Dialog: the same `AriaCombobox` engine as the
  popup, with `expanded = open || inline` (so `aria-expanded="true"`), dismissal disabled,
  and **Escape bubbling** (`bubbles: inline`) so the enclosing dialog closes. A kept-mounted
  dialog hides the inline list on close and drops query restoration.
- Problems (all from the command-palette demo): VoiceOver never announces the input because
  virtual focus sat on the first option when the dialog opened (BU#4247, fixed by focusing
  the input and describing the shortcuts, BU#4248); highlight shown by colour only
  (BU#4182, open); no persistent visible label (BU#4183); Ctrl+N/P requested and reverted
  (BU#5146, open: "document custom shortcuts in app code").

### Ariakit (Dialog + Combobox example)

- `Dialog` + `ComboboxProvider disclosure={dialog}` (combobox open state = dialog open state),
  `autoSelect="always"` (first item active), `focusOnHover` + `blurOnHoverEnd={false}` (pointer
  highlight sticks), a visible `DialogDismiss` "Esc" button. **Ranking is the app's**: the
  example uses `match-sorter` and renders the sorted array.

### Reka UI

- `ListboxFilter` is an input that drives a standalone Listbox with activedescendant —
  the same idea as React Aria. RK#1752: the filter broke Listbox keyboard navigation
  (fixed). RK#2805 (open): IME support configurable.

## Accessibility

Applies [accessibility.md](accessibility.md) (§4.2: Command is an activedescendant
composite; §6 IME; §7 announcer) and the "Combobox / listbox / autocomplete" row of
[assistive-tech-and-a11y-testing.md §1.4](assistive-tech-and-a11y-testing.md#14-by-component-pattern):
cause B dominates — VoiceOver in Safari is silent on activedescendant changes, so the
Apple announcer of `combobox-pattern` is mandatory (RA#10326 is what happens without it).
Palette-specific points:

- **Focus on open goes to the input**, never to an option (BU#4247): the dialog's initial
  focus rule lands on the input as the first tabbable element. The first item may be
  *highlighted* at once, but its id should reach `aria-activedescendant` only through the
  typing-highlight lag, so the screen reader reads the dialog name, the input name and the
  count first.
- **No selection semantics**: options carry `aria-selected="false"` (as Autocomplete; cmdk
  using `aria-selected` for the highlight is ZG#2947's bug class, cmdk#83).
- **`aria-expanded`**: `true` while options are exposed; `false` when the list is empty
  (the pattern's empty-state rule). A consumer handling Escape by looking for an expanded
  combobox (cmdk#316) gets a coherent answer because Command leaves Escape unhandled once
  the query is empty.
- **Listbox children**: only options and groups; separator `role="none"`, loading and empty
  content outside the listbox (cmdk#179; mui/base-ui#5443).
- **Group headings**: `group` labelled by its heading (`aria-labelledby`), the heading is not
  an option and not counted. cmdk `aria-hidden`s the heading and uses it only as the
  group's label — fine, but no need to hide it.
- **Names**: the dialog (Title or `aria-label`), the input (Label part or `aria-label`), the
  listbox (Label, else the `listboxLabel` message — not hard-coded English, cmdk#196).
  Shortcut hints shown in the footer belong in the input's `aria-describedby` (BU#4248).
- **Highlight visible without colour** (WCAG 1.4.1 / 1.4.11, BU#4182): the theme draws an
  outline on `[data-highlighted][data-focus-visible]` and keeps it under forced colors.
- **Mobile screen readers**: VoiceOver iOS / TalkBack swipe through the options; options
  stay activatable by a bare `click` (virtual modality). React Aria's move of real focus
  into the list for mobile SRs is not adopted (the pattern keeps one model; revisit with
  device testing — Open questions).
- **On-screen keyboard** (cmdk#127): focusing the input on a touch open raises the keyboard
  over the list. The dialog's rule already focuses the *content* when opened by touch;
  Command does not autofocus on its own.
- **Native**: nothing native does this (`<datalist>` is a popup). The dialog part comes from
  add-dialog.

## Bug history

Search 2026-10-14: `dip/cmdk` (screen reader, aria, IME, sort, keywords, scroll, dialog
focus, performance, Home End), `huntabyte/bits-ui` (command, Command.Input),
`adobe/react-spectrum` (Autocomplete, command palette), `mui/base-ui` (autocomplete inline,
command palette), `ariakit/ariakit` (command menu), `unovue/reka-ui` (listbox filter),
`shadcn-ui/ui` (CommandDialog), `kobaltedev/kobalte` and `chakra-ui/ark` (command palette:
only a feature request). Every row below was read in full. Combobox and Autocomplete rows
in [combobox.md](combobox.md) and [autocomplete.md](autocomplete.md) apply too.

| Library | Issue | Symptom | Root cause | Fix / status | Lesson for rind-ui |
|---|---|---|---|---|---|
| cmdk | [#413](https://github.com/dip/cmdk/issues/413) open, [#373](https://github.com/dip/cmdk/issues/373) open | `aria-activedescendant` absent at mount; after filtering it names a row other than the highlighted one Enter runs | Id read back from the DOM in a scheduled callback before React commits | Patch in comments | Active descendant derived from the machine's key, in the same render |
| cmdk | [#253](https://github.com/dip/cmdk/issues/253), [#139](https://github.com/dip/cmdk/issues/139), [#142](https://github.com/dip/cmdk/issues/142), [#92](https://github.com/dip/cmdk/issues/92) closed | Arrowing announces nothing | Missing ids / stale memo for `aria-activedescendant` | PR #108 etc. | Same; plus the Apple announcer (cause B) |
| cmdk | [#83](https://github.com/dip/cmdk/issues/83) closed | `aria-selected` is `true` or absent, never `false` | `||` instead of `??`; `aria-selected` used for the highlight | Fixed `false`; still highlight | `aria-selected="false"` always; highlight is `data-highlighted` |
| cmdk | [#179](https://github.com/dip/cmdk/issues/179) open | axe: `separator` and `progressbar` not allowed in `listbox` | Separator and Loading rendered inside the listbox | Open | Separator `role="none"`; Loading outside the listbox |
| cmdk | [#196](https://github.com/dip/cmdk/issues/196) closed | Listbox labelled "Suggestions" in English and by `aria-labelledby` at once | Hard-coded label + overriding labelledby | Prop added | Name from Label, else `messages.listboxLabel` |
| cmdk | [#316](https://github.com/dip/cmdk/issues/316) closed | Inline palette in a modal: `aria-expanded="true"` confuses app Escape logic | Always-expanded input | Answered | `aria-expanded` follows exposure; Escape unhandled when nothing to clear |
| cmdk | [#393](https://github.com/dip/cmdk/issues/393) open, [#337](https://github.com/dip/cmdk/issues/337) closed | `Command.Dialog` warns: dialog without title | Wrapper passes only `aria-label` | Open | Recipe uses add-dialog's naming rule; a hidden Title is the documented default |
| cmdk | [#95](https://github.com/dip/cmdk/issues/95) closed | Portalled `List` loses arrow keys and Enter | Items queried under the root element | Fixed via context | Items are keys in the machine, never DOM queries |
| cmdk | [#264](https://github.com/dip/cmdk/issues/264), [#375](https://github.com/dip/cmdk/issues/375), [#161](https://github.com/dip/cmdk/issues/161) open | After clearing the query the list stays in search order; ungrouped items sorted to the bottom | Sorting moves DOM nodes; empty query skips the re-sort | Open (workaround: remount list) | No DOM reordering; ranking is a data derivation by the consumer; empty query = original order |
| Bits UI | [BITS#1241](https://github.com/huntabyte/bits-ui/issues/1241) closed | Items out of order after clearing the search | Same DOM-sorting design | Re-keyed | Same |
| cmdk | [#260](https://github.com/dip/cmdk/issues/260) closed | Cannot filter without sorting | One flag for both | Not possible | Filter and order are separate: built-in filtering never reorders |
| cmdk | [#74](https://github.com/dip/cmdk/issues/74) open, [#240](https://github.com/dip/cmdk/issues/240) closed | Search matches the item's `value` id, not its visible label | `value` doubles as id and search text | Workaround | Key and text value are separate (collections) |
| cmdk | [#146](https://github.com/dip/cmdk/issues/146) closed | Synonyms ("delete", "trash") for "Remove" | No keywords | `keywords` prop added | Keywords are part of the item model and matched by the default filter |
| cmdk | [#173](https://github.com/dip/cmdk/issues/173) open | "é" does not match "e" | Scorer is not locale/diacritics aware | Open | Locale-aware, accent-insensitive `contains` (collections) |
| cmdk | [#191](https://github.com/dip/cmdk/issues/191) closed | 4 s input lag on delete with ~100 items | Scoring and DOM sorting in layout effects | Workaround `filter={() => 1}` | Filtering O(n) per query in a memoised derivation; 10k items budget |
| cmdk | [#341](https://github.com/dip/cmdk/issues/341) closed | Home/End cannot move the caret; PageUp/PageDown missing | Palette maps Home/End to first/last item | Workaround `stopPropagation` | Home/End edit the text (pattern); PageUp/PageDown move by a page |
| cmdk | [#206](https://github.com/dip/cmdk/issues/206) closed | Japanese Enter in Safari runs the item | Only `isComposing` checked | `keyCode === 229` added | IME guard (a11y-foundations) |
| cmdk | [#348](https://github.com/dip/cmdk/issues/348) closed | Korean: ArrowDown moves two items | Composition delivers two keydowns | Composition tracking | Arrows ignored while composing |
| cmdk | [#363](https://github.com/dip/cmdk/issues/363) open | Search runs on every preedit change | Query updated during composition | Open | Pattern: query updates live (soft keyboards) but highlight/announce wait; `composing` in change details lets async consumers wait |
| cmdk | [#389](https://github.com/dip/cmdk/issues/389) open, [#233](https://github.com/dip/cmdk/issues/233) closed | List scrolls to a stale item after the query changes | Scroll target read from the DOM before commit | Workaround: scroll to top on change | Query change resets the scroll to the top in the same render as the results |
| cmdk | [#405](https://github.com/dip/cmdk/issues/405), [#317](https://github.com/dip/cmdk/issues/317) open | Mounting scrolls the whole page to the palette | `scrollIntoView` of the first item on mount | Open | Mount does not scroll; only keyboard navigation scrolls, within the list (nearest scroller) |
| cmdk | [#3](https://github.com/dip/cmdk/issues/3) closed | List scrolls under the mouse | Pointer highlight scrolled into view | Fixed | Pointer highlight never scrolls (pattern) |
| cmdk | [#49](https://github.com/dip/cmdk/issues/49) open | Resting mouse steals the keyboard highlight while scrolling | Hover = highlight with no movement check | `disablePointerSelection` | Pointer highlight only on real movement (collections pointer guard) |
| cmdk | [#97](https://github.com/dip/cmdk/issues/97) closed, [#280](https://github.com/dip/cmdk/issues/280) open | Appended async items reset the highlight to the first; first item not highlighted after async results | Highlight reset on any item change / index-based | Partially | Repair by key; auto highlight only on a query change, not on more results |
| Bits UI | [BITS#996](https://github.com/huntabyte/bits-ui/issues/996) closed | After a no-match query, arrows dead until the query is fully cleared | Highlight value stuck on a hidden item | Fixed | When options return, the first is highlighted again (auto highlight on results for the current query) |
| Bits UI | [BITS#982](https://github.com/huntabyte/bits-ui/issues/982) closed | `Empty` never shows with an empty list | Empty keyed to a search count | Fixed | Empty shown whenever the derived results are empty, query or not |
| Bits UI | [BITS#2063](https://github.com/huntabyte/bits-ui/issues/2063) open | Clicking an item resets the highlight to the first item | Selection handler re-runs "select first" | Open | Running an action does not move the highlight |
| Bits UI | [BITS#1067](https://github.com/huntabyte/bits-ui/issues/1067) closed, [BITS#1129](https://github.com/huntabyte/bits-ui/issues/1129) closed; BU [#5146](https://github.com/mui/base-ui/issues/5146) open | Ctrl+K (the app's open shortcut) moves the highlight; users want own bindings | Vim bindings on by default | Fixed / documented | No vim bindings; extra keys are the consumer's, through the documented `navigate` API |
| cmdk | [#353](https://github.com/dip/cmdk/issues/353) closed | Enter in a Select inside the palette's dialog runs the palette item | Keydown handled on the root for any target | Workaround `stopPropagation` | Keys are handled on the input only |
| cmdk | [#368](https://github.com/dip/cmdk/issues/368) open | Typing in a second input focuses the first | Root forces focus on "the" input | Open | Command never moves focus itself |
| cmdk | [#127](https://github.com/dip/cmdk/issues/127) closed | Palette opened on a phone: keyboard covers the list | Input autofocus on touch | Consumer workaround | No own autofocus; dialog focuses content on a touch open |
| cmdk | [#85](https://github.com/dip/cmdk/issues/85) closed | A tap does not run an item on mobile | Selection only on pointer-move highlight | Fixed | Activation on press release / `click` (pattern) |
| React Aria | [RA#10326](https://github.com/adobe/react-spectrum/issues/10326) open | VoiceOver silent while arrowing in Autocomplete | No announcer in `useAutocomplete` | Open | Command spreads the pattern's announcer |
| React Aria | [RA#10711](https://github.com/adobe/react-spectrum/issues/10711) open | `aria-posinset` > `aria-setsize` after filtering a virtualized ListBox | Metadata from the unfiltered collection | Open | Pattern set metadata on the derived results |
| React Aria | [RA#9431](https://github.com/adobe/react-spectrum/issues/9431) open, [RA#8992](https://github.com/adobe/react-spectrum/issues/8992) closed | Enter on a link item navigates twice; ⌘/Ctrl+Enter ignored | Synthetic events re-dispatched to the item | Open / fixed | No re-dispatch: Enter activates a link item once with the real modifiers |
| React Aria | [RA#10126](https://github.com/adobe/react-spectrum/issues/10126) closed | CJK input never highlights the first item | Only `insertText` counted as typing | PR #10156 | Pattern rule |
| Base UI | [BU#4247](https://github.com/mui/base-ui/issues/4247) closed | Palette input never announced; virtual focus on the first option at open | Highlight exposed before the input was focused/announced | PR #4949: focus the input, describe shortcuts | Initial highlight lags `aria-activedescendant` like a typing highlight |
| Base UI | [BU#4248](https://github.com/mui/base-ui/issues/4248) closed, [BU#4183](https://github.com/mui/base-ui/issues/4183) closed | Footer shortcuts and placeholder-only label not announced | Visual-only text | Docs fix | Shortcut hints via a Description part in `aria-describedby`; a Label (visible or hidden) is required |
| Base UI | [BU#4182](https://github.com/mui/base-ui/issues/4182) open | Highlight shown by colour alone | Theme | Open | Theme outline on keyboard highlight, forced-colors rule |
| Reka | [RK#1752](https://github.com/unovue/reka-ui/issues/1752) closed | Adding the filter input broke listbox keyboard navigation | Two focus owners | Fixed | One owner: the input; the list is never tabbable |
| shadcn | [shadcn#1351](https://github.com/shadcn-ui/ui/issues/1351) closed, [shadcn#2652](https://github.com/shadcn-ui/ui/issues/2652) closed | Palette flickers on open/close; async results only visible while the dialog closes | cmdk store + dialog presence remount; DOM sorting vs async items | Stale | Command state lives in a machine, results are a derivation, no DOM work on presence |

## Known pitfalls

1. **DOM reordering** (cmdk, Bits): sorting by moving nodes fights the framework and breaks
   order restore, async items and highlight lookups. Never reorder the DOM; never read the
   highlight back from it.
2. **Initial virtual focus hides the input** from screen readers (BU#4247) and, if scrolled
   into view on mount, scrolls the page (cmdk#405).
3. **Keys stolen from the input**: Home/End (cmdk#341), Ctrl+K/N/P (BITS#1067), Enter from
   other controls (cmdk#353).
4. **`aria-selected` as highlight** and invalid listbox children (cmdk#83, #179).
5. **Search text vs value** (cmdk#74): filtering must use the visible text plus keywords.
6. **Scroll after query change** to a stale target (cmdk#389) and no reset to top.
7. **Dialog naming and Escape**: wrapper dialogs without a name (cmdk#393); an Escape that
   both clears and closes.

## Testing notes

- Everything the combobox pattern tests applies (IME replays, typing lag with fake timers,
  Apple/WebKit vs Windows announcement runs, virtual modality).
- Command-specific: mount state (first item highlighted, no `aria-activedescendant` until
  the lag, no scroll), query → results → highlight first, Escape clear-then-close inside
  add-dialog, Backspace on empty query → `onBack`, link items with ⌘/Ctrl+Enter, no DOM
  reordering (a list ranked by the consumer renders in the given order).
- Driver: `type`, `compose`, `run(name)` (pointer press, or navigate + Enter), `back()`,
  `pressEscape()`; queries `inputValue()`, `items()` (listed names in order),
  `highlighted()`, `isEmpty()`, `isLoading()`, `announcements()`.

## Decisions

- **Machine**: its own `command` machine with **one state** (`active`), spreading
  `combobox-pattern`'s actions, guards and connect helpers with the popup-only rules
  switched off (no open/close, no overlay, no positioning, no commit). Not the combobox
  machine with a flag: Command has no selection, no commit, no `closed` state, and adds
  pages and actions.
- **Parts** (`data-scope="command"`): Root, Label, Input, Description (shortcut hints), List,
  Item, ItemText, ItemDescription, Group, GroupLabel, Separator, Empty, Loading. The list
  parts are add-listbox's reusable listbox parts. No Trigger, Popup, Positioner, Chips.
- **Dialog**: no `Command.Dialog` part. A documented composition `Dialog.Root > Dialog.Content
  > Command.Root` with a (visually hidden) `Dialog.Title`; initial focus lands on the input
  through add-dialog's rule; on touch opens the dialog focuses its content. Opening
  shortcuts are the app's.
- **Values**: `inputValue` (controllable query), `onAction(key, details)` (root) and `onAction`
  per item; no `value`/selection. The highlight is not a controllable (cmdk's `value`);
  `navigate(move)` / `highlight(key)` are exposed on the API for app keybindings.
- **Highlight**: `autoHighlight` default **true**: the first navigable option is highlighted at
  mount and after every query change (source `typing`, so `aria-activedescendant` follows
  after the pattern's lag); loop default true; pointer highlight kept on leave
  (`keepHighlight` default true, Ariakit/cmdk).
- **Filtering**: the pattern's locale-aware `contains` over text value **and keywords**
  (request to add-collections), or a consumer matcher, or `filter: null`. **No built-in
  ranking or reordering**: order is the collection's; ranked palettes pass a ranked
  collection with `filter: null` (Ariakit's match-sorter approach). Empty query = original
  order by construction.
- **Keys**: ArrowUp/Down (loop), PageUp/PageDown, Enter (run; IME-guarded; link items
  activate natively once, with modifiers), Escape (clear a non-empty query, else unhandled
  so the dialog closes), Backspace on an empty query with the caret at the start →
  `onBack` (nested pages), Home/End/Left/Right edit text, Tab leaves.
- **Pages**: consumer state; Command takes `page` (`{ key, label }`, read-only binding):
  a change clears the query, highlights the first item, resets the scroll and announces
  `pageAnnouncement(label)`.
- **Empty / Loading**: pattern empty state (Empty outside the listbox, `aria-expanded`
  false); Loading part outside the listbox, visible while the collection status is
  `loading`, no role of its own (the announcer speaks `loading` once).
- **`data-*`**: root `data-empty`, `data-loading`, `data-page`; input `data-focus`,
  `data-focus-visible`, `data-disabled`; list/items/groups the collection attributes
  (`data-highlighted`, `data-disabled`, `data-focus-visible`); Empty/Loading `data-part`.
- **Contract**: pattern contract minus `open`/`close`; `run(name)`, `back()`; queries
  `items()`, `highlighted()`, `page()`; traits `composite-activedescendant`, `set-metadata`
  (not `selectable`, `layer`, `presence`, `anchored`); invariant: options never selected.
- **Deliberately different**: no fuzzy scorer and no DOM sorting (cmdk/Bits); no vim
  bindings; no grid `columns` (Grid List later); no own dialog part; React Aria's
  "any collection" Autocomplete is not copied — Command is a listbox palette, Menu/Tree
  filtering comes with those components.

## Open questions

- Mobile screen readers: should Command move real focus into the list like React Aria
  (`isMobileScreenReader`)? Needs device testing with the pattern's announcer first.
- Should a ranked mode come back as a core helper (score → stable sort of the derived
  collection) once a second component (Mentions) needs it? Not before.
