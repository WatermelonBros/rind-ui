## Purpose

Defines, once, the chips shown inside a text-input control for the values it already holds
— the toolbar container, roving chips and their remove buttons, keyboard movement between
the input and the chips, Backspace arm-then-remove, removal focus, the summary description,
removal announcements, disabled chips, the connect helpers, events and contract fragment —
shared by Combobox (multiple selection) and Tags Input. Each host owns its values; this
capability only renders and edits them through the host's events.

## ADDED Requirements

### Requirement: Chips Container And Names

The chips SHALL be rendered inside the host's Control, before the input, in a Chips part
with `role="toolbar"` labelled by the `chipsLabel` message. Each Chip SHALL be a focusable
element, roving within the toolbar (collections `roving` over the chip keys, one Tab stop
at most), named by its text. Each Chip MAY contain a ChipRemove button with `tabindex=-1`
named by `removeLabel(text)`. The input's `aria-describedby` SHALL reference a visually
hidden summary node whose text is the `tagsSummary(texts)` message. Every part SHALL carry
the host's `data-scope` (the connect helpers' `scope` parameter, e.g. `combobox` or
`tags-input`) and `data-part` `chips`, `chip`, `chip-remove` or `chips-summary`.

#### Scenario: NVDA stays in focus mode (mui/base-ui#3629)

- **WHEN** an NVDA user arrows from the input onto the chips
- **THEN** the chips are inside an element with role `toolbar`, and NVDA stays in focus
  mode

#### Scenario: Host scope on every part

- **WHEN** the helpers are used with `scope: "tags-input"`
- **THEN** Chips, every Chip, every ChipRemove and the summary node carry
  `data-scope="tags-input"`, and the remove buttons are named "Remove Rome" and
  "Remove Paris" for the chips "Rome" and "Paris"

### Requirement: Keyboard Between Input And Chips

Backspace in the empty input with the caret at the start (`BACKSPACE_EMPTY`) SHALL arm the
last chip (highlight it) on the first press and remove it on the second, unless
`removeOnBackspace` is false. Any caret move or press in the input, and focus leaving the
component, SHALL disarm an armed chip. ArrowLeft at the caret start SHALL move focus to the
last chip; on a chip, ArrowLeft / ArrowRight SHALL move between chips (`CHIP.NAVIGATE`) and
ArrowRight past the last chip SHALL return focus to the input. Backspace or Delete on a chip
SHALL remove it (`CHIP.REMOVE`, by key) and move focus to the chip that followed it, else
the one before it, else the input. A printable key or a paste while a chip is focused
(`CHIP.TYPE`) SHALL move focus to the input and insert the text there.

#### Scenario: Backspace removes the last chip

- **WHEN** "Rome" and "Paris" are chips, the input is empty and the user presses Backspace
  twice
- **THEN** after the first press "Paris" is highlighted, after the second it is removed and
  focus is in the input

#### Scenario: Caret move disarms (chakra-ui/zag#2328)

- **WHEN** the last chip is armed, the user clicks at the end of the draft "ab" and presses
  Backspace
- **THEN** the draft is "a" and no chip is removed

#### Scenario: Remove the focused chip (chakra-ui/zag#1911)

- **WHEN** focus is on the middle chip of three and the user presses Delete, then ArrowLeft
- **THEN** that chip is removed, focus moved to the chip that followed it and then to the
  first chip

#### Scenario: Typing on a chip goes to the input

- **WHEN** focus is on a chip and the user types "m"
- **THEN** focus is in the input and its text ends with "m"

### Requirement: Disabled Chips

A chip SHALL accept a per-chip `disabled` flag (a host MAY set it on every chip, e.g. when
read-only). A disabled chip SHALL be skipped by chip navigation and by Backspace arming, its
ChipRemove SHALL be disabled, it SHALL never be removed by a user action, and it SHALL carry
`data-disabled`.

#### Scenario: Disabled chip is not removed (unovue/reka-ui#2785)

- **WHEN** the chips are "admin@acme.com" (disabled) and "user@x.io", and the user presses
  Backspace twice in the empty input
- **THEN** "user@x.io" is removed and "admin@acme.com" remains

### Requirement: Chips Count As Inside

Focus or a press on Chips, a Chip or a ChipRemove SHALL count as inside the host component:
it SHALL NOT blur the host, close its popup or clear its query.

#### Scenario: Chips count as inside (mui/base-ui#5547)

- **WHEN** the host's popup is open with the query "pa" and the user presses ArrowLeft at
  the caret start onto the last chip
- **THEN** the popup stays open and the query is kept

### Requirement: Removal Announcement

Removing a chip by any user action SHALL announce `removedAnnouncement(text)` politely
through the announcer, on every platform.

#### Scenario: Announced on every platform

- **WHEN** the chip "Rome" is removed with Delete on an emulated Windows platform and on an
  emulated Safari platform
- **THEN** both runs record the announcement "Rome removed"

### Requirement: Input Chips Messages

Every string this capability sends to assistive technology SHALL come from typed messages
owned here, with English defaults: `chipsLabel`, `removeLabel(text)` ("Remove {text}"),
`tagsSummary(texts)` and `removedAnnouncement(text)` ("{text} removed"). `removeLabel` and
`removedAnnouncement` SHALL use the same keys and defaults as Tag Group's messages, so a
consumer translating Tag Group, Tags Input and Combobox writes each string once. A host MAY
replace the default of `tagsSummary` (Tags Input: "3 tags: Rome, Paris, Oslo" / "No tags";
Combobox: the selected options' text) and SHALL expose these keys in its own `messages`.

#### Scenario: One translation for all components

- **WHEN** an app passes `removeLabel: (t) => \`Rimuovi ${t}\`` to a Tag Group, a Tags Input
  and a multiple Combobox
- **THEN** the remove buttons of all three are named "Rimuovi Roma" for the value "Roma"

### Requirement: Input Chips Helpers, Events And Contract Fragment

The capability SHALL be delivered as connect helpers (`inputChipsConnect({ scope, … })` for
Chips, Chip, ChipRemove and the summary node), actions and guards that a host machine
spreads, the events `CHIP.NAVIGATE`, `CHIP.REMOVE`, `CHIP.TYPE` and `BACKSPACE_EMPTY`, and
context keys for the focused and armed chip — not a separate machine. Chip SHALL carry
`data-highlighted` when focused or armed and `data-focus-visible` after keyboard focus. The
contract fragment SHALL add the action `removeChip(name)` (pointer: ChipRemove press;
keyboard: focus the chip, Backspace), the query `chips()` (chip names in order) and the trait
`composite-roving` over the chips.

#### Scenario: Shared helpers in two hosts

- **WHEN** a multiple Combobox and a Tags Input each render the chips "Rome" and "Paris" and
  a driver test runs `removeChip("Rome")` on both with the keyboard modality
- **THEN** both resolve with `chips()` equal to `["Paris"]`, and only the `data-scope` of
  their chip parts differs
