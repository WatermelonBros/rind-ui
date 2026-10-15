# a11y-invariants Specification

## Purpose
Adds to model-based testing the generic accessibility invariants that need this
change's infrastructure — focus-visible after pointer and keyboard, announcement
parity, focus that does not commit, IME safety, hover never from touch — and makes the
oracle aware of each step's modality. These extend the generic invariants of
`model-based-testing` (defined in `add-foundations`) and, like them, cannot be turned
off by consumers.
## Requirements
### Requirement: Modality-Aware Oracle

The runner SHALL give the headless oracle each step's modality on the events it sends,
so guards that read `modality` evaluate as they do in the component. A step run in the
`virtual` modality SHALL reach the state the oracle computes for a `virtual` event,
which may differ from the `pointer` path where a guard distinguishes them.

#### Scenario: Virtual open focuses the first item

- **WHEN** a menu's `OPEN` transition focuses the first item only for keyboard or
  virtual modalities and the path runs it via `virtual`
- **THEN** the oracle expects the first item focused and the runner asserts it

### Requirement: Focus-Visible Follows Modality

After every step the runner SHALL check (accessibility.md rule 12): after a step run
with the `pointer` or `touch` modality no part carries `data-focus-visible`; after a
step run with the `keyboard` modality that leaves focus or a highlight inside the
component, the focused or highlighted part carries `data-focus-visible`.

#### Scenario: Ring after click

- **WHEN** a pointer step leaves a part focused with `data-focus-visible`
- **THEN** the step fails naming the part

#### Scenario: No ring after arrow

- **WHEN** a keyboard step moves the highlight and the highlighted part lacks
  `data-focus-visible`
- **THEN** the step fails naming the part

### Requirement: Announcement Parity

For contracts with the `composite-activedescendant` trait, the runner SHALL run with an
Apple platform with the WebKit engine, an Apple platform with the Blink engine, and a
non-Apple platform, and SHALL check after each step (AT note invariant 8): on every
platform, opening or changing the result set produced the contract's
`countAnnouncement`; where the `vo-activedescendant` quirk applies (Apple and WebKit),
each highlight change produced exactly one announcement equal to the contract's
`focusAnnouncement` for the new highlight; where it does not apply (Apple with Blink,
and non-Apple platforms), the step produced no announcement equal to that
`focusAnnouncement`.

#### Scenario: Missing highlight announcement (RA#10326)

- **WHEN** on Apple with WebKit a step moves the highlight and no announcement is made
- **THEN** the step fails with the expected `focusAnnouncement`

#### Scenario: Double speech in Chrome on macOS (RA PR #10503)

- **WHEN** on Apple with Blink a step moves the highlight and the item's
  `focusAnnouncement` is made
- **THEN** the step fails naming the message

#### Scenario: Double speech on Windows

- **WHEN** on Windows a step moves the highlight and the item's `focusAnnouncement` is
  made
- **THEN** the step fails naming the message

#### Scenario: Missing count on Windows

- **WHEN** on Windows a step changes the result set and no `countAnnouncement` is made
- **THEN** the step fails with the expected `countAnnouncement`

### Requirement: Virtual Activation Parity

Every press-type transition reachable with a pointer SHALL also be run as a bare
`click` (AT note invariant 12), through the `virtual` modality that `add-foundations`
adds to every pointer action, and SHALL reach the oracle's state for that modality with
exactly one activation (no transition taken twice).

#### Scenario: Double activation

- **WHEN** a toggle part flips its state twice for one bare `click`
- **THEN** the virtual step fails because the oracle expected one toggle

### Requirement: Focus Alone Does Not Commit

For every focusable part reachable in a state, the runner SHALL add a step that focuses
it programmatically with no preceding key or pointer event and SHALL check (AT note
invariant 13) that the oracle state and the observed state change in nothing but focus
and highlight, unless the contract lists that part and state as committing on focus.

#### Scenario: Screen reader cursor selects a tab (RX#1047)

- **WHEN** a virtual focus step lands on an unselected tab and the tab becomes selected
- **THEN** the step fails because tabs are not listed as committing on focus

#### Scenario: Tooltip opens on focus (RX#2248)

- **WHEN** a virtual focus step lands on a tooltip trigger whose contract lists opening
  on focus
- **THEN** the tooltip may open and the step passes

### Requirement: IME Never Commits

For every keyboard action whose key is Enter, Escape, Space, an arrow, a delimiter or a
printable character, sent to a part with a text-entry role (`textbox`, `combobox`,
`searchbox`, `spinbutton`), the runner SHALL replay the key's `keydown` and `keyup` as composing
(`isComposing: true`, `keyCode: 229`, no text input) and SHALL check (AT note invariant 18,
accessibility.md rule 18) that it causes no submission, selection, split, dismissal,
navigation or typeahead: the oracle and observed state are unchanged.

#### Scenario: Composing Enter submits

- **WHEN** a composing Enter in a prompt input sends its submit event
- **THEN** the step fails naming the key and the transition taken

### Requirement: Hover Never From Touch

For every contract action that hovers, the runner SHALL replay the hover with
`pointerType: "touch"` and SHALL check (AT note invariant 20, accessibility.md rule
20) that no part gains `data-hover` and no hover-triggered transition is taken.

#### Scenario: Tooltip opens on tap

- **WHEN** a touch hover step opens a tooltip
- **THEN** the step fails naming the hover action

