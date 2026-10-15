# Toolbar — research

Status: done · Wave: 2

A named row (or column) of controls that is **one tab stop**: Tab enters it at one
control, arrow keys move between controls, Tab leaves it. Its controls are other
components — buttons, toggles, Toggle Group, Radio Group, Menu / Select / Popover
triggers, links, a text field — so the hard part is not the toolbar's own keys but
**which component owns which key** once a composite sits inside another composite.
Roving focus, typeahead, repair and the one-tab-stop rule are
[collections.md](collections.md); this note covers what is Toolbar-specific.

Sources: shallow clones read 2026-10-14 (paths repo-relative; React Aria from the `ra/`
sparse clone). Bug history: `gh search issues` over the ten trackers in
[README.md](README.md) with `toolbar`, `toolbar focus`, `toolbar keyboard`; ~260 hits,
~45 toolbar-related, 30 read in full.

## Pattern

- WAI-ARIA APG: [Toolbar](https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/) and its
  [example](https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/examples/toolbar/)
  (fetched 2026-10-14).
- Roles and attributes: container `role="toolbar"`, named by `aria-labelledby` (visible
  label) or `aria-label`; `aria-orientation="vertical"` when vertical (default
  horizontal); controls keep their own roles (`button` + `aria-pressed`, `radiogroup` /
  `radio`, menu button, `spinbutton`, `checkbox`, link). The APG example uses
  `aria-disabled` on Cut / Copy / Paste so they stay focusable.
- Keyboard:

  | Key | Behaviour |
  |---|---|
  | Tab / Shift+Tab | into and out of the toolbar; first entry lands on the first enabled control, later entries on the most recently focused one (example) |
  | Left / Right (horizontal) | previous / next control, optionally wrapping (the example wraps) |
  | Up / Down (vertical) | take over Left / Right; in a horizontal toolbar they "can duplicate Left/Right or be reserved for operating controls" (spin button, radio group) |
  | Home / End | optional: first / last control |
  | Radio group in a toolbar | arrows move without checking; Enter / Space check (example; [Radio pattern](https://www.w3.org/WAI/ARIA/apg/patterns/radio/) "radio group contained in a toolbar") |
  | Menu button in a toolbar | Enter, Space, Down, Up open its menu (example) |
- A textbox "can be included only as the last element of a toolbar" because its arrow
  keys conflict (APG About section). A documented shortcut to reach the toolbar from its
  context is recommended (APG note 3).

## How the others built it

Shipped by Radix, React Aria, Base UI, Ariakit, Reka and Bits (6 of 9). Kobalte, Zag /
Ark and Headless UI have none.

### Radix (Reka is a port)

- Source: `radix/packages/react/toolbar/src/toolbar.tsx`;
  `reka-ui/packages/core/src/Toolbar/*.vue`.
- Parts: Root, Button, Link, ToggleGroup, ToggleItem, Separator. Root =
  `RovingFocusGroup` (`loop` default true, `orientation`, `dir`) +
  `role="toolbar"` + `aria-orientation` always.
- Composition: `ToolbarToggleGroup` renders the standalone ToggleGroup with
  `rovingFocus={false}` and its items as roving items of the *toolbar*; single-mode
  items get `role="radio"` (RX#4119: radio roles with toolbar keys, closed as intended).
  `ToolbarLink` adds Space → `click()`; it acts only on keys whose target is the link
  itself (RX#3232). `ToolbarSeparator` takes the perpendicular orientation.
- No text-field handling, no Select / Menu integration beyond `asChild`; a menu trigger
  inside a toolbar is just a roving item.

### React Aria Components

- Source: `react-aria/src/toolbar/useToolbar.ts`.
- **Not roving.** Every control stays tabbable; the toolbar intercepts Tab to move focus
  to its first / last control and lets the browser continue, and arrow keys call a
  focus manager over tabbables. A toolbar nested in a toolbar renders `role="group"`.
  It records the last focused child on blur and restores it on re-entry.
- Arrow handling is on the capture phase with `stopPropagation`, so nested controls that
  use the same keys lose them: Select in a Toolbar is unsupported (RA#8636), a text
  field cannot move its caret (RA#7937, "works as intended": APG excludes text fields).
- Problems: the Tab trick focuses the last control for a frame, so its tooltip flashes
  (RA#10496, open); two focus events on re-entry (RA#5457, open).

### Base UI

- Source: `base-ui/packages/react/src/toolbar/{root,button,link,input,group,separator}/*`,
  `internals/composite/root/useCompositeRoot.ts`.
- Parts: Root (`role="toolbar"`, `aria-orientation`, `loopFocus` default true,
  `disabled`), Button, Link, Input, Group (`role="group"`, disabled cascade), Separator.
  `focusableWhenDisabled` defaults to **true** for buttons and inputs (APG example);
  `false` restores native `disabled` and removes the item from navigation (BU#2175).
- Composition through `render`: `<Toolbar.Button render={<Menu.Trigger />}>`; Toggle
  Group, Radio Group and Number Field inside a toolbar join its composite.
- **Text fields**: the composite lets an arrow through to a native input unless the
  caret is collapsed at the edge in the arrow's direction and Shift is not held, and
  selects the input's text on focus (`useCompositeRoot.ts`).
- Problems / decisions: components that use the same keys must stop propagation
  (BU#1759); only menu-like items get `data-highlighted`, toolbar items use `:hover` /
  `:focus-visible` (BU#3094); a disabled-but-focusable `Toolbar.Input` still accepts IME
  text because only `keydown` is cancelled (BU#5366, open); `orientation` couples
  navigation axes, so a vertical toolbar with a Select fights over ArrowDown (BU#4487
  discussion); tooltip on a pseudo-disabled button (BU#4966); an optional hotkey to reach
  the toolbar requested (BU#1454, open).

### Ariakit

- Source: `ariakit-react-components/src/toolbar/{toolbar,toolbar-item,toolbar-input,toolbar-container,toolbar-separator}.tsx`,
  `composite/composite-item.tsx`; sandboxes `toolbar-keyboard-navigation`,
  `toolbar-container-focus`, `toolbar-pre-hydration`, `toolbar-separator-6302`,
  `toolbar-iframe-6316`.
- Composite store (`orientation`, `focusLoop`, `rtl`, `virtualFocus`); `ToolbarInput`
  applies the same caret-at-edge rule as Base UI; `ToolbarContainer` is an item that
  holds interactive content (Enter enters it, Escape leaves).
- Problems: the active item disabled after render left no tab stop (AK#3232); disabling
  the focused native button dropped focus to `body` (AK#7359); text fields in a
  same-origin iframe misdetected through `instanceof` (AK#6316); Alt-modified arrows
  moved focus (AK#7099); every item re-rendered on each interaction (AK#497) and holding
  an arrow over tooltip triggers was slow (AK#4428).

### Bits UI

- Source: `bits-ui/packages/bits-ui/src/lib/bits/toolbar/toolbar.svelte.ts`.
- Radix shape plus `Toolbar.Group type="single|multiple"` (a toggle group; single-mode
  items `role="radio"`). Problems: a link inside a group item did nothing on Enter
  (BITS#642); `onValueChange` fired on init and several times per change (BITS#446).

## Accessibility

Applying [accessibility.md](accessibility.md) (rules by number) and
[assistive-tech-and-a11y-testing.md](assistive-tech-and-a11y-testing.md):

- **One tab stop (rule 8)**, roving tabindex (accessibility.md §4.2 lists Toolbar).
  React Aria's all-tabbable approach is rejected: it breaks the APG contract (Tab walks
  every control) and its Tab interception causes RA#10496.
- **Re-entry** lands on the last focused control (APG example); the first entry on the
  first navigable control (collections "Exactly One Tab Stop").
- **Name.** `toolbar` does not require a name in ARIA, but with more than one toolbar on
  a page an unnamed one is ambiguous; dev warning when unnamed.
- **Orientation.** `aria-orientation="vertical"` only for vertical toolbars. VoiceOver
  announces generic "use arrow keys" hints whatever the orientation (RX#756; tested
  against the APG example: not a bug).
- **NVDA focus mode.** A `toolbar` container keeps NVDA in focus mode for arrow keys
  (BU#3629, Combobox chips use it for that reason) — a reason to use the role rather
  than a plain group.
- **Virtual cursor (cause C).** Focus arriving from the VO cursor only updates the tab
  stop; it never activates or checks anything (invariant 13). Radios inside a toolbar
  check only on Enter / Space.
- **AT presses (cause A).** Items activate on click through the press module; toolbar
  links activate once on Enter (native) and once on Space.
- **Disabled controls** stay focusable with `aria-disabled` by default (APG example,
  Base UI default) so they are discoverable and their tooltips work (BU#4966); a
  disabled text field must not accept input of any kind, IME included (BU#5366).
- **Forced colors / target size.** Items are other components and inherit their
  stylesheets; the toolbar theme only lays out, draws the separator as a border and
  keeps 24×24 targets.
- **RTL.** Horizontal arrows mirrored (rule 17); vertical arrows, Home, End never.
- **Native platform** ([native-platform.md](native-platform.md) §9): `focusgroup` is
  Chromium-only — avoided; roving stays in `core/collection`.

## Bug history

| Library | Issue | Symptom | Root cause | Fix / status | Lesson for rind-ui |
|---|---|---|---|---|---|
| React Aria | [#7937](https://github.com/adobe/react-spectrum/issues/7937) closed | Caret of a text field in a toolbar cannot move | Toolbar takes every arrow on capture | Won't fix (APG) | Text fields keep their arrows; toolbar moves only at the caret edge (Spec) |
| React Aria | [#8636](https://github.com/adobe/react-spectrum/issues/8636) closed | Select in a Toolbar traps keyboard navigation | Both consume Left / Right | Won't fix | Key ownership: toolbar axis keys vs the control's own keys, specified per orientation (Spec) |
| Base UI | [#4487](https://github.com/mui/base-ui/issues/4487) closed | Vertical toolbar + Select: ArrowDown fights | Orientation couples navigation keys | Discussion | In a vertical toolbar Up/Down are the toolbar's; triggers open with Enter / Space (Spec) |
| Base UI | [#1759](https://github.com/mui/base-ui/issues/1759) closed | Arrows inside a popup opened from a toolbar move the toolbar | Keys bubbling from portalled content | Each component stops propagation | Toolbar acts only on keys whose target is one of its items (Spec) |
| Radix | [#3232](https://github.com/radix-ui/primitives/issues/3232) closed | Keys from content portalled out of a link reach it | Event bubbling through the component tree | Target check | Same rule (Spec) |
| Ariakit | [#7099](https://github.com/ariakit/ariakit/issues/7099) closed | Alt+arrow moves composite focus (and counts as pointer modality) | No modifier filter | Fixed | Modified arrows are never toolbar moves (Spec) |
| Ariakit | [#6316](https://github.com/ariakit/ariakit/issues/6316) closed | Arrows steal focus from text fields in a same-origin iframe | `instanceof HTMLInputElement` across realms | Fixed | Text-field detection by tag and type, realm-safe (design) |
| Base UI | [#5366](https://github.com/mui/base-ui/issues/5366) open | Disabled focusable `Toolbar.Input` still accepts IME text | Only `keydown` cancelled | Open | Disabled text-field items are read-only, so no input path writes (Spec) |
| Ariakit | [#3232](https://github.com/ariakit/ariakit/issues/3232) closed | First item disabled after render: toolbar unreachable by Tab | Active item kept on a disabled element | Fixed | Repair keeps exactly one tab stop (Spec, collections) |
| Ariakit | [#7359](https://github.com/ariakit/ariakit/issues/7359) closed | Disabling the focused button drops focus to `body`, arrows dead | Native `disabled` on the focused element | Fixed | Focusable disabled items use `aria-disabled`; focus stays (Spec) |
| Base UI | [#2175](https://github.com/mui/base-ui/issues/2175) closed | `focusableWhenDisabled={false}` button not natively disabled | Attribute dropped | Fixed | `false` → native `disabled`, skipped by arrows (Spec) |
| Base UI | [#4966](https://github.com/mui/base-ui/issues/4966) closed | Tooltip does not open on a pseudo-disabled toolbar button | Pointer events suppressed | Fixed | `aria-disabled` items keep hover; tooltip scenario (Spec) |
| Base UI | [#3094](https://github.com/mui/base-ui/issues/3094) closed | No `data-highlighted` on hover | Decision: only menu-like items | Docs fixed | Pointer hover never moves the toolbar's highlight (Spec) |
| Radix | [#4119](https://github.com/radix-ui/primitives/issues/4119) closed | Toggle group in single mode: radio roles, toolbar keys | Radio semantics on toggle buttons | Intended | Toggle Group stays toggle buttons; Radio Group inside a toolbar is a real radiogroup with move-only arrows (Spec) |
| Radix | [#2146](https://github.com/radix-ui/primitives/issues/2146) closed | Asked: radio group that checks only on Space, in a toolbar | APG toolbar variant missing | Declined for standalone | Radio Group hosted by a toolbar checks on Enter / Space only (Spec; request to add-radio-group) |
| Kobalte | [#579](https://github.com/kobaltedev/kobalte/issues/579) open | Move focus in Radio Group without selecting | Same | Open | Same |
| Base UI | [#4123](https://github.com/mui/base-ui/issues/4123) closed | Shift+Tab broken after closing a popover opened from a toggle in a group | Nested roving groups with a popover trigger | Use Toolbar | Popover / Menu triggers are toolbar items; restore keeps the tab stop (Spec) |
| Radix | [#949](https://github.com/radix-ui/primitives/issues/949) closed | axe flags `role="toolbaritem"` | Invented role | Removed | Items keep their own roles; no wrapper roles (Spec) |
| Radix | [#756](https://github.com/radix-ui/primitives/issues/756) closed | VO tells users to use Up / Down in a horizontal toolbar | VO's generic hint | Not a bug | Documented; no workaround |
| Radix | [#2507](https://github.com/radix-ui/primitives/issues/2507) closed | Pressing toolbar Select / Menu takes focus from the editor | Triggers take focus on press | — | Items accept "press without focus"; editors keep focus (Spec) |
| Radix | [#1525](https://github.com/radix-ui/primitives/issues/1525) closed | `onClick` on a toolbar toggle item fires twice | Handler composed twice through nested slots | PR #1526 | One activation per press through nested substitution (Spec) |
| Bits UI | [#642](https://github.com/huntabyte/bits-ui/issues/642) closed | Enter on a link in a toolbar group does nothing | Group item swallowed Enter | Fixed | Link items: Enter native, Space one click (Spec) |
| Bits UI | [#446](https://github.com/huntabyte/bits-ui/issues/446) closed | Group `onValueChange` on init and several times per change | Effects re-firing | Fixed | Hosting never changes a composite's value or fires its callbacks (Spec) |
| Ariakit | [#497](https://github.com/ariakit/ariakit/issues/497) closed, [#4428](https://github.com/ariakit/ariakit/issues/4428) closed | Every item re-renders per interaction; holding an arrow over tooltip triggers is slow | Shared store subscriptions | Fixed | A move re-renders two items (collections); closed tooltips cost nothing (tooltip spec) (tasks: perf test) |
| React Aria | [#10496](https://github.com/adobe/react-spectrum/issues/10496) open | Tooltip of the last button flashes when tabbing out | Tab interception focuses the last control first | Open | No Tab interception: roving tabindex lets the browser leave directly (Spec) |
| React Aria | [#5457](https://github.com/adobe/react-spectrum/issues/5457) open | Two items receive `focus` on re-entry | Programmatic re-focus inside a focus handler | Open | Re-entry focuses one element, once (Spec) |
| Ariakit | [#6299](https://github.com/ariakit/ariakit/issues/6299) closed | RTL: arrows enter at the wrong end | RTL ignored on the base element | Fixed | One logical-key mapping (a11y-foundations); RTL run (tests) |
| Base UI | [#1454](https://github.com/mui/base-ui/issues/1454) open | Hotkey to reach the toolbar | APG note 3 | Open | `focus()` API on the toolbar; the hotkey stays the app's (Spec) |
| Base UI | [#4647](https://github.com/mui/base-ui/issues/4647) closed; Ariakit [#6302](https://github.com/ariakit/ariakit/issues/6302) closed | Separator orientation "inverted" / explicit value ignored | Perpendicular default vs explicit prop | Clarified / fixed | Separator: perpendicular default, explicit wins ([separator.md](separator.md)) |

## Known pitfalls

1. **Key ownership.** Every library has a bug where a control inside the toolbar and the
   toolbar both want the same arrow (text field, Select, Radio Group, popups). The rule
   has to be written down per orientation, not left to `stopPropagation` in each
   component.
2. **Nested composites.** A Toggle Group or Radio Group inside a toolbar must stop being
   its own tab stop and composite; otherwise there are two roving groups and Tab / arrow
   behaviour breaks (BU#4123).
3. **Disabled focus.** Native `disabled` on the focused or active item loses focus or the
   tab stop (AK#3232, AK#7359).
4. **Tab interception** (React Aria) instead of roving tabindex causes side effects in
   tooltips and focus events.

## Testing notes

- Model tests over the toolbar machine graph (it is the collections roving fixture plus
  focus memory) with argument classes: horizontal, vertical, `loop: false`, first item
  disabled, all disabled, a text field first / middle / last, a hosted Radio Group, a
  hosted Toggle Group, a Menu trigger.
- Key-ownership scenarios need a real browser (caret position, IME composition events):
  browser mode with Playwright's keyboard and `insertText` for composition.
- Driver: `moveTo(name)`, `press(name)`, `tabIn()`, `tabOut()`; queries `items()`,
  `focusedItem()`, `tabStop()`, `isDisabled(name)`, `orientation()`. Hosted components
  keep their own drivers (`getRadioGroup(toolbar, …)` works inside the toolbar).

## Decisions

- **Parts**: `root` (`div`, `role="toolbar"`), `button` (`button`, button-like element),
  `link` (`a`), `item` (any focusable control through `render`: a Menu / Select /
  Popover / Tooltip trigger, an input, a checkbox), `group` (`div`, `role="group"`,
  named, disables its items), `separator` (the Separator helper with `context:
  "toolbar"`, perpendicular by default).
- **Machine** `toolbar`: `idle | focused`; events `NAVIGATE { move }`, `FOCUS { key }`,
  `BLUR`, `COLLECTION.CHANGE`, `FOCUS_TOOLBAR` (programmatic `focus()`). No selection, no
  typeahead (APG has none for toolbars; letters belong to text fields). Effects:
  `focusHighlighted` in `focused`. The highlight survives `BLUR`, which is the
  "most recently focused" memory.
- **Props**: `orientation` (`horizontal` default), `loop` (default `true`), `disabled`,
  `focusableWhenDisabled` (default `true`), `dir` from the environment.
- **Key ownership** (connect, one function):
  1. the toolbar acts only on keydowns whose target is one of its items, that carry no
     Alt / Ctrl / Meta, are not composing and were not `preventDefault`ed by the item;
  2. it owns the arrows of its axis (Left / Right mirrored in RTL, or Up / Down) and
     Home / End; the perpendicular arrows are never the toolbar's;
  3. on a text field (input of a text type, textarea, contenteditable) it moves only
     when the caret is collapsed at the edge in the arrow's direction and Shift is not
     held; Home / End stay the field's;
  4. everything else (Enter, Space, letters, Escape, the perpendicular arrows) belongs
     to the item: menu and select triggers open with their own keys, and in a vertical
     toolbar they open with Enter / Space (and ArrowUp/Down are the toolbar's).
- **Composite host**: the toolbar exposes a `CompositeHost` (orientation, `dir`,
  register item, roving item props). Toggle Group and Radio Group inside a toolbar
  detect the host: their items register as toolbar items (document order), the groups
  give up their own tab stop and arrow handling, keep their roles and values; Radio
  Group never checks on move and checks on Enter or Space. Requests to add-radio-group
  and add-toggle-group.
- **Disabled**: `aria-disabled` and focusable by default; disabled text fields are also
  `readOnly`; `focusableWhenDisabled={false}` → native `disabled`, skipped. A disabled
  toolbar disables every item.
- **Press without focus**: an item may declare the press module's "does not take focus"
  (editor toolbars); its press activates, focus and the tab stop do not move.
- **`data-*`**: root `data-orientation`, `data-disabled`; items `data-key`,
  `data-orientation`, `data-disabled`, `data-focus-visible`, `data-highlighted` on the
  tab-stop item only while focus is inside (keyboard highlight, never pointer hover);
  group `data-disabled`; separator per separator.md.
- **Contract**: locate by role `toolbar` and name; actions `moveTo`, `press`, `tabIn`,
  `tabOut`; queries as in Testing notes; traits `composite-roving`, `directional`.
- **Deliberately different**: key ownership as a specified rule (not
  `stopPropagation` per component); hosted composites instead of toolbar-specific copies
  (Radix `ToolbarToggleGroup`); real radio semantics with move-only arrows inside the
  toolbar (APG) while Toggle Group keeps toggle buttons; roving over React Aria's
  all-tabbable approach.

## Open questions

None that change the specs. Overflow ("more" menu for items that do not fit) is a
non-goal until a consumer needs it.
