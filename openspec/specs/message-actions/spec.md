# message-actions Specification

## Purpose
TBD - created by archiving change add-message-actions. Update Purpose after archive.
## Requirements
### Requirement: Message Actions Anatomy

Message Actions SHALL consist of a `Root` and any of `Item`, `Copy`, `Regenerate`, `Edit`,
`Feedback` with `FeedbackItem`s, and `Versions` with `VersionPrevious`, `VersionNext` and
`VersionStatus`. The Root SHALL be a toolbar named `messages.label` with one Tab stop. Every
button SHALL have an accessible name.

#### Scenario: One Tab stop

- **WHEN** a Root with Copy, Regenerate and Feedback is rendered and Tab moves into it
- **THEN** one item takes the focus and the arrow keys move between the items

### Requirement: Message Actions Visibility

The Root SHALL be `active` while the pointer is over the message, the focus is within it, a
touch landed in it, or the `active` prop is true; otherwise `inactive`. The Root SHALL stay
mounted and keep its items in the accessibility tree in both states (`data-active` marks the
state for styling).

#### Scenario: Hiding does not drop the focus (regression: assistant-ui autohide)

- **WHEN** an item has the focus and the pointer leaves the message
- **THEN** the Root is still `active` (focus within) and the item keeps the focus

### Requirement: Message Actions Regenerate

A press of Regenerate in `idle`, `done` or `error` SHALL call `onRegenerate()` and enter
`pending` until its returned promise settles (`done` or `error`), immediately for a non-promise
return. While `pending` the item SHALL be `aria-disabled` and `aria-busy` and a press SHALL be
ignored. `done` and `error` SHALL return to `idle` after 2000 ms.

#### Scenario: No double regenerate

- **WHEN** Regenerate is pressed twice before `onRegenerate`'s promise settles
- **THEN** `onRegenerate` was called once

### Requirement: Message Actions Edit

Edit SHALL be a toggle (`aria-pressed`) of the controllable `editing`. When `editing` becomes
false and the focus is on the document body, the focus SHALL move to Edit.

#### Scenario: Focus after editing (regression: assistant-ui#8208)

- **WHEN** the editor that had the focus unmounts as `editing` becomes false
- **THEN** the Edit item has the focus

### Requirement: Message Actions Copy And Feedback

Copy SHALL behave as a Clipboard trigger over `value` (read at press time) with Clipboard's
states and announcements. Feedback SHALL be a single, deselectable Toggle Group of
`FeedbackItem`s (`up`, `down`) with a controllable value (`"up" | "down" | null`).

#### Scenario: Thumbs toggle off

- **WHEN** "Good response" is pressed twice
- **THEN** the feedback value is `"up"` then `null`

### Requirement: Message Actions Versions

Versions SHALL render only when `count` ≥ 2, as a named group. Previous and Next SHALL move
the controllable index by one, without wrapping unless `loop`; at an end the button SHALL be
`aria-disabled` and focusable. Each move SHALL call `onIndexChange(index)` and
announce `messages.version(index + 1, count)` politely. VersionStatus SHALL show "index / count"
and be `aria-hidden`.

#### Scenario: Announced, no wrap (regression: AI Elements wraps silently)

- **WHEN** Next is pressed on version 3 of 3 without `loop`
- **THEN** the index stays 2, nothing is announced, and Next is `aria-disabled`

### Requirement: Message Actions Data Attributes

The Root SHALL carry `data-scope="message-actions"`, `data-part`, `data-instance`,
`data-active` when active and `data-editing` while editing; Regenerate SHALL carry
`data-state`; Versions SHALL carry `data-count` and `data-index`; disabled version buttons
`data-disabled`.

#### Scenario: Pending

- **WHEN** Regenerate is pending
- **THEN** it has `data-state="pending"`

### Requirement: Message Actions Messages

The strings SHALL come from `messages`: `label`, `copy`, `regenerate`, `edit`, `feedback`,
`up`, `down`, `versions`, `previous`, `next`, `version(index, count)`, with English defaults.

#### Scenario: Localised version

- **WHEN** `messages.version` returns "Versione 2 di 3"
- **THEN** "Versione 2 di 3" is announced on that move

### Requirement: Message Actions Contract

The contract SHALL locate by the toolbar's name, else the only one, and provide the actions
`copy`, `regenerate`, `edit`, `rate`, `previousVersion`, `nextVersion` and the queries
`isActive`, `regenerateState`, `rating`, `version`, `isEditing`.

#### Scenario: Driver

- **WHEN** a test calls `nextVersion()` on version 1 of 3
- **THEN** `version()` returns `{ index: 1, count: 3 }`

### Requirement: Message Actions Theme

`@rind-ui/theme` SHALL style the items as ghost icon keys of at least 24 × 24 px, fade an
inactive row without removing it, and show it at full opacity when active or focused within.

#### Scenario: Inactive row stays

- **WHEN** the row is inactive
- **THEN** its items are still rendered and have a size

