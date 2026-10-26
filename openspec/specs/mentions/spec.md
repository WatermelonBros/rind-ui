# mentions Specification

## Purpose
TBD - created by archiving change add-mentions. Update Purpose after archive.
## Requirements
### Requirement: Mentions Anatomy

Mentions SHALL consist of `Root`, `Textarea`, `Popup` and `Item`, with optional `Description`,
`Highlighter`, `Mention`, `Positioner`, `List`, `Group`, `GroupLabel`, `ItemText`, `Empty` and
`Loading`. The Description SHALL name the triggers and describe the Textarea.

#### Scenario: Described

- **WHEN** Mentions with the trigger "@" renders
- **THEN** the textarea is described by "Type @ to insert a mention"

### Requirement: Mentions Value Model

The value SHALL be plain text and the mentions a list of ranges `{ id, trigger, start, end }`,
both controllable. After every input the ranges SHALL be reconciled from the text before and
after it: an edit before a range shifts it, an edit after it leaves it, an edit inside it
dissolves it into plain text, and a deletion that takes its first or last character (or all of
it) removes the whole mention and the space after it.

#### Scenario: Backspace removes a mention whole

- **WHEN** the text is "hi @Ada " with a mention "@Ada" and Backspace deletes its last character
- **THEN** the text is "hi " and there are no mentions

#### Scenario: Typing inside dissolves

- **WHEN** a character is typed inside "@Ada"
- **THEN** the text keeps it and the mention is gone

### Requirement: Mentions Trigger Detection

The list SHALL open when the caret follows a trigger char that starts the text or follows
whitespace (Unicode), with a query without whitespace (unless `allowSpaces`); `/` SHALL match only
at the start of a line by default; a trigger char inside a mention SHALL NOT match; it SHALL open
only from the field's own input. `onQueryChange` SHALL report the trigger and query, and null
when the list closes.

#### Scenario: No match inside a word

- **WHEN** "mail@ad" is typed
- **THEN** the list stays closed

### Requirement: Mentions List

The list SHALL follow the combobox pattern: the Textarea keeps focus and becomes a combobox with
`aria-activedescendant` while the list is open; the first option is highlighted as results
arrive (`autoHighlight`); ArrowDown and ArrowUp move; Enter and Tab (`selectOnTab`, default
true) insert the highlighted option; Escape closes it and it stays closed while typing on in the
same query; a press outside or blur closes it. The list SHALL be anchored at the trigger.

#### Scenario: Escape holds

- **WHEN** "@a" is typed, Escape is pressed, then "l" is typed
- **THEN** the list is closed

### Requirement: Mentions Insertion

Choosing an option of an `insert` trigger SHALL replace the trigger and query with the label
(the trigger char and the option's text unless `formatLabel`) and a space (`appendSpace`,
default true), add the mention range, and put the caret after the space. An `action` trigger
SHALL remove its query and call `onSelect`.

#### Scenario: Insert

- **WHEN** "hi @a" is typed and "Ada" is chosen
- **THEN** the text is "hi @Ada " with a mention at 3–7 and the caret at 8

### Requirement: Mentions IME

No key SHALL act and no list SHALL open while an IME composition is in progress; the
composition's end SHALL be handled as one input.

#### Scenario: Composing Enter

- **WHEN** Enter commits a composition while the list is open
- **THEN** no option is inserted

### Requirement: Mentions Data Attributes

Parts SHALL carry `data-scope="mentions"`, `data-part`, `data-instance`, `data-state`
(`open`, `closed`), `data-trigger` (the open list's), `data-disabled`, `data-readonly`; Root and
Textarea `data-composing`; Mention `data-trigger` and `data-id`. The Highlighter SHALL be
`aria-hidden`.

#### Scenario: Open trigger

- **WHEN** the "@" list is open
- **THEN** the Textarea has `data-trigger="@"`

### Requirement: Mentions Messages

The strings SHALL come from `messages` with English defaults: the combobox pattern's and the
description.

#### Scenario: Localised description

- **WHEN** `messages.description` returns "Scrivi @ per menzionare"
- **THEN** the Description reads "Scrivi @ per menzionare"

### Requirement: Mentions Contract

The contract SHALL locate by the textarea's name and provide `type`, `choose`, `pressEscape`,
`backspace` and the queries `isOpen`, `trigger`, `options`, `value`, `mentions`.

#### Scenario: Driver

- **WHEN** a test types "@a" and calls `choose("Ada")`
- **THEN** `mentions()` is ["@Ada"]

### Requirement: Mentions Theme

`@rind-ui/theme` SHALL style Mentions in the `field` family: the Highlighter exactly under the
textarea's text (same metrics) with mentions as tinted labels that do not change the text's
width, the list as the combobox's, and visible mentions under forced colors.

#### Scenario: Aligned

- **WHEN** a mention is inserted
- **THEN** its highlight sits exactly under its text

