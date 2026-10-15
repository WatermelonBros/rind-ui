## Purpose

Defines Command: a text input that filters an always-visible listbox of actions (a command
palette), built on `combobox-pattern` without a popup. Choosing an item runs an action;
nothing is selected.

## ADDED Requirements

### Requirement: Anatomy

The Command SHALL consist of these parts: `root` (`div`), `label` (`label`), `input`
(`input`), `description` (`p`), `list` (`div`), `item` (`div`), `item-text` (`span`),
`item-description` (`span`), `group` (`div`), `group-label` (`div`), `separator` (`div`),
`empty` (`div`) and `loading` (`div`). Only `root`, `input` and `list` SHALL be required.
`list`, `item`, `item-text`, `item-description`, `separator` and `empty` SHALL be
add-listbox's reusable listbox parts of the same names, and `group` and `group-label` its
`section` and `section-label` parts, all under `data-scope="command"`. Every
part SHALL accept the props of the element it renders and SHALL support element
substitution without a change in behaviour. Items SHALL come from a data collection or from
static item parts, with the same behaviour.

#### Scenario: Minimal palette

- **WHEN** a command renders a root, an input with `aria-label="Search commands"`, and a list
  of three static items
- **THEN** a combobox named "Search commands" controls a listbox showing the three items,
  and the first item is highlighted

### Requirement: Built On The Combobox Pattern Without A Popup

The Command SHALL satisfy `combobox-pattern` (from `add-combobox`) with the list always
rendered in place of a popup. These pattern requirements SHALL apply as specified: Roles And
Relations, Focus Stays In The Input (the list's empty space counts as the popup's), Highlight
While Typing, IME Composition, Filtering (the query is always the input text), Async And
Stale Results (the abort signal is aborted on a newer text change and on unmount), Empty
State (the list takes the popup's place), Set Metadata, Announcements, Virtualization And
Scrolling, Pointer Highlight, Option Activation, Pattern Messages and Pattern Contract,
except as narrowed below. Opening, Results While Closing, Popup Placement In The DOM,
Inline Completion and the popup-closing and commit steps of Enter, Escape And Tab SHALL NOT
apply: the Command has no closed state, no trigger, no positioning, no dismissal and no
commit. The input's `aria-expanded` SHALL be `true` whenever the listbox is exposed and
`false` while it is hidden by the empty state.

#### Scenario: Always expanded while there are results

- **WHEN** a command lists five items and the user types a query matching two
- **THEN** the input keeps `aria-expanded="true"` and `aria-controls` pointing at the
  listbox, and no element outside the command becomes inert or `aria-hidden`

#### Scenario: Nothing matches

- **WHEN** the user types "zzz" and nothing matches
- **THEN** the listbox is hidden, the input has `aria-expanded="false"`, the Empty part
  shows its content outside the listbox, and `noResults` is announced once

### Requirement: Highlight And Initial State

With `autoHighlight` (default true) the first navigable item SHALL be highlighted when the
command mounts, after every query change and when results for the current query arrive while
nothing is highlighted, with highlight source `typing`, so `aria-activedescendant` follows
only after the pattern's typing pause. Mounting SHALL NOT scroll any scroller, the list
included, and SHALL NOT announce the count. Navigation SHALL loop by default (`loop`).
A pointer highlight SHALL stay when the pointer leaves the list (`keepHighlight`, default
true). Running an item SHALL NOT move the highlight. A highlighted item that survives a
collection change SHALL stay highlighted; items appended to the collection SHALL NOT reset
the highlight.

#### Scenario: Input announced first (mui/base-ui#4247)

- **WHEN** a command inside a dialog mounts and its input receives focus
- **THEN** the first item has `data-highlighted` at once, and the input has no
  `aria-activedescendant` until 500 ms after mount

#### Scenario: Mount does not scroll the page (dip/cmdk#405, dip/cmdk#317)

- **WHEN** a command is rendered below the fold of a long page
- **THEN** the window's scroll position is unchanged after mount

#### Scenario: Arrows work again after an empty result (huntabyte/bits-ui#996)

- **WHEN** the user types "zzz" (no results) and then deletes one character so three items
  match
- **THEN** the first of the three is highlighted and ArrowDown moves to the second

#### Scenario: Click keeps the highlight (huntabyte/bits-ui#2063)

- **WHEN** the user clicks the fourth item and then presses ArrowDown
- **THEN** the fifth item is highlighted

#### Scenario: Async items appended (dip/cmdk#97)

- **WHEN** the user arrowed to the eighth item and the consumer appends ten more items
- **THEN** the eighth item stays highlighted

#### Scenario: Active descendant matches the highlight (dip/cmdk#413, dip/cmdk#373)

- **WHEN** the user arrows to "Profile", types "pro", then clears the query
- **THEN** after the typing pause `aria-activedescendant` names the highlighted first item,
  the item Enter runs

### Requirement: Keyboard Interactions

DOM focus SHALL stay in the input. In the input: ArrowDown and ArrowUp SHALL move the
highlight to the next and previous navigable item; PageDown and PageUp SHALL move it by a
page; Enter SHALL run the highlighted item and prevent the default action; Left, Right,
Home and End SHALL move the caret and SHALL NOT move the highlight; Tab and Shift+Tab SHALL
move focus out normally. Every key SHALL be ignored for list purposes while composing. Keys
SHALL be handled only when the input is the event target, never for other controls inside
the root. The Command SHALL bind no keys beyond those this capability specifies; the API SHALL expose `navigate(move)` and
`highlight(key)` so an application can add its own bindings.

#### Scenario: Home edits the text (dip/cmdk#341)

- **WHEN** the input contains "open file", the third item is highlighted and the user
  presses Home
- **THEN** the caret moves to the start of the text and the third item stays highlighted

#### Scenario: App shortcut is not a navigation key (huntabyte/bits-ui#1067)

- **WHEN** the user presses Ctrl+K in the input
- **THEN** the highlight does not move

#### Scenario: Enter from another control (dip/cmdk#353)

- **WHEN** a native select rendered inside the root has focus and the user presses Enter
- **THEN** no item runs

#### Scenario: Korean ArrowDown (dip/cmdk#348)

- **WHEN** the user is composing Korean text and presses ArrowDown
- **THEN** the highlight does not move

#### Scenario: Japanese Enter in Safari (dip/cmdk#206)

- **WHEN** on Safari a user confirms a Japanese candidate with Enter (`keyCode` 229)
- **THEN** no item runs

### Requirement: Running Items

Choosing an item (Enter on the highlighted item, or a press released on it, including a bare
`click` from assistive technology) SHALL call the item's `onAction` and then the root's
`onAction(key, details)` exactly once, with details carrying the modality and the keyboard
modifiers. Disabled items SHALL never run. Nothing SHALL be selected: options SHALL carry
`aria-selected="false"`. An item rendered as a link SHALL navigate natively: Enter SHALL
activate the link once with the modifier keys of the Enter keydown, so mod+Enter and
Shift+Enter keep the browser's new-tab and new-window behaviour. The Command SHALL NOT close
anything: closing an enclosing dialog is the consumer's choice in `onAction`.

#### Scenario: Run by keyboard

- **WHEN** "New file" is highlighted and the user presses Enter
- **THEN** `onAction` is called once with the key of "New file" and every option still has
  `aria-selected="false"`

#### Scenario: Highlight is not selection (dip/cmdk#83)

- **WHEN** the user arrows to the second item
- **THEN** it has `data-highlighted` and `aria-selected="false"`

#### Scenario: Link item opens once (adobe/react-spectrum#9431)

- **WHEN** a link item "Settings" is highlighted and the user presses Enter
- **THEN** the browser navigates once and one history entry is added

#### Scenario: Link item in a new tab (adobe/react-spectrum#8992)

- **WHEN** a link item is highlighted and the user presses mod+Enter
- **THEN** the link is activated with the modifier, as a native mod+click would be

#### Scenario: Tap on a phone (dip/cmdk#85)

- **WHEN** the user taps an item without moving the finger
- **THEN** the item runs once

### Requirement: Escape

Escape SHALL be ignored while composing. Otherwise, when the query is not empty and
`clearOnEscape` is true (default), Escape SHALL clear the query (reason `escape`) and be
prevented; when the query is empty, Escape SHALL be left unhandled so an enclosing layer
closes.

#### Scenario: Clear then close

- **WHEN** a command with the query "theme" is in an open modal dialog and the user presses
  Escape twice
- **THEN** the first Escape clears the query and the dialog stays open, and the second closes
  the dialog

### Requirement: Filtering Without Reordering

By default the Command SHALL filter with `combobox-pattern`'s locale-aware,
accent-insensitive `contains` matcher applied to each item's text value and its keywords;
it SHALL accept another matcher and SHALL show the collection unfiltered when `filter` is
`null`. Filtering SHALL never reorder items or sections: the listed order SHALL be the
collection's order, and an empty query SHALL list the collection in its original order.
Sections left without items SHALL be hidden. The search text SHALL be the item's text value,
never its key.

#### Scenario: Original order after clearing (dip/cmdk#264, dip/cmdk#375, huntabyte/bits-ui#1241)

- **WHEN** the user types "e" and then clears the query
- **THEN** the items are listed in exactly the order they were given

#### Scenario: Ranked by the consumer

- **WHEN** `filter` is `null` and the consumer passes, for each query, a collection ranked by
  its own scorer
- **THEN** the items are listed in the consumer's order

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

- **WHEN** a command has 10,000 static items and the user deletes the query one character at
  a time
- **THEN** each change renders the new results without re-rendering items whose visibility
  and highlight did not change

### Requirement: Groups And Separators

Groups SHALL be collection sections: a `group` element labelled by its GroupLabel through
`aria-labelledby`, the label neither an option nor counted in set metadata. Separators SHALL
use add-separator's `separatorProps` in the `listbox` context (`role="none"`). The listbox
SHALL contain only options and groups.

#### Scenario: Valid listbox children (dip/cmdk#179)

- **WHEN** a command with two groups, a separator between them and a visible Loading part is
  checked with axe
- **THEN** there is no `aria-required-children` or `aria-required-parent` violation

### Requirement: Loading

While the collection's async status is `loading`, the root SHALL carry `data-loading`, the
listbox SHALL carry `aria-busy="true"`, the Loading part SHALL render its content as a
sibling of the listbox (never inside it) with no live-region role, and the `loading` message
SHALL be announced once per loading period. While the status is `loading` and no option is
listed, the Empty part SHALL NOT render its content.

#### Scenario: Searching

- **WHEN** the consumer sets the status to `loading` after the user typed "inv"
- **THEN** the Loading part shows, "Loading…" is announced once, and "No results" is not
  shown

### Requirement: Pages

The Command SHALL accept `page` (`{ key, label }`) as a read-only binding and `onBack()`.
When `page.key` changes, the Command SHALL clear the query (reason `page`), reset the list's
scroll position to the top, highlight the first navigable item and announce
`pageAnnouncement(label)`. Backspace in the input SHALL call `onBack` and be prevented when
`onBack` is given, the query is empty, the caret is at the start with no selected text and no
composition is in progress; otherwise Backspace SHALL edit the text.

#### Scenario: Back from a nested page

- **WHEN** the user is on the page "Projects" with an empty query and presses Backspace
- **THEN** `onBack` is called once, and after the consumer sets `page` to the root page the
  query is empty and its first item is highlighted

#### Scenario: Backspace edits text

- **WHEN** the query on a nested page is "ab" and the user presses Backspace
- **THEN** the query becomes "a" and `onBack` is not called

### Requirement: Scrolling

Keyboard navigation SHALL scroll the highlighted item into view within the list's scroller
with the nearest-edge rule, never scrolling the window. A query change SHALL reset the list's
scroll position to the top in the same update that renders the new results. Pointer
highlights and collection changes SHALL NOT scroll.

#### Scenario: New query starts at the top (dip/cmdk#389, dip/cmdk#233)

- **WHEN** the list was scrolled to its end and the user changes the query so that more items
  match
- **THEN** the list is scrolled to the top and the first item is highlighted

### Requirement: Inside A Dialog

The Command SHALL work as the content of add-dialog's modal dialog with no part of its own:
the dialog's initial focus rule SHALL land on the input (the first tabbable element) when the
dialog is opened by keyboard or pointer, and on the dialog content when opened by touch; the
Command SHALL never move focus itself. The documented composition SHALL name the dialog with
a Title (visually hidden by default), so the dialog's accessible-name rule passes. Opening
shortcuts SHALL be the application's.

#### Scenario: Keyboard open focuses the input (mui/base-ui#4247)

- **WHEN** the user opens the documented palette dialog with the keyboard
- **THEN** focus is in the input, the dialog is named by its Title, and the input is named by
  its Label

#### Scenario: Dialog has a name (dip/cmdk#393)

- **WHEN** the documented composition is rendered and opened
- **THEN** no missing-name development warning is logged by the dialog

#### Scenario: Touch open does not raise the keyboard (dip/cmdk#127)

- **WHEN** the palette dialog is opened by a tap
- **THEN** focus is on the dialog content, not the input

#### Scenario: Two palettes (dip/cmdk#368)

- **WHEN** two commands are rendered and the user types into the second
- **THEN** focus stays in the second input

### Requirement: Names And Descriptions

The input SHALL be named by the Label part (native `<label for>`) or a consumer
`aria-label`; when neither exists after mount a development warning SHALL name the instance.
The listbox SHALL be named by the Label, else by the `listboxLabel` message. The Description
part (for example the shortcut hints of a palette footer) SHALL be referenced by the input's
`aria-describedby` while rendered.

#### Scenario: Shortcut hints are described (mui/base-ui#4248)

- **WHEN** the Description part renders "Enter to run, Escape to close"
- **THEN** the input's accessible description is that text

#### Scenario: Localised list name (dip/cmdk#196)

- **WHEN** no Label part is rendered and `messages.listboxLabel` is "Comandi"
- **THEN** the listbox is named "Comandi" and has no `aria-labelledby`

### Requirement: Command Data Attributes

The root SHALL carry `data-scope="command"`, `data-part="root"`, `data-empty` while no option
is listed, `data-loading` while loading, and `data-page` with the current page key. The input
SHALL carry `data-focus`, `data-focus-visible` and `data-disabled`, and no `data-state`. The
list, items, groups, group labels, separators and Empty SHALL carry add-listbox's listbox-part
attributes under `data-scope="command"`, with `data-highlighted` and, after a keyboard
highlight, `data-focus-visible` on the highlighted item. The Loading part SHALL carry
`data-part="loading"`. `data-variant` and `data-size` given by the consumer SHALL be passed
through untouched.

#### Scenario: Keyboard highlight ring

- **WHEN** the user arrows to "Open recent"
- **THEN** it carries `data-highlighted` and `data-focus-visible`, and the input keeps
  `data-focus`

### Requirement: Command Messages

Every string that reaches assistive technology SHALL come from typed `messages` with English
defaults: the `combobox-pattern` messages that apply without a popup (`listboxLabel`,
`count(n)`, `noResults`, `loading`, `focusAnnouncement`) and `pageAnnouncement(label)`
("{label}").

#### Scenario: Page announced

- **WHEN** the consumer sets `page` to `{ key: "projects", label: "Projects" }`
- **THEN** "Projects" is announced politely once

### Requirement: Command Contract

The contract SHALL declare scope `command`, locate an instance by role `combobox` and exact
accessible name on the input part, and include the `combobox-pattern` contract fragment
without `open()` and `close()` (declared `{ skip }` with the reason "no popup"), the
collection contract fragment with the `active-descendant` strategy and `itemRole: "option"`,
and the traits `composite-activedescendant` (with `focusAnnouncement` and
`countAnnouncement`) and `set-metadata`, and not `selectable`, `layer`, `presence` or
`anchored`. It SHALL add the actions `run(name)` (pointer: press the item; keyboard: arrow to
it and press Enter; postcondition: `onAction` observed for its key), `back()` (keyboard:
Backspace on an empty query), and the queries `items()` (listed item names in order),
`highlighted()` and `page()`, and the per-component invariant that no option has
`aria-selected="true"`. Every machine event SHALL map to an action, a `{ skip }` with a
reason, or a prop step for `inputValue` and `page`.

#### Scenario: Run a command by keyboard

- **WHEN** a driver test runs `type("the")` then `run("Toggle theme")` with the keyboard
  modality
- **THEN** it arrows to the item, presses Enter, and resolves once `onAction` was observed

#### Scenario: Consumer wrapper marks the highlight as selected

- **WHEN** a consumer's styled wrapper sets `aria-selected="true"` on the highlighted item and
  `testMachine` runs
- **THEN** the "options never selected" invariant fails naming the item

### Requirement: Model-Based Coverage

`testMachine` SHALL run the Command contract over these props classes: static items, data
items, grouped items with separators, `filter: null` with consumer-ranked collections and
`itemsQuery`, async loading and empty results, pages with `onBack`, link items, inside a
modal dialog, and virtualized; in every modality including `virtual`, in RTL, on emulated
Apple/WebKit, Apple/Blink and Windows platforms, with IME replays and an axe check per state.

#### Scenario: Generated paths

- **WHEN** the model runner walks the Command graph for the grouped props class
- **THEN** every transition is covered and the generic invariants hold after each step

### Requirement: Theme

`@rind-ui/theme` SHALL ship `command.css` following add-theme-system's component stylesheet
convention, reading only tier-3 `--rind-command-*` tokens that default to semantic tokens,
with `data-variant` (`solid`, `soft`, `outline`, `ghost`) and `data-size` (`sm`, `md`, `lg`)
rules and a `data-tone="danger"` state. The keyboard highlight SHALL be visible without
colour alone (an outline on `[data-highlighted][data-focus-visible]`) and under
`forced-colors: active`; items SHALL meet the 24×24 CSS px target size.

#### Scenario: Forced colors (mui/base-ui#4182)

- **WHEN** the themed palette is shown with `forced-colors: active` and the user arrows to an
  item
- **THEN** the highlighted item has a visible outline in a system colour
