# Tag Group — research

Status: done · Wave: 2

A standalone collection of tags (labels, keywords, filters, recipients) that the user can
browse with the keyboard, optionally select, and optionally remove. Display and removal
of chips **outside** a text field. The chips *inside* a Combobox or Tags Input control are
not Tag Group: they are owned by `add-combobox` ("Multiple Selection With Chips",
`role="toolbar"` inside the control) and shared with Tags Input (coordinator decision).
Keys, navigation, focus repair after removal, selection and typeahead are
[collections.md](collections.md) and `add-collections`; this note covers what is
tag-specific: the role, the parts, removal and its keyboard path, announcements, links and
actions, the empty state.

Sources: shallow clones read 2026-10-14 (paths repo-relative):
`react-spectrum` @ `e04377c` — `packages/react-aria/src/tag/{useTagGroup,useTag}.ts`,
`packages/react-aria/src/gridlist/useGridListItem.ts`, `packages/react-aria/intl/tag/en-US.json`,
`packages/react-aria-components/src/TagGroup.tsx`; `reka-ui` @ `a3629f8` —
`packages/core/src/TagGroup/{TagGroupRoot,TagGroupItem,TagGroupItemDelete}.vue`; `ariakit`
@ `2c9bbc2` — `packages/ariakit-react-components/src/tag/{tag,tag-list,tag-remove,utils}.tsx`;
for contrast `base-ui/packages/react/src/combobox/chips/ComboboxChips.tsx` and
`zag/packages/machines/tags-input/src/tags-input.connect.ts`. APG
[Layout Grid, Example 2 "Pill List"](https://www.w3.org/WAI/ARIA/apg/patterns/grid/examples/layout-grids/)
(fetched 2026-10-14). Bug history: `gh search issues` over the ten trackers with `TagGroup`,
`TagGroup focus|remove|selection|link|grid|screen reader`, `tag VoiceOver`, `TagList`,
`TagRemove`, `tags-input delete`, `chips remove focus`.

## Pattern

- WAI-ARIA APG: no "tag" pattern. The closest is the **layout grid**: APG's Example 2 is a
  pill list of message recipients — `role="grid"`, one logical row per pill, cells holding
  the recipient link and its remove control, roving tabindex so "only one of the cells or
  widgets within the grid is in the page Tab sequence", and "an off-screen live region
  informs screen reader users of the result of the action". [accessibility.md
  §1.5](accessibility.md) maps Tag Group to the Listbox pattern ("removable chips"); this
  note revises that to the layout grid (Decisions), because options may not contain
  interactive content.
- Roles and attributes required (decided below): container `grid` with a name,
  `aria-multiselectable` in multiple mode; each tag `row` (focusable, named by its text,
  `aria-selected` explicit when selectable, `aria-disabled`), one `gridcell` holding the
  content; remove control a `button` named "Remove <tag>"; an empty group is `group`, not an
  empty `grid` (`aria-required-children`, RA#8354). A tag list with no interaction is a plain
  `list`/`listitem` and no Tab stop.
- Keyboard: Tab into the group lands on one tag (roving); Left/Right (and Up/Down) move
  between tags, mirrored in RTL; Home/End first/last; Delete/Backspace remove; Enter/Space
  select (when selectable) or run the tag's action/link; typeahead.

## How the others built it

### React Aria (Components)

- Source: `react-aria/src/tag/useTagGroup.ts`, `useTag.ts`; RAC `TagGroup.tsx`.
- API: `TagGroup` (Label, Description, error slot) › `TagList` (`renderEmptyState`) › `Tag`
  (`id`, `textValue`, `isDisabled`, `href`, `onAction`) with a `Button slot="remove"`.
  `onRemove(keys: Set<Key>)`; selection props from `MultipleSelection`; `escapeKeyBehavior`
  `clearSelection` by default.
- State: `useListState`; built on **GridList** hooks (`useGridList`, `useGridListItem`) with
  `ListKeyboardDelegate({ orientation: "horizontal" })`, `shouldFocusWrap: true`,
  `linkBehavior: "override"`, `keyboardNavigationBehavior: "tab"`.
- Notable:
  - Role `grid` while non-empty, **`group` when empty** (RA#8354, "experimenting with a
    group role in this empty state"); the row is focused, not the cell (RA#3070).
  - Delete **and** Backspace on a tag call `onRemove`; on a *selected* tag they remove the
    whole selection. `allowRepeats: true`.
  - Removal hint: `useDescription("Press Delete to remove tag.")` on the row, only in
    keyboard/virtual modality, never on touch (RA#4278 moved it off the button so a
    virtual-cursor user does not hear "press Delete" while focus is on another tag).
  - Remove button: `aria-label="Remove"` + `aria-labelledby="<button> <row>"` → "Remove
    Shopping".
  - When the last tag is removed and focus was inside, the grid itself is focused.
  - `aria-live="polite"` + `aria-relevant="additions"` on the grid **while focus is within**,
    so tags added from an adjacent input are spoken.
- Problems: two contradicting accessibility audits on the remove path (RA#7483 wants the
  remove button focusable, RA#9822 wants one stop per tag; RA now makes the button a second
  Tab stop inside the row); focus lost to `document` on removal (RA#9471, open; RA#4224);
  `display: contents` breaks Shift+Tab (RA#9532, open); hover off for links (RA#9507).

### Reka UI

- Source: `TagGroup/{TagGroupRoot,TagGroupItem,TagGroupItemDelete,TagGroupItemText}.vue`
  (a port of RA's design, newest of the three).
- API: `TagGroupRoot` (`v-model`, `selectionMode` default `none`, `disallowEmptySelection`,
  `escapeKeyBehavior`, `loop` default true, `dir`, `disabled`), `TagGroupItem` (`value`,
  `disabled`, `textValue`), `TagGroupItemText`, `TagGroupItemDelete`; `@remove(values)` —
  tags are removable **only when a `remove` listener exists**.
- Notable: `role="grid"` / `group` + `tabindex=0` when empty; rows `role="row"` with a
  `display: contents` `gridcell` wrapper; Delete/Backspace on a selected tag removes the
  selection minus disabled tags; focus restore on unmount: next enabled tag, else previous,
  else the group, skipped when focus already moved elsewhere; typeahead; optional Field
  participation; delete button tabbable only on the current tab stop ("Tab moves from a tag
  to its delete button and then out of the group, like React Aria").
- Problems: restore is driven by element unmount (`onBeforeUnmount`), which collections
  rejects (virtualization/suspense trigger it). No announcement on removal.

### Ariakit

- Source: `tag/tag.tsx`, `tag-list.tsx`, `tag-remove.tsx`. Ariakit's Tag is the **Tags
  Input** (TagInput, TagValues), but `TagList` + `Tag` + `TagRemove` is its chip display.
- Notable: `role="listbox"` / `option` on desktop, **`list` / `listitem` on touch devices**
  (detected after mount); the remove control is `aria-hidden` on desktop and serves as the
  tag's description "Press Delete or Backspace to remove", but is a named `button` ("Remove
  x") on touch. Backspace moves focus to the previous tag, Delete to the next. A printable
  key or paste on a tag focuses the input. `aria-live="polite" aria-atomic="true"` on the
  list.
- Problems: the role depends on a post-mount touch detection (hydration flip); a standalone
  `TagRemove` rendered as a focusable `aria-hidden` button with no name (AK#6330);
  `display: contents` element froze the page in `getClosestFocusable` (AK#6311). Listbox
  options cannot contain the remove button, hence the role swap.

### Others

- **Base UI** `ComboboxChips`: `role="toolbar"` only while chips exist (NVDA focus mode,
  BU#3629) — input chips, covered by `add-combobox`.
- **Zag / Ark** Tags Input: tags are plain elements with a delete trigger
  (`deleteTagTriggerLabel(value)`); no standalone group. Radix, Headless UI, Bits UI,
  Kobalte: none.
- **React Spectrum** (styled) adds `maxRows` with a "Show all (n)" button and actions; its
  measuring is the source of RA#4224, RA#7467, RA#6962.

## Accessibility

Rules from [accessibility.md](accessibility.md) and
[assistive-tech-and-a11y-testing.md](assistive-tech-and-a11y-testing.md) applied:

- **Role.** `grid`/`row`/`gridcell` (APG layout grid). `listbox` is rejected: an `option`
  may not contain a button or link (HTML-AAM rule 2, axe `nested-interactive`), which forces
  Ariakit's hidden remove control and its touch role swap. `list` is used only when the
  tags have no interaction at all (no removal, selection, action or link): then nothing is
  focusable and nothing needs a widget role. An empty interactive group is `group` (an
  empty `grid` fails `aria-required-children`, RA#8354).
- **Name.** The grid is named by the Label part (`aria-labelledby`) or `aria-label`; a grid
  needs a name. Each row is named by its TagText through `aria-labelledby` (not
  name-from-content, which would add "Remove x" to every tag; not `aria-label` copied from
  `textValue`, which page translation misses). RA#7310: a consumer `aria-label` on a Tag
  must win.
- **Keyboard.** One Tab stop ([§4.2](accessibility.md) lists Tag Group as roving). Remove
  without a second Tab stop: Delete/Backspace, plus Enter/Space when the tag has no other
  activation (no selection, action or link), which answers the RA#7483 audit ("keyboard
  users will expect … Enter or Spacebar") without the extra stop RA#9822 objects to. The
  remove button stays reachable by the virtual cursor and touch screen readers (named
  button, `tabindex=-1`), and the row carries the removal hint in keyboard/virtual modality
  only (RA#4278).
- **Focus after removal.** Collections' repair: next navigable, else previous, else the
  container — never `<body>` ([§4.3](accessibility.md); RA#9471, RA#4224, RA#6616). Driven
  by collection data, not unmount.
- **Announcements.** APG's pill list announces the result of a removal. Focus moving to the
  neighbour speaks the neighbour, not the removal, so the machine announces "<tag> removed"
  (polite, on every platform, the same message as Combobox chips) once the key has actually
  left the collection. No `aria-live` on the grid (rule 23); RA's "additions while focused"
  live region is not copied — Tags Input announces its own additions.
- **Screen readers.** VO + Firefox cannot operate grids (RA#7934, out of scope per the
  support matrix); VO+arrows read the text inside the row, plain arrows move tags. WebKit
  239920: a grid label inside `main` is not announced (tracked on RA's external list).
  NVDA/JAWS switch to focus mode on a grid row, which is what makes Delete reach us (RA#4278).
- **Disabled tags** stay focusable with `aria-disabled` by default (`focusableWhenDisabled`):
  VO announced "3 rows" while only two were reachable (RA#3074).
- **Forced colors.** Focus ring as `outline` (RA#4197: box-shadow ring kept the brand
  colour); selected state with `SelectedItem` plus a non-colour cue.
- **Target size.** The remove button is small: `--rind-hit-area` pseudo-element to reach
  24×24 (§8).
- **RTL.** Horizontal arrows mirrored by `core/dom/keyboard`; vertical arrows also move
  (tags wrap to lines; RA's horizontal delegate accepts both).
- **Native platform.** Nothing native does this. `display: contents` on the gridcell is the
  common trick (RA, Reka) but has bitten twice (RA#9532, AK#6311); we keep the cell a real
  box-less element only through the theme, and never rely on the row being unfocusable.

## Bug history

| Library | Issue | Symptom | Root cause | Fix / status | Lesson for rind-ui |
|---|---|---|---|---|---|
| React Aria | [#9471](https://github.com/adobe/react-spectrum/issues/9471) open | Removing a tag sometimes sends focus to the document start | Repair raced the collection update after the selection changed elsewhere | Open | Repair from collection data, focus never `<body>` (scenario) |
| React Aria | [#4224](https://github.com/adobe/react-spectrum/issues/4224) closed | Removing the only visible tag (others collapsed) loses focus to `body` | Re-measured layout replaced the items | PR #4358 | Repair targets the next key in data order, whatever is rendered |
| React Aria | [#6616](https://github.com/adobe/react-spectrum/issues/6616) closed | Removing next to ≥ 2 disabled tags crashes the tab | Unbounded walk over disabled keys | PR #6621 | Bounded, disabled-aware walker (collections) — scenario |
| React Aria | [#7483](https://github.com/adobe/react-spectrum/issues/7483) closed | Audit: keyboard users cannot discover Delete; remove button not focusable | Removal only by Delete | RA made the button a Tab stop | Enter/Space removes when nothing else activates; hint on the row |
| React Aria | [#9822](https://github.com/adobe/react-spectrum/issues/9822) closed | Audit: two Tab stops per tag, Tab and arrows mixed | Consequence of the #7483 change | Closed, "no correct behaviour" | One Tab stop for the whole group (scenario) |
| React Aria | [#4278](https://github.com/adobe/react-spectrum/issues/4278) closed | "Press delete to remove" on the button misled virtual-cursor users onto the wrong tag | Instruction on the button, not the focused row | Hint moved to row `aria-describedby`, button = "Remove" + name | Hint on the row, keyboard/virtual modality only (scenario) |
| React Aria | [#3070](https://github.com/adobe/react-spectrum/issues/3070) closed | Focus landed on the cell; removable tags read "Cool Tag 2, Remove Cool Tag 2" | Cell focus + name from content | Focus the row | Row is focused and named by TagText only |
| React Aria | [#8354](https://github.com/adobe/react-spectrum/issues/8354) closed | Empty TagGroup kept ARIA attributes with no role | Role dropped when empty | `group` role when empty | Empty interactive group is `group` (scenario) |
| React Aria | [#2837](https://github.com/adobe/react-spectrum/issues/2837) closed | Empty `grid` flagged by axe | `grid` requires rows | Fixed | Same |
| React Aria | [#3074](https://github.com/adobe/react-spectrum/issues/3074) closed | VO: "3 rows" but 2 reachable; nothing announced on remove button click; iOS VO lost focus deleting the last tag | Disabled rows skipped; no removal feedback | Partly fixed, partly closed | Disabled focusable by default; removal announced; last removal focuses the group |
| React Aria | [#7934](https://github.com/adobe/react-spectrum/issues/7934) open | VO cannot select tags | VO + Firefox (unsupported) / VO-key navigation reads text | Open | Support matrix excludes VO+Firefox; manual protocol uses plain arrows |
| React Aria | [#5054](https://github.com/adobe/react-spectrum/issues/5054) closed | Error message not read in Chrome (VO, NVDA, JAWS) | Error not tied to the focused row | Closed, no repro | No error/validation in Tag Group (non-goal) |
| React Aria | [#9532](https://github.com/adobe/react-spectrum/issues/9532) open | Shift+Tab visits every delete button | `display: contents` list is unfocusable; handler assumed focusable list | Open | Never base Tab handling on the container's focusability; remove buttons `tabindex=-1` |
| React Aria | [#7310](https://github.com/adobe/react-spectrum/issues/7310) closed | `aria-label` on Tag ignored | Labelling props filtered from the row | Explained (textValue wins) | Consumer `aria-label` on Tag overrides TagText (scenario) |
| React Aria | [#10720](https://github.com/adobe/react-spectrum/issues/10720) closed | Home/End/PageUp/PageDown also scroll the page | Missing `preventDefault` in shared shortcut handling | Fixed | Handled keys `preventDefault` (collections); test it here |
| React Aria | [#9205](https://github.com/adobe/react-spectrum/issues/9205) closed | `onAction` missing from TagGroup types (layout grid with actionable tags) | Omitted from the Pick | Fixed | `onAction` is first-class |
| React Aria | [#8151](https://github.com/adobe/react-spectrum/issues/8151) open | A Tag cannot be a Dialog trigger | Non-selectable rows have no press | Accepted | Action tags press like buttons; usable as a trigger through `onAction` |
| React Aria | [#9507](https://github.com/adobe/react-spectrum/issues/9507) closed | No `data-hovered` on link tags | Hover disabled for non-selectable rows | Fixed | `data-hover` on any interactive tag |
| React Aria | [#4197](https://github.com/adobe/react-spectrum/issues/4197) closed | Focus ring not visible in forced colors | `box-shadow` ring | Fixed | Outline ring; forced-colors capture |
| React Aria | [#7467](https://github.com/adobe/react-spectrum/issues/7467) open | `maxRows` renders more tags than fit | "Show all" button never measured | Open | `maxRows` collapse is a non-goal (consumer composes a Collapsible) |
| React Aria | [#6962](https://github.com/adobe/react-spectrum/issues/6962) closed | Long tag names overflow | Collapse layout regression | Fixed | Theme: `max-inline-size: 100%`, ellipsis on TagText |
| React Aria | [#8740](https://github.com/adobe/react-spectrum/issues/8740) closed | TagList inside a ListBoxItem freezes the page | Invalid nesting, infinite loop | Invalid ARIA; dev error suggested | Dev warning when a Tag Group is inside an option |
| React Aria | [#6757](https://github.com/adobe/react-spectrum/issues/6757), [#6814](https://github.com/adobe/react-spectrum/issues/6814) closed | TagGroup inside a GridList item / ComboBox crashes | Nested collection contexts leaked | Fixed | Our collections are props per machine; nesting test |
| React Aria | [#9996](https://github.com/adobe/react-spectrum/issues/9996) closed | Numeric ids stringified, `onRemove` keys mismatch | Collection builder coerced ids | Closed by reporter | Keys are strings by contract (collections); document it |
| React Aria | [#3658](https://github.com/adobe/react-spectrum/issues/3658) closed | Per-tag invalid state requested | Not supported | Design discussion | Consumer data attribute; out of scope |
| Ariakit | [#6330](https://github.com/ariakit/ariakit/issues/6330) closed | Standalone TagRemove is a focusable `aria-hidden` button with no name | ARIA props assumed a parent Tag | PR #6428 | TagRemove always a named button; never `aria-hidden` (scenario) |
| Ariakit | [#6311](https://github.com/ariakit/ariakit/issues/6311) closed | Clicking content in a TagList froze the page | `display: contents` element matched the focusable selector, infinite loop | PR #6441 | Pointer focus targets the row by key, not by walking ancestors |
</content>
</invoke>
| Ariakit | [#7160](https://github.com/ariakit/ariakit/issues/7160), [#7164](https://github.com/ariakit/ariakit/issues/7164) closed | An empty `display: contents` tag list vanishes from role queries (Playwright snapshot) | No box, no content | Recommendation qualified for the empty state | The List element is never `display: contents` in the theme; empty group stays a box |
| Ariakit | [#7155](https://github.com/ariakit/ariakit/issues/7155) closed | Clicking the field no longer focused the input | Layout change moved the handler off the event path | PR #7158 | (Tags Input concern) — Tag Group has no input to focus |
| Reka UI | [#2785](https://github.com/unovue/reka-ui/issues/2785) closed | Keyboard delete removes the wrong (disabled) tag | Index computed over enabled tags, applied to the full model | Fixed | Remove by key, never index; disabled tags are never removed (scenario) |
| Reka UI | [#2525](https://github.com/unovue/reka-ui/issues/2525) closed | TagGroup requested "for filters or to display selected values of a multiselect" | Missing component | Shipped (RA port) | Both uses are in scope: selection for filters, removal for values |
| Zag | [#1911](https://github.com/chakra-ui/zag/issues/1911) closed | After Delete (not Backspace) on a tag, arrows stop working | Delete path left the highlight on the removed tag | Fixed | Delete and Backspace share one removal + repair path (scenario) |

## Known pitfalls

- **Focus after removal** is the most-reported class (RA#9471, RA#4224, RA#6616, ZG#1911,
  RA#3074 iOS): repair must come from the collection data, be bounded over disabled keys,
  and land on the container when nothing is left.
- **Remove by key.** Index arithmetic over a filtered view removes the wrong tag (RK#2785).
- **The remove path is contested** (RA#7483 vs RA#9822). Any choice needs the hint on the
  row (RA#4278) and a keyboard path a non-AT keyboard user can guess.
- **`display: contents`** on the cell or list: unfocusable containers break Shift+Tab
  (RA#9532), freeze ancestor walks (AK#6311), and make an empty list disappear from role
  queries (AK#7160).
- **Empty `grid`** is invalid (RA#8354, RA#2837).
- **Name from content** of a row includes the remove button ("Cool Tag 2, Remove Cool Tag 2",
  RA#3070).
- **Hidden role swaps** by device (Ariakit) flip the role after hydration and leave odd
  states (AK#6330).
- **Nesting** collections inside options crashes or is invalid (RA#8740, RA#6757).

## Testing notes

- Removal is a request: `onRemove(keys)` fires, the consumer drops the keys from its data,
  and repair + announcement happen on the following `COLLECTION.CHANGE`. The driver's
  `remove(name)` postcondition is "the tag is gone and focus is on its neighbour (or the
  list)"; a refused removal leaves the tag and announces nothing.
- Modalities: pointer removal uses TagRemove; keyboard uses Delete (and Backspace in a
  second run); virtual is a bare click on TagRemove (the button is in the AX tree with
  `tabindex=-1`); touch is a tap on TagRemove.
- Announcements are asserted through the recording announcer: one "<tag> removed" per
  removal, "<n> tags removed" when a selection is removed.
- Model props classes: static (list), removable, selectable single/multiple, selectable +
  removable, link tags, action tags, disabled tags, empty, RTL.
- Fixtures need 0, 1 and many tags, a run of disabled tags at the end (RA#6616), and a
  wrapped two-line layout for Up/Down.

## Decisions

- **Role**: `grid` › `row` › `gridcell` while the group is interactive (removable,
  selectable, or any tag has an action or link); `group` when interactive and empty; a
  plain `list` › `listitem` when nothing is interactive (no Tab stop, no keyboard
  handling). Evidence: APG layout grid "Pill List"; RA and Reka; `listbox` cannot hold the
  remove button or a link (Ariakit's hidden-button and touch role swap are the price).
- **Parts**: `Root`, `Label`, `Description`, `List`, `Tag` (`data-part="item"`, the row,
  with an internal `gridcell` wrapper `item-cell`), `TagText` (`item-text`; an `<a>` when
  the tag has `href`), `TagRemove` (`item-remove`, `button-like-element`), `Empty` (inside
  the List while empty).
- **Focus**: roving tabindex over rows (collections `roving`), orientation `both` (tags wrap;
  Left/Right mirrored in RTL, Up/Down never), `loop: true` (RA `shouldFocusWrap`, Reka),
  Home/End, typeahead. One Tab stop for the whole group; TagRemove and link anchors are
  `tabindex=-1`.
- **Removal**: `onRemove(keys, details)` present ⇒ removable. Delete or Backspace on a tag
  removes it — the whole selection when that tag is selected (RA, Reka), never disabled
  tags; Enter/Space also remove when the tag has no other activation; TagRemove press
  removes its tag. Repair is collections' (next, else previous, else the List). The row
  gets `aria-describedby` → hidden `removeHint` ("Press Delete to remove") only while the
  modality is keyboard or virtual (RA#4278).
- **Announcements**: polite `removedAnnouncement(text)` / `removedCountAnnouncement(n)` on
  every platform, emitted when the removed keys have left the collection. No `aria-live` on
  the grid.
- **Selection**: `selectionMode` `none` (default) | `single` | `multiple`, behaviour `toggle`,
  `disallowEmptySelection`; Enter/Space and press toggle; explicit `aria-selected`;
  `aria-multiselectable`; Escape does nothing (as add-listbox); no select-all shortcut.
- **Actions and links**: `onAction(key)` and per-tag `href`. Order for Enter/Space/press:
  link → action → selection → (keyboard only) removal. Link tags are not selectable (RA
  `linkBehavior: "override"`).
- **Disabled**: per-tag `disabled` keeps the tag focusable with `aria-disabled` by default
  (RA#3074); a disabled group has no Tab stop (collections base-ui#4174 rule).
- **`data-*`**: collection item attributes (`data-key`, `data-highlighted`,
  `data-selected`, `data-disabled`, `data-focus-visible`) plus `data-hover`,
  `data-pressed`, `data-removable`, `data-selection-mode`, `data-empty`, `data-disabled`.
- **Contract**: collection fragment (`itemRole: "row"`, roving) + `remove(name)`,
  `removeSelected()`, `act(name)`; queries `tags()`, `isEmpty()`, `isRemovable(name)`;
  traits `composite-roving`, `selectable` (when selectable), `directional`; announcement
  `removalAnnouncement`.
- **Deliberately different**: one Tab stop with Enter-to-remove instead of RA's Tab-reachable
  remove button; static tags are a `list`, not a grid; no Escape-clears-selection; no
  `aria-live` region; repair from data, not unmount (Reka); no `maxRows`/"Show all" (RA#7467,
  RA#4224 — compose with Collapsible).
- **Relation to input chips**: Combobox/Tags Input chips (`add-combobox`, `role="toolbar"`)
  stay separate — the input owns focus there. Shared: the `removeLabel` / `removedAnnouncement`
  message shapes and the `button-like-element` remove button; noted as a request to
  `add-combobox` (align message keys), not restated.

## Open questions

- Enter/Space removing a tag that has no other activation: validate with keyboard-only users
  (RA#7483 auditors) and SR users; a `removeOnPress` opt-out may be needed.
- Announce additions while focus is inside (RA's live region)? Deferred to Tags Input.
- `component-contract` locate takes one role; Tag Group's list is `grid`, `group` or `list`
  (request in design.md).
- VO + Safari reading of `aria-selected` on rows (RA#7934 mentions Chrome only) — manual
  protocol.
