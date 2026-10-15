## Purpose

Defines, once, the behaviour of a text input that drives a listbox (in a popup, or shown
in place) through `aria-activedescendant` — opening, highlighting while typing, inline completion, IME,
async and stale results, the empty state, set metadata, announcements, virtualization
and the popup's place in the DOM — shared by Combobox, Autocomplete and, later,
Command, Tags Input and Mentions.

## ADDED Requirements

### Requirement: Roles And Relations

The input SHALL be a native text `<input>` (or an element substituted for it that keeps
text entry) with `role="combobox"`, `aria-autocomplete` (`list`, or `both` with inline
completion), `aria-expanded` (`true` only while the listbox is exposed), `aria-controls`
referencing the listbox element whenever it is rendered, and `aria-activedescendant`
referencing the highlighted option, absent when nothing is highlighted. The input SHALL
carry `autocomplete="off"`, `autocorrect="off"`, `autocapitalize="none"` and
`spellcheck="false"` unless the consumer overrides them. The listbox SHALL have
`role="listbox"` and an accessible name (by default `aria-labelledby` the Label part,
else the `listboxLabel` message). Options SHALL have `role="option"`. The listbox SHALL
contain only options, groups and separators; separators SHALL have `role="none"`
(decorative), built with add-separator's shared `separatorProps` helper in the `listbox`
context, since `listbox` allows only `option` and `group` children.

#### Scenario: Listbox has a name (mui/base-ui#5569)

- **WHEN** a combobox with the Label "Country" opens
- **THEN** its listbox's accessible name is "Country"

#### Scenario: No highlight, no active descendant

- **WHEN** the popup opens by typing with `autoHighlight` off
- **THEN** the input has no `aria-activedescendant` attribute and `aria-expanded="true"`

#### Scenario: Controls resolves

- **WHEN** the listbox is rendered, open or closing
- **THEN** the input's `aria-controls` references it, and while it is not rendered the
  attribute is absent

#### Scenario: Separator in the popup (regression: mui/base-ui#5398, ariakit#3315)

- **WHEN** an open popup shows a Separator between two groups and is checked with axe
- **THEN** the separator has `role="none"` and `aria-required-children` passes

### Requirement: Focus Stays In The Input

DOM focus SHALL stay in the input while the user navigates the popup, using the
`active-descendant` focus strategy of `collection-navigation`. A pointer press on an
option, a group label, a separator, the popup's empty space, the trigger or the clear
button SHALL NOT move focus out of the input. If the input does not have focus when such
a press happens with a mouse or pen, focus SHALL move to the input; a touch press SHALL
NOT focus the input (no on-screen keyboard is raised by a tap on an option).

#### Scenario: Click an option

- **WHEN** the user clicks an option with the mouse
- **THEN** the input never receives `blur` and keeps focus after the selection

#### Scenario: Press on popup padding (ariakit#6848)

- **WHEN** the user presses the popup's padding between two options, then ArrowDown
- **THEN** focus is still in the input and ArrowDown moves the highlight

#### Scenario: Tap an option on a phone

- **WHEN** the input is not focused and the user taps an option in an open popup
- **THEN** the option is chosen and the input is not focused

### Requirement: Opening

The popup SHALL open: on a text change by the user (`openOnInput`, default true); on
ArrowDown or ArrowUp (`openOnArrow`, default true) and on Alt+ArrowDown; on a press of
the trigger; on a press of the input (`openOnInputPress`, default false); and on focus
(`openOnFocus`, default false). Opening on focus SHALL NOT happen when focus was moved by
a layer's focus restore (`cause: "layer"`), when the window regained focus, or when the
input is read-only. ArrowDown SHALL highlight the selected option, else the first
navigable option; ArrowUp the selected, else the last; Alt+ArrowDown, a text change, a
press and a focus SHALL open without highlighting unless `autoHighlight` applies; a
trigger press with the keyboard or virtual modality SHALL highlight like ArrowDown. A
`readOnly` combobox SHALL open and be browsable but SHALL NOT change its value or text.
A disabled combobox SHALL NOT open.

#### Scenario: Focus restore does not open

- **WHEN** a dialog closes and restores focus to an input with `openOnFocus`
- **THEN** the popup stays closed

#### Scenario: Arrow opens on the selection

- **WHEN** "Italy" is selected and the user presses ArrowDown in the closed combobox
- **THEN** the popup opens with "Italy" highlighted and scrolled into view

#### Scenario: Alt+ArrowDown

- **WHEN** the user presses Alt+ArrowDown in the closed combobox
- **THEN** the popup opens and nothing is highlighted

### Requirement: Highlight While Typing

A text change SHALL clear the highlight, unless `autoHighlight` is on, in which case the
first navigable option of the new results SHALL be highlighted with source `typing`. A
highlight made by typing SHALL update `data-highlighted` at once and SHALL update the
input's `aria-activedescendant` only after the typing pause (default 500 ms, through the
scheduler), so the screen reader speaks the typed character first; Enter in the meantime
SHALL act on the highlighted option. A typing highlight SHALL NOT scroll the list
except to keep the highlighted option visible, and SHALL NOT announce. Left, Right, Home
and End SHALL clear the highlight and move the caret; while an option is highlighted
through keyboard navigation, Home and End SHALL move the caret too (they never move the
highlight).

#### Scenario: Typed letter is spoken first (React Aria useAutocomplete)

- **WHEN** with `autoHighlight` the user types "a" and "Apple" becomes highlighted
- **THEN** "Apple" has `data-highlighted` immediately, and the input's
  `aria-activedescendant` is set 500 ms after the last keystroke

#### Scenario: Arrow right returns to editing

- **WHEN** "Pear" is highlighted and the user presses ArrowRight
- **THEN** nothing is highlighted and the caret moves one character right

### Requirement: Inline Completion

With `autoComplete: "both"` (or `"inline"` in Autocomplete), a keyboard highlight (arrow
or typing) SHALL show the highlighted option's text in the input with the part after the
typed query selected; only typing forward (`insertText` or a committed composition) with
the caret at the end SHALL complete, re-checked whenever results arrive (a caret the
user moved SHALL never be overwritten); deleting, pasting or moving the caret SHALL remove
the completion; a pointer highlight SHALL NOT change the text; the query used for
filtering SHALL remain the typed text; completion SHALL be refused when the option text
does not start with the query after locale-aware comparison or when normalisation changes
the query's length; Escape while a completion is shown SHALL remove it. `aria-autocomplete`
SHALL be `both` (or `inline`).

#### Scenario: Backspace removes the completion

- **WHEN** the user typed "ca", the input shows "ca|nada|" with "nada" selected, and the
  user presses Backspace
- **THEN** the input shows "ca" and the list is filtered by "ca"

#### Scenario: Late results after the caret moved (ariakit#6916)

- **WHEN** the user typed "ca", moved the caret to the start, and new results arrive
- **THEN** no completion is written and the caret stays at the start

#### Scenario: Decomposed accents (ariakit#6315)

- **WHEN** the user types "café" in NFD form and "Cafeteria" is highlighted
- **THEN** no completion is shown

#### Scenario: Hover does not complete (Base UI AutocompleteRoot)

- **WHEN** the pointer moves over "Canada" while the user's text is "ca"
- **THEN** the input still shows "ca"

### Requirement: IME Composition

While a composition is in progress in the input, Enter, Escape, Tab, arrow keys, Home,
End and Backspace SHALL NOT select, commit, close, navigate or remove chips, and the
highlight SHALL NOT change. Text changes during a composition SHALL update the query
(so filtering works on soft keyboards that compose every word), but completion, auto
highlight and opening SHALL wait for the composition to end; the composition's commit
SHALL count as typing forward. The Enter that commits a composition SHALL NOT select or
submit, including Safari's Enter after `compositionend`.

#### Scenario: Japanese candidate Enter (keyboard-interactions IME guard)

- **WHEN** a user composing "とうきょう" presses Enter to accept the candidate "東京"
  while "Tokyo" is highlighted
- **THEN** the input contains "東京", nothing is selected, the popup stays open and no
  form is submitted

#### Scenario: Pointer choice during a composition (mui/base-ui#5574)

- **WHEN** the user clicks "東京都" while a composition is still showing preedit text
- **THEN** the composition is ended first and the input then shows the chosen option's
  text, with no preedit left behind

#### Scenario: CJK commit counts as typing (adobe/react-spectrum#10126)

- **WHEN** with `autoHighlight` a composition commits "東"
- **THEN** the first matching option is highlighted

#### Scenario: Korean syllables are not broken (ariakit#6663)

- **WHEN** a user types Korean with `autoHighlight` and the results change mid-syllable
- **THEN** the syllable in the input is not altered and the highlight changes only after
  the composition ends

#### Scenario: Android soft keyboard filters live (mui/base-ui#2942, tailwindlabs/headlessui#2575)

- **WHEN** an Android keyboard reports every Latin keystroke as composition text
- **THEN** the list is filtered after each keystroke

### Requirement: Enter, Escape And Tab

Enter SHALL be ignored when composing. While the popup is open with a highlighted
option, Enter SHALL choose it and SHALL `preventDefault()` so the form is not submitted;
with no highlight, Enter SHALL perform the component's commit (and close) and SHALL NOT
prevent form submission unless the component rejected the text. While the popup is
closed, Enter SHALL NOT be prevented. Escape SHALL, in order: remove an inline
completion; else close the open popup (which commits, as any close does); else, when the closed component has uncommitted
text, perform the component's commit; else do nothing and leave the event unhandled, so an enclosing layer
closes. Escape SHALL be prevented only when it acted. Tab SHALL close the popup, perform
the component's commit, and let focus move; it SHALL choose the highlighted option only
with `selectOnTab`, and never when the popup was opened by focus.

#### Scenario: Escape inside a dialog (dismissable-layer rule)

- **WHEN** a closed combobox with committed text is inside a modal dialog and the user
  presses Escape
- **THEN** the dialog closes

#### Scenario: Escape closes only the popup

- **WHEN** the popup of a combobox inside a dialog is open and the user presses Escape
- **THEN** the popup closes and the dialog stays open

#### Scenario: Enter submits when closed

- **WHEN** the popup is closed and the user presses Enter
- **THEN** the form's implicit submission runs

#### Scenario: Enter with nothing highlighted submits once (chakra-ui/zag#2521, adobe/react-spectrum#6228)

- **WHEN** the popup is open with no highlighted option, the typed text is accepted by
  the component, and the user presses Enter once
- **THEN** the popup closes and the form is submitted by that same Enter

#### Scenario: Enter on a highlighted option does not submit (adobe/react-spectrum#1646)

- **WHEN** the popup is open with "Rome" highlighted and the user presses Enter
- **THEN** "Rome" is chosen and the form is not submitted

#### Scenario: One Escape, one layer (ariakit#7632, adobe/react-spectrum#3306)

- **WHEN** the popup is open inside a dialog and the user presses Escape twice
- **THEN** the first closes only the popup, and the second reaches the dialog when the
  combobox has nothing to revert

#### Scenario: Tab through a form (tailwindlabs/headlessui#2932, #3771)

- **WHEN** `openOnFocus` opened the popup with an auto-highlighted option and the user
  presses Tab
- **THEN** focus moves to the next field and the option is not chosen

#### Scenario: Hovered option is not chosen by Tab (adobe/react-spectrum#2809)

- **WHEN** the pointer rests on "Paris" (highlighted by pointer) and the user presses Tab
- **THEN** "Paris" is not chosen

#### Scenario: Android "Next" key (tailwindlabs/headlessui#2672)

- **WHEN** an Android keyboard's "Next" key moves focus to the next field without a Tab
  key event
- **THEN** the popup closes and the component commits as for Tab

### Requirement: Filtering

The component SHALL filter the collection with a locale-aware, case- and
accent-insensitive `contains` matcher (`collection-model` filters) by default, SHALL
accept another matcher, and SHALL show the collection unfiltered when `filter` is
`null` (consumer or server filtering). The query SHALL be the input text, except that
when the popup is opened by the trigger or an arrow key while the text equals the
committed text (nothing typed since), the query SHALL be empty, so every option is
shown. Filtering SHALL be a derivation of the current collection and query; it SHALL NOT
be stored in the snapshot. Sections left empty SHALL be hidden.

#### Scenario: Trigger shows all options (React Aria showAllItems)

- **WHEN** "Italy" is selected, the input shows "Italy", and the user presses the trigger
- **THEN** every option is listed with "Italy" highlighted

#### Scenario: Accents

- **WHEN** the user types "sao" with locale `pt-BR`
- **THEN** "São Paulo" is listed

#### Scenario: Filter off means off (mui/base-ui#4196)

- **WHEN** `filter` is `null` and the user types "zz"
- **THEN** every option the consumer passed is listed

#### Scenario: Text shortcuts stay text shortcuts (kobaltedev/kobalte#499)

- **WHEN** the user presses mod+A in the input of a multiple-selection combobox
- **THEN** the input's text is selected and the selection of options is unchanged

### Requirement: Results While Closing

While the popup plays its exit animation, the listed options SHALL be those listed at
the moment it started closing, even when the query or the selection changes during the
exit, and presses on options of a closing popup SHALL be ignored.

#### Scenario: Press while closing (adobe/react-spectrum#2181)

- **WHEN** the user presses below a filtered list, the popup starts closing and the
  pointer is released over where the unfiltered list would be
- **THEN** no option is chosen

#### Scenario: No flash of the unfiltered list (kobaltedev/kobalte#514, React Aria lastCollection)

- **WHEN** the user chooses "Rome" from a list filtered by "ro" and the input text becomes
  "Rome" while the popup fades out
- **THEN** the fading list still shows the "ro" results

### Requirement: Async And Stale Results

The component SHALL NOT fetch. Every text change SHALL be reported with details carrying
an abort signal that is aborted when a newer text change is reported or the popup
closes. The component SHALL accept from the consumer which query the current collection answers
(`itemsQuery`); when it is given and differs from the current query, the collection
SHALL still be rendered but SHALL NOT trigger auto highlight, count announcements or the
empty state. The collections loading status SHALL set `aria-busy="true"` on the listbox
and `data-loading` on the popup, and SHALL announce the `loading` message once per
loading period. Highlight repair SHALL follow `collection-navigation` (by key), so a
highlighted option that survives a new result set stays highlighted.

#### Scenario: Out-of-order responses

- **WHEN** the user types "ro" then "rom", the response for "rom" arrives first and the
  response for "ro" arrives after it
- **THEN** the signal of the "ro" request was aborted when "rom" was typed, and a
  collection passed with `itemsQuery: "ro"` neither highlights nor announces nor shows
  the empty state

#### Scenario: Stable highlight while results stream

- **WHEN** "Rome" is highlighted and a new result set that still contains "Rome" arrives
- **THEN** "Rome" stays highlighted and the list does not scroll

### Requirement: Empty State

The open state SHALL NOT depend on the number of results: when the open popup's current
results contain no options (and are not loading or stale), the component SHALL stay
open, the listbox SHALL NOT be exposed (it SHALL be hidden) and the input's
`aria-expanded` SHALL be `false`; when options return, the listbox SHALL be exposed
again without any open transition. The Empty part SHALL render its content only in that
case, as a sibling of the listbox inside the popup and never inside the listbox, with no
live-region role; without an Empty part the popup surface SHALL be hidden as well. The
`noResults` message SHALL be announced through the announcer. The popup and the list SHALL
carry `data-empty`.

#### Scenario: Empty part outside the listbox (mui/base-ui#5443)

- **WHEN** the user types a query with no matches and the Empty part shows "No results"
- **THEN** the Empty element is not a descendant of the listbox, axe reports no
  `aria-required-children` violation, and "No results" is announced once

#### Scenario: Async miss then hit (adobe/react-spectrum#5690, #2333)

- **WHEN** an async search for "xq" returns nothing and the user then types "x", whose
  results arrive later with three options
- **THEN** the three options are exposed, `aria-expanded` is `true` and the count is
  announced, without the user reopening anything

### Requirement: Set Metadata

When the listed options are a filtered, sectioned or virtualized view of the collection,
every rendered option SHALL carry `aria-posinset` and `aria-setsize` computed from the
listed options (items only, sections excluded), recomputed in the same render as the
results.

#### Scenario: Groups followed by loose options (ariakit#6301)

- **WHEN** a filtered list renders a group of two options followed by three ungrouped ones
- **THEN** positions are 1 to 5, unique, and `aria-setsize` is 5

#### Scenario: Positions after filtering (adobe/react-spectrum#10711, unovue/reka-ui#2904)

- **WHEN** 14 options are filtered down to 2
- **THEN** they carry `aria-posinset` 1 and 2 and `aria-setsize` 2

### Requirement: Announcements

The component SHALL announce through the announcer, politely: the number of listed
options (`count` message) when the popup opens without a highlighted option and whenever
the count changes while open, with one coalescing key so only the last count of a typing
burst is spoken (on every platform: it is a status message); the `noResults` message
when results become empty; the `loading` message when loading starts. While the
`vo-activedescendant` quirk applies it SHALL also announce: the highlighted option's text
and selected state for keyboard highlights (not typing or pointer highlights), the
section label and its option count when the highlight enters a new section, and the
chosen option on selection. It SHALL make no highlight or selection announcement when
the quirk does not apply.

#### Scenario: Count does not pre-empt the role (adobe/react-spectrum#4941)

- **WHEN** the popup opens on focus
- **THEN** the count is announced politely after the coalescing delay, not assertively

#### Scenario: Count while typing (announcer coalescing key)

- **WHEN** typing "r", "o", "m" within 300 ms yields 40, 12 and 3 results
- **THEN** only "3 results" is announced

#### Scenario: VoiceOver in Safari (chakra-ui/zag#2936, adobe/react-spectrum#10326)

- **WHEN** on Safari on macOS the user arrows to "Apple"
- **THEN** one polite announcement equal to the contract's focus announcement for "Apple"
  is made

#### Scenario: VoiceOver in Chrome is not interrupted (adobe/react-spectrum#10220)

- **WHEN** on Chrome on macOS the user arrows from "Apple" to "Banana" in the same section
- **THEN** no announcement is made, and entering the next section announces its label and
  option count

#### Scenario: Windows

- **WHEN** the same arrows are pressed on Windows
- **THEN** no highlight or selection announcement is made, and count announcements still
  are

### Requirement: Popup Placement In The DOM

The popup SHALL render, by default, immediately after the Control in the DOM (not
portalled), positioned with the `dropdown` preset, `sideLock: "open"`, the anchor's width
exposed, and a fixed strategy so ancestor overflow does not clip it. Wrapping it in the
generic Portal SHALL keep every behaviour; the docs SHALL state that a portalled popup is
reached by a touch screen reader's swipe order only after the rest of the page. The
popup SHALL be a non-modal layer of kind `listbox`: it SHALL NOT make anything inert or
`aria-hidden`, SHALL be dismissed by an outside press (the input, trigger and clear
button count as inside), and SHALL NOT be dismissed by outside focus while focus stays
in the input. Positioning SHALL be computed only while the popup is open.

#### Scenario: Swipe order on iOS (the touch-SR concern behind mui/base-ui#5528)

- **WHEN** a VoiceOver iOS user swipes right from the input of an open combobox rendered
  with default parts
- **THEN** the next element reached is in the popup

#### Scenario: Nothing hidden (chakra-ui/ark#3699, unovue/reka-ui#2240)

- **WHEN** the popup is open
- **THEN** no element of the page outside the component has `aria-hidden` or `inert`
  added, and a live region elsewhere on the page still announces

#### Scenario: Filtering does not flip (floating-positioning side lock)

- **WHEN** the popup opened above the input and filtering shrinks it
- **THEN** it stays above

### Requirement: Virtualization And Scrolling

The component SHALL follow the collections virtualization contract: navigation over the
whole collection, the scroll-to-index callback, persisted keys (the highlighted key),
ids derived from keys. Opening SHALL scroll the highlighted option into view after the
first placement; keyboard navigation SHALL scroll with the nearest-edge rule; pointer
highlights, typing and collection changes SHALL NOT scroll except to reset the list to
the top when the query changes.

#### Scenario: End in 10,000 options

- **WHEN** a virtualized combobox has 10,000 options and the user presses ArrowUp to open
  and wrap to the last
- **THEN** the last option is highlighted, the scroll-to-index callback receives index
  9999, and `aria-activedescendant` resolves to a rendered element

### Requirement: Pointer Highlight

Pointer movement over an option SHALL highlight it (source `pointer`) only for real
movement, following `collection-navigation`'s pointer rules; pointer leave SHALL clear a
pointer highlight unless `keepHighlight`; touch SHALL never highlight on move (no
highlight while scrolling the list with a finger). A pointer highlight SHALL NOT change
`aria-activedescendant` announcements, inline completion or the scroll position.

#### Scenario: Resting mouse during keyboard scroll (mui/base-ui#4002)

- **WHEN** arrowing scrolls the list under a resting mouse and Safari fires a zero-delta
  `mousemove`
- **THEN** the keyboard highlight stays

#### Scenario: Finger scroll

- **WHEN** the user scrolls the list with a finger across several options
- **THEN** no option becomes highlighted

### Requirement: Option Activation

An option SHALL be chosen by Enter while highlighted, or by a press released on it
(mouse, pen, touch, and assistive-technology clicks with no pointer events); a touch
choice SHALL happen on the `click` after release so nothing under the closing popup is
activated. Disabled options SHALL NOT be highlighted by keyboard or pointer by default
(`focusableWhenDisabled: false`) and SHALL never be chosen. An option rendered as a link
SHALL navigate natively; modifier and middle clicks SHALL NOT choose it.

#### Scenario: VoiceOver press on the trigger (chakra-ui/zag#1664)

- **WHEN** VoiceOver activates the trigger with Ctrl+Option+Space (a bare `click`)
- **THEN** the popup opens like a keyboard open

#### Scenario: Screen reader double tap (virtual modality)

- **WHEN** iOS VoiceOver double-taps "Rome", delivering a bare `click`
- **THEN** "Rome" is chosen exactly once

#### Scenario: Ghost click on touch (adobe/react-spectrum#5522, huntabyte/bits-ui#1108)

- **WHEN** the user taps an option above a button and the popup closes
- **THEN** the button under the option is not activated

### Requirement: Pattern Data Attributes

The input SHALL carry `data-state` (`open` | `closed`), `data-focus`,
`data-focus-visible`, `data-disabled`, `data-readonly`, `data-invalid`. The popup and
positioner SHALL carry `data-state`, the placement attributes of `floating-positioning`,
`data-empty` and `data-loading`. The list SHALL carry the `collection-model` list
attributes. Options SHALL carry the `collection-model` item attributes, with
`data-focus-visible` on the highlighted option after keyboard highlight. The Empty part
SHALL carry `data-part="empty"`.

#### Scenario: Keyboard highlight ring

- **WHEN** the user arrows to "Pear"
- **THEN** "Pear" carries `data-highlighted` and `data-focus-visible`, and the input keeps
  `data-focus`

### Requirement: Pattern Messages

Every string that reaches assistive technology SHALL come from typed `messages` with
English defaults: `listboxLabel`, `triggerLabel` ("Show suggestions"), `clearLabel`
("Clear"), `count(n)` ("1 result" / "n results"), `noResults` ("No results"),
`loading` ("Loading…"), `focusAnnouncement(item, selected, section?)`,
`selectedAnnouncement(item)`.

#### Scenario: Plural count

- **WHEN** one option is listed with locale `en`
- **THEN** the count announcement is "1 result"

### Requirement: Usable Without A Popup

The pattern SHALL be popup-optional: a host that shows its list in place, with no popup
(Command), SHALL satisfy it with these requirements as specified — Roles And Relations,
Focus Stays In The Input (the list's empty space counts as the popup's), Highlight While
Typing, IME Composition, Filtering, Async And Stale Results, Empty State, Set Metadata,
Announcements, Virtualization And Scrolling, Pointer Highlight, Option Activation, Pattern
Messages and Pattern Contract — while Opening, Results While Closing, Popup Placement In The
DOM and the popup-closing and commit steps of Enter, Escape And Tab SHALL NOT apply to it;
Inline Completion is the host's choice. The pattern's effects (`patternEffects`) SHALL
NOT include the overlay layer or positioning: a host with a popup supplies its own overlay
and position-tracking effects (Combobox and Autocomplete do). The input props of
`patternConnect` SHALL take `aria-expanded` from the host's computed "list shown" state
(`exposed`), not from an `open` state, so a popup-less host spreads them unchanged. For a
popup-less host the contract SHALL declare `open()` / `close()` as `{ skip }` and SHALL NOT
declare the `layer`, `presence` and `anchored` traits. The pattern module SHALL export the
`optionsNeverSelected` invariant (no option is ever `aria-selected="true"`), so every host
whose options are never selected (Autocomplete, Command) declares the same invariant.

#### Scenario: Popup-less host spreads the input props

- **WHEN** a host with no popup and no overlay or positioning effect spreads
  `patternConnect`'s input props, lists two matching items and the user types a query
  matching none
- **THEN** the input has `aria-expanded="true"` while the two items are shown and
  `aria-expanded="false"` once nothing matches, and no element outside the host becomes
  inert or `aria-hidden`

#### Scenario: Shared never-selected invariant

- **WHEN** a popup-less host declares `optionsNeverSelected` and a consumer wrapper renders
  an option with `aria-selected="true"`
- **THEN** `testMachine` fails naming that option

### Requirement: Pattern Contract

The contract of a component built on this pattern SHALL include the collection contract
fragment with the `active-descendant` strategy and `itemRole: "option"`, the traits
`composite-activedescendant` (declaring `focusAnnouncement`, `countAnnouncement` and
`selectionAnnouncement`), `selectable` where options can be selected, `set-metadata`,
`layer`, `presence` and `anchored`, and these actions with keyboard implementations:
`type(text)` (one key event per character, `insertText`), `compose(text, commit)` (an
IME sequence), `open()` (pointer: trigger press; keyboard: ArrowDown), `close()`
(Escape), `pressEnter()`, `pressEscape()`, `tabOut()`, `clearText()`; and queries
`inputValue()`, `isOpen()`, `isEmpty()`, `isLoading()`, `announcements()`.

#### Scenario: Same test on both platforms

- **WHEN** a driver test types "ro" and arrows to "Rome" on an emulated Safari and an
  emulated Windows platform
- **THEN** both pass, and the Safari run records the focus announcement for "Rome" while
  the Windows run records only the count

#### Scenario: Composition through the driver

- **WHEN** a test runs `compose("東京", true)` followed by `pressEnter()`
- **THEN** the composing Enter selects nothing and the second Enter acts on the highlight
