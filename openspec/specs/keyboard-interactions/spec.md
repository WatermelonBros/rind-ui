# keyboard-interactions Specification

## Purpose
Defines how native key events become logical machine events — with right-to-left
mirroring, the platform modifier and IME composition decided once, outside machines —
and the shared timing default for typeahead.
## Requirements
### Requirement: Logical Keys

rind-ui SHALL map native key events to logical machine events (`NEXT`, `PREV`,
`FIRST`, `LAST`, `PAGE_NEXT`, `PAGE_PREV`, `EXPAND`, `COLLAPSE`, `INCREASE`,
`DECREASE`, `ACTIVATE`, `DISMISS`, `CONTEXT_MENU`) from the event, the direction, the
orientation and the platform, in one function that runs without a DOM. Machines SHALL
be written against logical events. Each logical event SHALL carry `modality:
"keyboard"`, the modifier state and the `composing` flag.

#### Scenario: Vertical list

- **WHEN** ArrowDown is pressed in a vertical composite
- **THEN** the machine receives `NEXT`

#### Scenario: Context menu keys

- **WHEN** Shift+F10 or the ContextMenu key is pressed on a part
- **THEN** the machine receives `CONTEXT_MENU`

#### Scenario: No DOM needed

- **WHEN** the mapping is called in Node with a plain key description and `dir: "rtl"`
- **THEN** it returns the logical event without touching DOM globals

### Requirement: Right-To-Left Mirroring

Only horizontal arrow keys SHALL be mirrored, and only when the direction is `rtl`:
in a horizontal composite ArrowLeft SHALL map to `NEXT` and ArrowRight to `PREV`;
`EXPAND` and `COLLAPSE` SHALL swap sides; for value controls Left SHALL increase in
RTL and Right in LTR. Vertical arrows, Home, End, PageUp and PageDown SHALL never be
mirrored, and ArrowUp SHALL always increase.

#### Scenario: Tabs in Arabic

- **WHEN** ArrowLeft is pressed in a horizontal tab list with `dir="rtl"`
- **THEN** the machine receives `NEXT`

#### Scenario: Home is not mirrored

- **WHEN** Home is pressed with `dir="rtl"`
- **THEN** the machine receives `FIRST`

#### Scenario: Slider in RTL

- **WHEN** ArrowLeft is pressed on a horizontal slider with `dir="rtl"`
- **THEN** the machine receives `INCREASE`

### Requirement: Platform Modifier

The `mod` modifier SHALL be Meta (⌘) on Apple platforms and Control elsewhere, decided
by the injected platform. Control+click on macOS SHALL be treated as a context-menu
request, not a press.

#### Scenario: Select all on macOS and Windows

- **WHEN** ⌘+A is pressed on an Apple platform, and Control+A on Windows
- **THEN** both produce a key event with `mod: true`

#### Scenario: Control-click on macOS

- **WHEN** the user Control-clicks a part on macOS
- **THEN** the machine receives `CONTEXT_MENU` and no `PRESS`

### Requirement: IME Composition Guard

A key event SHALL be marked `composing` when `isComposing` is true or `keyCode` is
229, and the Enter that commits a composition SHALL be marked `composing` even when the
browser delivers it after `compositionend` (Safari, quirk entry). rind-ui SHALL export
a named guard implementation that fails for composing events, for machines to apply to
every transition that submits, selects, splits, dismisses, navigates or typeaheads on a
key.

#### Scenario: Japanese IME Enter in a prompt input

- **WHEN** a user composing Japanese text presses Enter to commit the composition
- **THEN** the key event is marked `composing` and a prompt input guarded with the IME
  guard does not submit

#### Scenario: Safari commit Enter after compositionend

- **WHEN** Safari fires `compositionend` and then a `keydown` for the committing Enter
  with `isComposing: false`
- **THEN** that Enter is still marked `composing`

### Requirement: Hotkey Matching

Hotkeys SHALL match on `key` for printable characters and fall back to `code` when
Alt (Option) changed the produced character. Single-character shortcuts SHALL be
active only while the component has focus unless the consumer registers them globally.

#### Scenario: Option changes the character on macOS

- **WHEN** a hotkey Control+Alt+T is registered and macOS reports `key === "†"` with
  `code === "KeyT"`
- **THEN** the hotkey matches

### Requirement: Typeahead Timing

Typeahead in every rind-ui component SHALL reset its search buffer after 1000 ms
without a printable key by default. The timeout SHALL be configurable per component
and once for a whole tree through the provider. Typeahead SHALL ignore events marked
`composing` or combined with Control, Meta or Alt.

#### Scenario: Slow typist

- **WHEN** a user types "b", waits 800 ms, then types "a" in a list
- **THEN** the search string is "ba"

#### Scenario: Provider setting

- **WHEN** the provider sets the typeahead timeout to 1500 ms
- **THEN** every typeahead in the tree resets after 1500 ms

