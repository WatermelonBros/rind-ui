## Purpose

Defines the Tag Group: a standalone collection of tags (labels, keywords, filters,
recipients) that users browse with one Tab stop, optionally select, act on or follow as
links, and remove with focus moving to a neighbour and the removal announced.

## ADDED Requirements

### Requirement: Anatomy

A Tag Group SHALL consist of a Root, an optional Label, an optional Description, a List,
one Tag per collection item, a TagText inside each Tag, an optional TagRemove inside each
Tag, and an optional Empty part rendered inside the List only while the collection is empty.
Tags SHALL come from a data collection or from static Tag parts, through the collections
model; both SHALL produce the same DOM and behaviour. Each Tag SHALL render one internal cell
element that wraps its content.

#### Scenario: Minimal removable group

- **WHEN** a consumer renders Root, Label "Filters", List and three Tags each with TagText
  and TagRemove, and passes `onRemove`
- **THEN** the List is a `grid` named "Filters" with three `row` elements, each containing
  one `gridcell` that holds the text and a "Remove <text>" button

#### Scenario: Data and static tags agree

- **WHEN** the same three tags are given once as a `collection` and once as static Tag
  parts
- **THEN** the rendered roles, ids, attributes and keyboard behaviour are identical

### Requirement: Roles By Interactivity

The List SHALL have role `grid`, each Tag role `row` and each Tag's cell role `gridcell`,
whenever the group is interactive: tags are removable (`onRemove` is given), selectable
(`selectionMode` is not `none`), or any tag has an action or a link. An interactive group
with no tags SHALL render the List with role `group` and keep its name. A group that is not
interactive SHALL render the List as role `list` and each Tag as role `listitem`, with no
focusable element, no Tab stop and no keyboard handling. The List SHALL NEVER be an empty
`grid`, and no Tag SHALL be an `option` (a button or link inside an option is invalid).

#### Scenario: Empty interactive group (regression: adobe/react-spectrum#8354)

- **WHEN** the last tag of a removable group is removed
- **THEN** the List has role `group`, keeps its accessible name, contains the Empty part's
  text, and axe reports no `aria-required-children` or prohibited-attribute violation

#### Scenario: Display-only tags

- **WHEN** a group has no `onRemove`, `selectionMode="none"` and no tag has an action or link
- **THEN** the List is a `list` of `listitem`s and pressing Tab never focuses a tag

#### Scenario: Remove button is not inside an option (regression: ariakit/ariakit#6330)

- **WHEN** a removable group is rendered on a desktop and on a touch device
- **THEN** both render the same roles, and every TagRemove is a named `button` that is not
  `aria-hidden`

### Requirement: Names

The List SHALL be named by the Label part through `aria-labelledby` while the Label is
rendered, or by a consumer `aria-label`/`aria-labelledby`; an interactive List without a
name SHALL produce a development warning. The Description part, while rendered, SHALL be
referenced by the List's `aria-describedby`. Each interactive Tag SHALL be named by its
TagText through `aria-labelledby`, so the TagRemove's name is not part of the tag's name;
a consumer `aria-label` on a Tag SHALL replace that name. A Tag whose content is not plain
text SHALL take its text value from `textValue` for typeahead and announcements.

#### Scenario: Row name excludes the remove button (regression: adobe/react-spectrum#3070)

- **WHEN** a removable tag "Cool Tag 2" receives focus
- **THEN** its accessible name is "Cool Tag 2", not "Cool Tag 2 Remove Cool Tag 2"

#### Scenario: Consumer label wins (regression: adobe/react-spectrum#7310)

- **WHEN** a Tag with text "Rome" is given `aria-label="Rome, Italy"`
- **THEN** the row's accessible name is "Rome, Italy"

### Requirement: Focus And Navigation

An interactive group SHALL be exactly one Tab stop, using the collections `roving`
strategy over the Tags: the highlighted tag, else the first selected navigable tag, else the
first navigable tag, else the List itself. TagRemove buttons and link anchors inside tags
SHALL have `tabIndex=-1`. Navigation SHALL accept both arrow pairs: ArrowRight/ArrowDown move
to the next tag and ArrowLeft/ArrowUp to the previous one, with ArrowLeft and ArrowRight
mirrored under `dir="rtl"`; Home and End move to the first and last tag; moves SHALL loop
by default (`loop`, default `true`); printable characters run typeahead over the tags' text
values. Every key the group acts on SHALL have its default action prevented.

#### Scenario: One Tab stop (regression: adobe/react-spectrum#9822)

- **WHEN** a keyboard user tabs into a group of five removable tags and presses Tab again
- **THEN** the first Tab focuses one tag and the second leaves the group, without
  visiting any TagRemove

#### Scenario: RTL

- **WHEN** ArrowLeft is pressed on the first tag of a group under `dir="rtl"`
- **THEN** the second tag is focused

#### Scenario: Home does not scroll the page (regression: adobe/react-spectrum#10720)

- **WHEN** focus is on a tag in a long scrolling page and the user presses End
- **THEN** the last tag is focused and the page's scroll position is unchanged

#### Scenario: Shift+Tab leaves in one step (regression: adobe/react-spectrum#9532)

- **WHEN** focus is on the third tag and the user presses Shift+Tab
- **THEN** focus moves to the element before the group, not to a TagRemove

### Requirement: Removal

When `onRemove` is given, tags SHALL be removable and the group SHALL call
`onRemove(keys, details)` with the keys to remove; the consumer removes them from its data.
Delete and Backspace on a focused, enabled tag SHALL request its removal, or, when that tag
is selected, the removal of every selected enabled tag. Enter and Space on a removable tag
that has no link, no action and no selection SHALL request its removal. A press on a
TagRemove SHALL request the removal of its tag only. Removal SHALL be identified by key,
never by position, and a disabled tag SHALL NEVER be part of a removal request. Removed keys
that are selected SHALL be deselected through the selection value. Key repeats SHALL remove
one tag per repeat.

#### Scenario: Delete and Backspace agree (regression: chakra-ui/zag#1911)

- **WHEN** the user removes a tag with Delete in one run and with Backspace in another
- **THEN** both runs call `onRemove` with the same key, and arrow keys keep working
  afterwards

#### Scenario: Remove the selection

- **WHEN** "a" and "c" of "a, b, c" are selected and the user presses Delete on "c"
- **THEN** `onRemove` is called once with the keys "a" and "c", and the selection is empty

#### Scenario: Disabled tag next to the removed one (regression: unovue/reka-ui#2785)

- **WHEN** disabled tag "a" precedes selected tag "b" and the user presses Backspace on "b"
- **THEN** `onRemove` is called with "b" only

#### Scenario: Enter removes a remove-only tag (regression: adobe/react-spectrum#7483)

- **WHEN** a keyboard user focuses a removable, non-selectable tag without action or link
  and presses Enter
- **THEN** `onRemove` is called with that tag's key

#### Scenario: Enter selects a selectable tag

- **WHEN** a tag in a removable group with `selectionMode="multiple"` is focused and the
  user presses Enter
- **THEN** the tag's selection is toggled and `onRemove` is not called

#### Scenario: Consumer keeps the tag

- **WHEN** the consumer's `onRemove` does not remove the key from its data
- **THEN** the tag stays, focus stays on it and nothing is announced

### Requirement: Focus After Removal

When removed keys leave the collection while focus is inside the group, focus SHALL move by
the collections repair rule: to the first navigable tag after the removed one in the
previous order, else the nearest navigable tag before it, else the List — never to
`<body>`. Repair SHALL be driven by the collection data, not by Tag elements unmounting.

#### Scenario: Focus is never lost (regression: adobe/react-spectrum#9471, #4224)

- **WHEN** the focused tag "b" of "a, b, c" is removed after the selection changed through
  another control
- **THEN** "c" is focused

#### Scenario: Last tag removed

- **WHEN** the only remaining tag is removed with Delete
- **THEN** focus is on the List, which has role `group`

#### Scenario: Run of disabled tags (regression: adobe/react-spectrum#6616)

- **WHEN** the last tag is removed and the two tags before it are disabled but focusable by
  default
- **THEN** focus moves to the tag just before it, and nothing hangs

#### Scenario: Removal by pointer

- **WHEN** focus is on tag "a" and the user clicks the TagRemove of tag "b"
- **THEN** "b" is removed and focus moves to the tag after "b" (the press focused the group)

### Requirement: Removal Hint

While tags are removable and the interaction modality is keyboard or virtual, each enabled
Tag SHALL reference, through `aria-describedby`, a hidden element with the `removeHint`
message ("Press Delete to remove"). The hint SHALL NOT be on the TagRemove, and SHALL NOT be
present while the modality is pointer or on touch devices.

#### Scenario: Hint on the focused row (regression: adobe/react-spectrum#4278)

- **WHEN** an NVDA user arrows onto a removable tag in focus mode
- **THEN** the tag's description is "Press Delete to remove", and the TagRemove buttons
  carry no such text

#### Scenario: No hint for mouse users

- **WHEN** the last interaction was a mouse press
- **THEN** no tag has an `aria-describedby` pointing at the hint

### Requirement: Remove Button

TagRemove SHALL be a `button-like-element` named by `removeLabel(text)` ("Remove <text>"),
with `tabIndex=-1`, never `aria-hidden`, disabled when its tag or the group is disabled. A
press on it SHALL NOT toggle the tag's selection or run the tag's action. Its pointer-down
SHALL move focus to its tag, not to the button.

#### Scenario: Screen reader activation

- **WHEN** a VoiceOver user moves the virtual cursor to "Remove Rome" and activates it
  (a bare click)
- **THEN** "Rome" is removed and focus moves to the next tag

#### Scenario: Remove does not select

- **WHEN** the TagRemove of an unselected tag in a selectable group is clicked
- **THEN** `onRemove` is called and the selection does not change

### Requirement: Removal Announcements

When keys from a removal request have left the collection, the group SHALL announce, politely
and on every platform, `removedAnnouncement(text)` for one tag or
`removedCountAnnouncement(count)` for several, once per request. The List SHALL carry no
`aria-live` attribute.

#### Scenario: Removal is spoken

- **WHEN** the focused tag "Rome" is removed and focus moves to "Paris"
- **THEN** the announcer records exactly one polite message "Rome removed"

#### Scenario: Several removed

- **WHEN** three selected tags are removed with one Delete
- **THEN** the announcer records exactly one message "3 tags removed"

### Requirement: Selection

Tags SHALL be selectable through the collections selection model when `selectionMode` is
`single` or `multiple` (default `none`), with the `toggle` behaviour and
`disallowEmptySelection`. The selection SHALL be a controllable value (`value`,
`defaultValue`, `onValueChange`; `string | null` in single mode, `string[]` in multiple
mode). Enter, Space and a press on a tag SHALL toggle it; arrow keys SHALL NOT change the
selection. Selectable Tags SHALL carry `aria-selected="true"` or `"false"` explicitly, and the
List `aria-multiselectable="true"` in multiple mode. Escape SHALL NOT clear the selection and
SHALL be left unhandled.

#### Scenario: Filter chips

- **WHEN** the user presses Space on "Open" and then on "Closed" in a multiple group
- **THEN** the value is `["open", "closed"]` and both rows have `aria-selected="true"`

#### Scenario: Escape inside a dialog

- **WHEN** a selectable group with a selection is inside a dialog and the user presses
  Escape on a tag
- **THEN** the dialog closes and the selection is unchanged

### Requirement: Actions And Links

A Tag with `href` SHALL render its TagText as a link (`<a href>`, `tabIndex=-1`); Enter or a
press on that tag SHALL follow the link through a click on the anchor, so router
interception and modifier keys keep working. With `onAction`, Enter, Space or a press on a
tag SHALL call `onAction(key)`. The precedence for Enter, Space and press SHALL be: link,
then action, then selection, then (keyboard only) removal. A link tag SHALL NOT be
selectable.

#### Scenario: Actionable tags (regression: adobe/react-spectrum#9205)

- **WHEN** a group with `selectionMode="none"` and `onAction` is focused on "Docs" and the
  user presses Enter
- **THEN** `onAction("docs")` is called once

#### Scenario: Tag opens a dialog (regression: adobe/react-spectrum#8151)

- **WHEN** a tag's `onAction` opens a dialog and the dialog closes
- **THEN** focus returns to that tag

#### Scenario: Link tag

- **WHEN** a tag with `href="/tags/react"` is focused and the user presses Enter
- **THEN** the anchor receives one click and navigation happens

### Requirement: Disabled

A disabled Tag SHALL stay focusable by default with `aria-disabled="true"`
(`focusableWhenDisabled`, default `true`), SHALL NOT be selected, acted on, followed or
removed, and its TagRemove SHALL be disabled. A disabled group SHALL have no Tab stop and
SHALL ignore every interaction.

#### Scenario: Disabled tags are discoverable (regression: adobe/react-spectrum#3074)

- **WHEN** a VoiceOver user arrows through "a, b (disabled), c"
- **THEN** all three tags receive focus and "b" is announced as dimmed

#### Scenario: Disabled group

- **WHEN** a disabled group is on the page and the user tabs through it
- **THEN** focus skips the whole group

### Requirement: Pointer And Hover

A press on an interactive tag SHALL focus it and run its link, action or selection toggle
as specified, on release, and SHALL NOT remove it. Hover SHALL set `data-hover` on any
interactive tag for mouse and pen only. Pointer handling SHALL locate the tag by its
registered key, never by walking ancestors for a focusable element.

#### Scenario: Hover on a link tag (regression: adobe/react-spectrum#9507)

- **WHEN** the mouse moves over a link tag in a group with `selectionMode="none"`
- **THEN** the tag carries `data-hover`

#### Scenario: Press on tag content (regression: ariakit/ariakit#6311)

- **WHEN** the user clicks an icon inside a tag's cell
- **THEN** that tag is focused and the page stays responsive

### Requirement: Nesting

A Tag Group rendered inside a collection item whose role cannot contain it (an `option`, a
`menuitem`) SHALL produce a development warning naming both, and SHALL NOT hang the page.

#### Scenario: Tag Group in an option (regression: adobe/react-spectrum#8740)

- **WHEN** a Tag Group is rendered inside a Listbox item in development
- **THEN** a warning names the Tag Group and the option, and the page renders

### Requirement: Messages

The group SHALL take every string that reaches assistive technology from its typed
`messages`: `removeLabel(text)` ("Remove {text}"), `removeHint` ("Press Delete to remove"),
`removedAnnouncement(text)` ("{text} removed") and `removedCountAnnouncement(count)`
("{count} tags removed", plural by locale).

#### Scenario: Localised remove label

- **WHEN** `messages={{ removeLabel: (t) => \`Rimuovi ${t}\` }}` is passed
- **THEN** the TagRemove of "Roma" is named "Rimuovi Roma"

### Requirement: Tag Group Data Attributes

Every part SHALL carry `data-scope="tag-group"` and its `data-part` (`root`, `label`,
`description`, `list`, `item`, `item-cell`, `item-text`, `item-remove`, `empty`). Tags SHALL
carry the collection item attributes (`data-key`, `data-highlighted`, `data-selected`,
`data-disabled`, `data-focus-visible`) plus `data-hover`, `data-pressed`, `data-removable`
when removable and `data-link` when they have `href`. Root and List SHALL carry `data-empty`
while empty and `data-disabled` while disabled; the List SHALL carry `data-selection-mode`
when selectable and `data-focus-visible` when it is itself focused after keyboard
navigation. `data-variant` and `data-size` set by the consumer SHALL be passed through
untouched.

#### Scenario: Styling a selected removable tag

- **WHEN** tag "it" is selected and removable
- **THEN** its element carries `data-part="item"`, `data-key="it"`, `data-selected` and
  `data-removable`

### Requirement: Tag Group Contract

The contract SHALL use scope `tag-group`, locate the instance by the roles `grid`, `group`
and `list` (`component-contract` "Location By Accessible Name", amended in this change) and
the List's exact accessible name, include the collection contract fragment with `itemRole: "row"` and the `roving`
strategy, and declare the actions `remove(name)` (pointer: press TagRemove; keyboard: focus
the tag and press Delete; virtual: bare click on TagRemove), `removeSelected()` (keyboard:
Delete on a selected tag), `act(name)` (pointer: press; keyboard: Enter) and the queries
`tags()`, `isEmpty()` and `isRemovable(name)`. Its traits SHALL be `composite-roving`,
`directional`, and `selectable` when `selectionMode` is not `none`, and it SHALL declare
`removalAnnouncement`. The postcondition of `remove(name)` SHALL be that the tag is gone and
focus is on its neighbour or on the List.

#### Scenario: Driver round trip

- **WHEN** a test runs `remove("Rome")` with the keyboard modality on "Rome, Paris"
- **THEN** it resolves when "Rome" is gone, `focusedItem()` is "Paris" and the
  announcements contain "Rome removed"

#### Scenario: Wrapper drops the hint

- **WHEN** a consumer wrapper strips `aria-describedby` from tags and `testMachine` runs in
  the keyboard modality
- **THEN** the step that focuses a removable tag fails naming the missing removal hint

### Requirement: Model-Based Coverage

`testMachine` SHALL run the Tag Group over the props classes display-only, removable,
selectable single, selectable multiple, selectable and removable, actions, links, disabled
tags, and empty, in every modality including `virtual`, and under `dir="rtl"`, with axe per
state.

#### Scenario: Removal across modalities

- **WHEN** the removable class runs in pointer, keyboard, touch and virtual modalities
- **THEN** each removal ends with focus inside the group and one announcement

### Requirement: Theme

`packages/theme/src/tag-group.css` SHALL follow the stylesheet convention of
`add-theme-system` (`@layer rind.components`, `:where()` selectors, `--rind-tag-group-*`
tokens read with a semantic fallback and never declared), place Tag in the `status` family
(`data-variant` solid, soft (default), outline; `data-size` sm, md (default), lg), style
`data-tone="danger"`, keep tags at least 24×24 CSS px with the remove button's hit area
expanded through `--rind-hit-area`, truncate long text with an ellipsis inside the
available width, never set `display: contents` on the List, draw the focus ring as an
outline, and show selection with a non-colour cue.

#### Scenario: Forced colors (regression: adobe/react-spectrum#4197)

- **WHEN** a focused, selected tag is shown under `forced-colors: active`
- **THEN** the focus ring is visible in the `Highlight` system colour and the selected state
  is visible without relying on background colour

#### Scenario: Long tag (regression: adobe/react-spectrum#6962)

- **WHEN** a tag's text is longer than the group's width
- **THEN** the tag fits the width and its text ends with an ellipsis
