# suggestions Specification

## Purpose
TBD - created by archiving change add-suggestions. Update Purpose after archive.
## Requirements
### Requirement: Suggestions Anatomy

Suggestions SHALL consist of a `Root` with `role="group"` and one or more `Item`s, each a native
`<button type="button">`, with optional `Label` and `Description` inside an Item. The Root SHALL
have an accessible name (its own, or `messages.group`). An Item's name SHALL be its text.

#### Scenario: Named group of buttons

- **WHEN** Suggestions with three Items is rendered without a name
- **THEN** a group named "Suggestions" contains three buttons named by their text

### Requirement: Suggestions Press

A press on an enabled Item in `ready` SHALL call `onSelect({ value, index, key })`, `value`
being the Item's `value` or its Label text; the component SHALL NOT send, insert or remove
anything itself. When the press came with the focus inside the Root and `focusTarget` is
given, the focus SHALL move to `focusTarget()` after the callback.

#### Scenario: Value

- **WHEN** the Item labelled "Summarise" with `value="Summarise this thread"` is pressed
- **THEN** `onSelect` receives `{ value: "Summarise this thread", index: 0, key }`

### Requirement: Suggestions States

The component SHALL be in `loading` while `loading` is true, `disabled` while `disabled` is
true, otherwise `ready`. In `loading` and `disabled` every Item SHALL be `aria-disabled="true"`,
focusable and rendered, and a press SHALL do nothing; the Root SHALL be `aria-busy="true"`
while loading.

#### Scenario: Focus kept while the prompt streams (regression: assistant-ui#8940)

- **WHEN** the focused Item's Suggestions switches to `loading`
- **THEN** the Item is still focused and `aria-disabled="true"`

### Requirement: Suggestions Announcement

With `announce="polite"`, a change of the rendered Items' keys after the first render SHALL
announce `messages.count(n)` politely; nothing SHALL be announced on mount or when `announce`
is `"off"` (the default).

#### Scenario: New set

- **WHEN** `announce="polite"` and the Items change from three to two different ones
- **THEN** "2 suggestions" is announced once

### Requirement: Suggestions Data Attributes

The Root SHALL carry `data-scope="suggestions"`, `data-part`, `data-instance`, `data-state`
and `data-count`; each Item SHALL carry `data-key`, `data-index`, `data-disabled` when disabled,
and the focus attributes.

#### Scenario: Count

- **WHEN** three Items are rendered
- **THEN** the Root has `data-count="3"`

### Requirement: Suggestions Contract

The contract SHALL locate by the group's name, else the only Suggestions, provide `pick` and
the queries `items`, `count`, `isLoading`, `isDisabled`.

#### Scenario: Pick by label

- **WHEN** a test calls `getSuggestions(root).pick("Summarise")`
- **THEN** `onSelect` was called with that Item's value

### Requirement: Suggestions Theme

`@rind-ui/theme` SHALL render the Items as wrapping chips in the `toggle item` family, at least
24 px tall, with a visible disabled style.

#### Scenario: Wrapping

- **WHEN** the Items do not fit on one line
- **THEN** they wrap onto the next

