## MODIFIED Requirements

### Requirement: Anatomy

The Combobox SHALL consist of: Root (no element of its own is required; it provides the
service), Label, Control (the anchor wrapping chips, input and buttons), Input, Trigger
(optional), ClearTrigger (optional), Positioner, Popup, List, Item, ItemText,
ItemDescription (optional), ItemIndicator, Group, GroupLabel, Separator, Empty, Loading
(optional), and in multiple mode Chips, Chip and ChipRemove. In inline mode (Inline Mode)
Positioner, Popup and Trigger SHALL render nothing and SHALL log a development warning when
given. Every part SHALL carry `data-scope="combobox"` and its `data-part`, and SHALL accept
element substitution (`render`) without changing behaviour.

#### Scenario: Minimal combobox

- **WHEN** a consumer renders Root, Label, Control, Input, Positioner, Popup, List and
  Items
- **THEN** it works with the keyboard and pointer, and a test finds it by role
  `combobox` and the label's text

#### Scenario: Minimal palette

- **WHEN** a consumer renders an inline Root, an Input with `aria-label="Search commands"`
  and a List of three static Items
- **THEN** a combobox named "Search commands" controls a listbox showing the three items in
  place, and the first item is highlighted

### Requirement: Combobox Data Attributes

In addition to the pattern's attributes: Root and Control SHALL carry `data-state` (the
machine's open state; the Trigger's follows `aria-expanded`, like the Input's),
`data-focus` (focus anywhere in the component), `data-disabled`, `data-readonly`,
`data-invalid`, `data-empty-value` when nothing is selected (in free-text mode: while the
text is empty); in inline mode Root SHALL also carry `data-inline`, `data-empty` while no
option is listed, `data-loading` while loading and `data-page` with the current page key;
Item and ItemIndicator SHALL carry `data-state` (`checked` | `unchecked`) and the collection
item attributes, and no `data-state` when nothing can be selected (`selectionMode: "none"`);
Chip SHALL carry the `input-chips` attributes; ClearTrigger SHALL carry `data-visible` when
it has something to clear; Loading SHALL carry `data-part="loading"`. Every part SHALL pass
`data-variant` and `data-size` through unchanged.

#### Scenario: Selected item indicator

- **WHEN** "Rome" is selected
- **THEN** its Item and ItemIndicator carry `data-state="checked"` and the others
  `data-state="unchecked"`

#### Scenario: Keyboard highlight ring inline

- **WHEN** in an inline combobox the user arrows to "Open recent"
- **THEN** it carries `data-highlighted` and `data-focus-visible`, and the input keeps
  `data-focus`

### Requirement: Combobox Contract

`comboboxContract` SHALL locate an instance by role `combobox` and exact accessible name,
SHALL include the pattern contract and, with `multiple`, the `input-chips` contract
fragment (`removeChip(name)`, `chips()`), and SHALL add: actions `choose(name)` (collection
fragment, Enter or press), `clear()` (pointer: clear button; keyboard: select all text,
Delete, then blur), `blur()`, `run(name)` (inline: pointer presses the item, keyboard
arrows to it and presses Enter; postcondition: `onAction` observed for its key) and `back()`
(inline: Backspace on an empty query); queries `value()` (selected option names; in
free-text mode the text), `items()` (listed option names in order) and `page()`; the trait
`form-associated` (not in inline mode); declared `data-state` for the input, popup and each
item; and its event map with `{ skip }` reasons for programmatic events and `$sync:value`,
`$sync:inputValue`, `$sync:open` and `$props:page` prop steps. Per configuration:
`selectionMode: "none"` SHALL drop the `selectable` trait and declare `combobox-pattern`'s
`optionsNeverSelected` invariant; `inline` SHALL declare `open()` / `close()` as `{ skip }`
with the reason "inline: no popup" and SHALL NOT declare `layer`, `presence` or `anchored`.

#### Scenario: Pick a country by keyboard

- **WHEN** a test runs `type("ita")` and `choose("Italy")` with the keyboard modality
- **THEN** the driver arrows to "Italy", presses Enter, and resolves when `value()` is
  `["Italy"]` and `inputValue()` is "Italy"

#### Scenario: Consumer wrapper drops aria-selected

- **WHEN** `testMachine` runs on a styled wrapper whose options omit `aria-selected` when
  unselected
- **THEN** the `selectable` invariant fails naming the option

#### Scenario: Run a command by keyboard

- **WHEN** a driver test on an inline combobox runs `type("the")` then `run("Toggle theme")`
  with the keyboard modality
- **THEN** it arrows to the item, presses Enter, and resolves once `onAction` was observed

#### Scenario: Consumer wrapper marks the highlight as selected (dip/cmdk#83)

- **WHEN** a consumer's styled wrapper sets `aria-selected="true"` on the highlighted item of
  an inline combobox and `testMachine` runs
- **THEN** the `optionsNeverSelected` invariant fails naming the item

### Requirement: Theme

`@rind-ui/theme` SHALL style the Combobox through tier-3 `--rind-combobox-*` tokens that
default to semantic tokens, selecting only on `data-scope`, `data-part`, `data-state` and
the other `data-*` attributes, including `data-variant` (`solid`, `soft`, `outline`,
`ghost`) and `data-size` (`sm`, `md`, `lg`) on Control, Popup, Item and Chip. Inline mode
(`[data-inline]`) SHALL style the List in place as the palette's body with its own
max-height and scroller, and Item SHALL support `data-tone="danger"` (destructive commands).
Highlighted and selected options SHALL be visible under `forced-colors: active` without
relying on background colour, and the trigger, clear button, options and chip remove
buttons SHALL meet a 24×24 CSS px target.

#### Scenario: Forced colors

- **WHEN** the theme is rendered with `forced-colors: active`
- **THEN** the highlighted option has a visible outline and the selected option a visible
  check glyph

#### Scenario: Forced colors in a palette (mui/base-ui#4182)

- **WHEN** a themed inline combobox is shown with `forced-colors: active` and the user arrows
  to an item
- **THEN** the highlighted item has a visible outline in a system colour

## ADDED Requirements

### Requirement: Free-Text Mode

With `selectionMode: "none"` and without `inline` (Free-Text Mode, Free-Text Forms and
Free-Text Escape And Clear apply only to this configuration) the Combobox SHALL be an
autocomplete: the value SHALL be the input text, reported through `onInputValueChange(text,
details)`; `onValueChange` SHALL never be called; there SHALL be no selection (options carry
`aria-selected="false"`, no `aria-multiselectable`, no `data-selected`); every text change by
the user SHALL propose `inputValue` with reason `input-change`; blur, Tab, an outside press,
closing the popup and a change of the suggestions SHALL NOT change it. Choosing a suggestion
(Enter on the highlight, or a press) SHALL set `inputValue` to the suggestion's text value
with reason `item-press` or `enter`, carry the chosen key in the change details, place the
caret at the end, close the popup (`closeOnSelect`, default true), keep focus in the input
and then call `onAction(key, details)` when given. `onAction`'s details SHALL be the same in
every configuration: `{ modality, modifiers: { shift, alt, ctrl, meta, mod } }`. A suggestion rendered as a link SHALL
navigate natively instead of filling. `autoComplete` SHALL be `list` (default: suggestions
filtered by the text) or `both` (filtered and completed inline); a completion SHALL be shown
but SHALL NOT be proposed as `inputValue` until accepted (Enter, Tab with `selectOnTab`, or
blur) or typed on.

#### Scenario: Free text survives blur (unovue/reka-ui#779)

- **WHEN** the user types "Atlantis", which matches no suggestion, and tabs away
- **THEN** `inputValue` is "Atlantis" and no change callback fired on blur

#### Scenario: Options never read as selected (tailwindlabs/headlessui#1599)

- **WHEN** the popup of a free-text combobox lists three suggestions
- **THEN** each has `aria-selected="false"`

#### Scenario: Pick a suggestion

- **WHEN** the user types "ro" and presses Enter on the highlighted "Rome"
- **THEN** `inputValue` is "Rome", the details carry the key of "Rome", the popup closes and
  the caret is after "Rome"

#### Scenario: Completion is not the value until accepted

- **WHEN** with `autoComplete="both"` the user types "ca" and the input shows "canada" with
  "nada" selected
- **THEN** `inputValue` is "ca", and after Enter it is "Canada"

#### Scenario: No announcer gap (adobe/react-spectrum#10326)

- **WHEN** on Safari on macOS the user arrows to a suggestion of a free-text combobox
- **THEN** the same focus announcement as a selecting combobox is made

#### Scenario: Same IME rule as selection

- **WHEN** a user composing Japanese presses Enter to accept a candidate while a suggestion
  is highlighted
- **THEN** the input contains the composed text, no suggestion fills it and no form is
  submitted

### Requirement: Free-Text Forms

In free-text mode (not inline) the visible input SHALL be the form control: it SHALL carry `name`,
`form`, `required`, `disabled`, `readOnly` and `formAutoComplete` as its native
`autocomplete` attribute when given (`off` otherwise), and SHALL take part in submission,
constraint validation, reset and implicit submission natively, with no hidden input. Enter
with a highlighted suggestion SHALL fill and prevent submission unless `submitOnChoose` is
set, in which case the form SHALL be submitted once after the text is updated; Enter with no
highlight SHALL close the popup and SHALL NOT prevent submission. A form reset SHALL restore
`defaultInputValue`. The Input SHALL be the Field's validity element.

#### Scenario: Search on Enter (chakra-ui/zag#2521, adobe/react-spectrum#6228)

- **WHEN** the user types "rust" in a search form and presses Enter with nothing
  highlighted
- **THEN** the form is submitted with the input's name and "rust"

#### Scenario: Submit on choose

- **WHEN** with `submitOnChoose` the user presses Enter on the highlighted "Rome"
- **THEN** the form is submitted once and the submitted text is "Rome"

#### Scenario: Value in the form data (mui/base-ui#4724)

- **WHEN** a free-text combobox named `q` whose popup has never opened is submitted with
  "rust"
- **THEN** the form data has `q=rust` and exactly one element carries the name

### Requirement: Free-Text Escape And Clear

In free-text mode (not inline) Escape SHALL follow `combobox-pattern` while the popup is open; a closed
popup has nothing to revert: with `clearOnEscape` (default false) Escape SHALL clear the
text (reason `escape`) and be handled, otherwise it SHALL be left unhandled. The
ClearTrigger SHALL clear the text with reason `clear` and keep focus in the input.

#### Scenario: Escape keeps free text (mui/base-ui#4245)

- **WHEN** a closed free-text combobox without `clearOnEscape` shows "Atlantis" and the user
  presses Escape
- **THEN** the text is still "Atlantis"

#### Scenario: Escape in a dialog

- **WHEN** a closed free-text combobox with text, without `clearOnEscape`, is inside a modal
  dialog and the user presses Escape
- **THEN** the dialog closes and the text is unchanged

### Requirement: Inline Mode

With `inline` the Combobox SHALL be a command palette: the List SHALL be rendered in place
of a popup and always shown, satisfying `combobox-pattern` "Usable Without A Popup". The
states SHALL be derived from the props: an inline Combobox SHALL run a machine definition with
the single state `open` and no closed state, no open or close transitions (the same actions,
guards and context as the popup machine, from one shared setup); there SHALL be no trigger,
positioning, dismissal, overlay or commit. `inline` SHALL imply `selectionMode: "none"`; combining it with
`single` or `multiple` SHALL be a development error. The input's `aria-expanded` SHALL be
`true` whenever the listbox is exposed and `false` while the empty state hides it. Home, End,
Left and Right SHALL edit the text and SHALL NOT move the highlight; keys SHALL be handled
only when the input is the event target. The input SHALL be named by the Label or a consumer
`aria-label` (development warning after mount when neither exists); its description SHALL be
a Field's Description or the consumer's `aria-describedby`. Root and Control `data-state`
SHALL follow the input's `aria-expanded` (`open` while the listbox is exposed, `closed` while
the empty state hides it). The API SHALL expose `navigate(move)` and `highlight(key)`, and the
Combobox SHALL bind no keys beyond those specified, so an application adds its own bindings.

#### Scenario: Always expanded while there are results

- **WHEN** an inline combobox lists five items and the user types a query matching two
- **THEN** the input keeps `aria-expanded="true"` and `aria-controls` pointing at the
  listbox, and no element outside the combobox becomes inert or `aria-hidden`

#### Scenario: Nothing matches

- **WHEN** the user types "zzz" and nothing matches
- **THEN** the listbox is hidden, the input has `aria-expanded="false"`, the Empty part shows
  its content outside the listbox, and `noResults` is announced once

#### Scenario: Home edits the text (dip/cmdk#341)

- **WHEN** the input contains "open file", the third item is highlighted and the user
  presses Home
- **THEN** the caret moves to the start and the third item stays highlighted

#### Scenario: Click keeps the highlight (huntabyte/bits-ui#2063)

- **WHEN** the user clicks the fourth item of an inline combobox and then presses ArrowDown
- **THEN** the fifth item is highlighted

#### Scenario: Active descendant matches the highlight (dip/cmdk#413, dip/cmdk#373)

- **WHEN** the user arrows to "Profile", types "pro", then clears the query
- **THEN** after the typing pause `aria-activedescendant` names the highlighted first item, the
  item Enter runs

#### Scenario: Two palettes (dip/cmdk#368)

- **WHEN** two inline comboboxes are rendered and the user types into the second
- **THEN** focus stays in the second input

#### Scenario: Enter from another control (dip/cmdk#353)

- **WHEN** a native select rendered inside the root has focus and the user presses Enter
- **THEN** no item runs

### Requirement: Running Actions

In inline mode choosing an item (Enter on the highlighted item, or a press released on it,
including a bare `click` from assistive technology) SHALL call the item's `onAction` and then
the root's `onAction(key, details)` exactly once, with details carrying the modality and the
keyboard modifiers, SHALL NOT change the text and SHALL NOT move the highlight. Disabled
items SHALL never run. An item rendered as a link SHALL navigate natively: Enter SHALL
activate the link once with the modifiers of the Enter keydown.

#### Scenario: Run by keyboard

- **WHEN** "New file" is highlighted and the user presses Enter
- **THEN** `onAction` is called once with its key and every option still has
  `aria-selected="false"`

#### Scenario: Link item opens once (adobe/react-spectrum#9431)

- **WHEN** a link item "Settings" is highlighted and the user presses Enter
- **THEN** the browser navigates once and one history entry is added

#### Scenario: Link item in a new tab (adobe/react-spectrum#8992)

- **WHEN** a link item is highlighted and the user presses mod+Enter
- **THEN** the link is activated with the modifier, as a native mod+click would be

#### Scenario: Tap on a phone (dip/cmdk#85)

- **WHEN** the user taps an item without moving the finger
- **THEN** the item runs once

### Requirement: Inline Escape

In inline mode Escape SHALL be ignored while composing. Otherwise, when the query is not
empty, Escape SHALL clear it (reason `escape`) and be prevented; when the query is empty and
`onOpenChange` is given, Escape SHALL call `onOpenChange(false, { reason: "escape" })` and be
prevented, the machine staying open (the host decides, e.g. closes its dialog); when
`onOpenChange` is not given, Escape SHALL be left unhandled so an enclosing layer closes.

#### Scenario: Clear then close

- **WHEN** an inline combobox with the query "theme" is in an open modal dialog whose
  `onOpenChange` closes the dialog, and the user presses Escape twice
- **THEN** the first Escape clears the query and the dialog stays open, and the second calls
  `onOpenChange(false)` once and the dialog closes

### Requirement: Inline Highlight And Scrolling

In inline mode with `autoHighlight` (default true) the first navigable item SHALL be
highlighted at mount, after every query change and when results arrive while nothing is
highlighted, with highlight source `typing` (so `aria-activedescendant` follows after the
pattern's typing pause). Mounting SHALL NOT scroll any scroller and SHALL NOT announce the
count. Navigation SHALL loop by default. A pointer highlight SHALL stay when the pointer
leaves the list. A highlighted item that survives a collection change SHALL stay
highlighted; appended items SHALL NOT reset it. Keyboard navigation SHALL scroll the
highlighted item into view within the list's scroller (nearest edge), never the window; a
query change SHALL reset the list's scroll to the top in the same update that renders the
new results; pointer highlights and collection changes SHALL NOT scroll. Every query change
after mount SHALL announce the `count(n)` message ("N results") politely, keyed per
instance.

#### Scenario: Input announced first (mui/base-ui#4247)

- **WHEN** an inline combobox inside a dialog mounts and its input receives focus
- **THEN** the first item has `data-highlighted` at once, and the input has no
  `aria-activedescendant` until the typing pause after mount

#### Scenario: Mount does not scroll the page (dip/cmdk#405, dip/cmdk#317)

- **WHEN** an inline combobox is rendered below the fold of a long page
- **THEN** the window's scroll position is unchanged after mount

#### Scenario: Arrows work again after an empty result (huntabyte/bits-ui#996)

- **WHEN** the user types "zzz" (no results) and then deletes one character so three items
  match
- **THEN** the first of the three is highlighted and ArrowDown moves to the second

#### Scenario: Async items appended (dip/cmdk#97)

- **WHEN** the user arrowed to the eighth item and the consumer appends ten more items
- **THEN** the eighth item stays highlighted

#### Scenario: New query starts at the top (dip/cmdk#389, dip/cmdk#233)

- **WHEN** the list was scrolled to its end and the user changes the query so that more items
  match
- **THEN** the list is scrolled to the top, the first item is highlighted and "N results" is
  announced once

### Requirement: Filtering Without Reordering

By default the Combobox SHALL filter with `combobox-pattern`'s locale-aware,
accent-insensitive `contains` matcher applied to each item's text value and its keywords; it
SHALL accept another matcher and SHALL show the collection unfiltered when `filter` is
`null`. Filtering SHALL never reorder items or sections: the listed order SHALL be the
collection's, and an empty query SHALL list the collection in its original order. Sections
left without items SHALL be hidden. The search text SHALL be the item's text value, never
its key. Groups SHALL be labelled by their GroupLabel through `aria-labelledby`; separators
SHALL be `role="none"`; the listbox SHALL contain only options and groups.

#### Scenario: Original order after clearing (dip/cmdk#264, dip/cmdk#375)

- **WHEN** the user types "e" and then clears the query
- **THEN** the items are listed in exactly the order they were given

#### Scenario: Keywords (dip/cmdk#146)

- **WHEN** the item "Remove item" declares the keywords "delete" and "trash" and the user
  types "trash"
- **THEN** "Remove item" is listed

#### Scenario: Label, not key (dip/cmdk#74)

- **WHEN** an item with key "cmd-42" and text "Toggle theme" exists and the user types "theme"
- **THEN** it is listed, and typing "cmd-42" lists nothing

#### Scenario: Accents (dip/cmdk#173)

- **WHEN** the locale is `fr` and the user types "ecran"
- **THEN** the item "Écran partagé" is listed

#### Scenario: Large lists (dip/cmdk#191)

- **WHEN** an inline combobox has 10,000 static items and the user deletes the query one
  character at a time
- **THEN** each change renders the new results without re-rendering items whose visibility and
  highlight did not change

#### Scenario: Valid listbox children (dip/cmdk#179)

- **WHEN** an inline combobox with two groups, a separator between them and a visible Loading
  part is checked with axe
- **THEN** there is no `aria-required-children` or `aria-required-parent` violation

#### Scenario: Ranked by the consumer

- **WHEN** `filter` is `null` and the consumer passes, for each query, a collection ranked by
  its own scorer
- **THEN** the items are listed in the consumer's order

### Requirement: Loading

While the collection's async status is `loading`, the Root SHALL carry `data-loading`, the
listbox SHALL carry `aria-busy="true"`, the Loading part SHALL render its content as a
sibling of the listbox (never inside it) with no live-region role, and the `loading` message
SHALL be announced once per loading period. While loading with no option listed, the Empty
part SHALL NOT render its content.

#### Scenario: Searching

- **WHEN** the consumer sets the status to `loading` after the user typed "inv"
- **THEN** the Loading part shows, "Loading…" is announced once, and "No results" is not
  shown

### Requirement: Pages

In inline mode the Combobox SHALL accept `page` (`{ key, label, depth }`, `depth` 0 for the
root page) as a read-only binding and `onBack()`. When `page.key` changes, it SHALL clear the query (reason `page`), reset the
list's scroll to the top, highlight the first navigable item and announce
`pageAnnouncement(label)` ("{label}"). Backspace SHALL call `onBack` and be prevented when
`onBack` is given, the page's `depth` is greater than 0, the query is empty, the caret is at the start with no selected text and
no composition is in progress; otherwise Backspace SHALL edit the text.

#### Scenario: Back from a nested page

- **WHEN** the user is on the page "Projects" with an empty query and presses Backspace
- **THEN** `onBack` is called once, and after the consumer sets `page` to the root page the
  query is empty, its first item is highlighted and the root page's label is announced

#### Scenario: Backspace on the root page

- **WHEN** the page's `depth` is 0, the query is empty and Backspace is pressed
- **THEN** `onBack` is not called

#### Scenario: Backspace edits text

- **WHEN** the query on a nested page is "ab" and the user presses Backspace
- **THEN** the query becomes "a" and `onBack` is not called

### Requirement: Inside A Dialog

An inline Combobox SHALL work as the content of add-dialog's modal dialog with no part of its
own: the dialog's initial focus rule SHALL land on the input (the first tabbable element)
when opened by keyboard or pointer, and on the dialog content when opened by touch; the
Combobox SHALL never move focus itself. The documented composition SHALL name the dialog with
a Title (visually hidden by default) and map `onOpenChange(false)` to closing the dialog.

#### Scenario: Keyboard open focuses the input (mui/base-ui#4247)

- **WHEN** the user opens the documented palette dialog with the keyboard
- **THEN** focus is in the input, the dialog is named by its Title, and the input by its Label

#### Scenario: Dialog has a name (dip/cmdk#393)

- **WHEN** the documented composition is rendered and opened
- **THEN** no missing-name development warning is logged by the dialog

#### Scenario: Touch open does not raise the keyboard (dip/cmdk#127)

- **WHEN** the palette dialog is opened by a tap
- **THEN** focus is on the dialog content, not the input

### Requirement: Variant Model Coverage

`testMachine` SHALL run `comboboxContract` over free-text configurations (static
suggestions, `autoComplete="both"`, in a form with `submitOnChoose`, inside a Field) and inline
configurations (static items, data items with keywords, groups with separators, `filter: null`
with consumer-ranked collections and `itemsQuery`, async loading and empty results, pages with
`onBack`, link items, inside a modal dialog, virtualized), in every modality including
`virtual`, in RTL, on emulated Apple/WebKit, Apple/Blink and Windows platforms, and with IME
replays, with an axe check per state. The inline configurations SHALL walk the inline machine definition, whose only
state is `open`.

#### Scenario: Generated paths for the palette

- **WHEN** the model runner walks the inline grouped configuration
- **THEN** every transition of the inline machine is covered, no `closed` state or open/close
  edge exists in its graph, and the generic invariants hold after each step
