# a11y-quirks Specification

## Purpose
Defines the single registry of browser- and assistive-technology-specific workarounds
in rind-ui, so every UA-gated behaviour has a condition, a bug link, a reproducing
test and a removal condition, can be re-tested yearly, and is the only way a contract
can declare an exception to a generic invariant.
## Requirements
### Requirement: Every UA-Gated Workaround Is An Entry

Every behaviour in rind-ui that differs by browser, platform or assistive technology
SHALL be gated by an entry in one registry module in `@rind-ui/core`. Each entry SHALL
have: a stable id; a condition evaluated against the injected platform; at least one
external bug or issue link; the path of the test that reproduces the problem; a
removal condition; the date it was last verified; and the generic invariants it
affects, if any. Code SHALL check an entry by id, never test the user agent or
platform directly for a workaround.

#### Scenario: Entry without a bug link

- **WHEN** an entry is declared with no link
- **THEN** the code does not compile

#### Scenario: Workaround outside the registry

- **WHEN** a module under `packages/core` or `packages/react` reads the user agent or a
  platform flag to change behaviour without going through a registry entry
- **THEN** lint fails

#### Scenario: Gated by the injected platform

- **WHEN** a test creates environments for Apple with the WebKit engine, Apple with the
  Blink engine, and Windows
- **THEN** the `vo-activedescendant` entry is active only in the first, and the
  `vo-section-entry` entry is active in the first two only

### Requirement: VoiceOver Active-Descendant Entries

The registry SHALL contain `vo-activedescendant`, active on Apple platforms with the
WebKit engine only, linking RA#10326 (VoiceOver in Safari silent on
`aria-activedescendant` changes) and RA PR #10503 (VoiceOver in Chrome speaks them
natively, so a live announcement interrupts it), and listing `announcement-parity`. It
SHALL contain `vo-section-entry`, active on every Apple platform, linking RA PR #10503
(which keeps the section-entry announcement because VoiceOver is silent on section
changes in every browser), for the section-entry and commit-selection announcements.
Each SHALL have its reproducing test.

#### Scenario: Safari on macOS

- **WHEN** `quirkActive("vo-activedescendant")` and `quirkActive("vo-section-entry")`
  are evaluated for an Apple platform with the WebKit engine
- **THEN** both are true

#### Scenario: Chrome on macOS

- **WHEN** both are evaluated for an Apple platform with the Blink engine
- **THEN** `vo-activedescendant` is false and `vo-section-entry` is true

### Requirement: React Action Form Reset Entry

The registry SHALL contain `react-action-form-reset`, which is not gated by platform
(active wherever the React adapter runs), linking react-spectrum#6830 and
react-spectrum#7708, with the removal condition "React exposes the reason for a form
reset". Its reproducing test SHALL show that React 19, after a form action completes,
calls `form.reset()` with no user event in progress (the call React Aria detects in
`useFormValidation.ts`: no current event, or inside a `message` event from React's
scheduler `MessagePort`). The React adapter code that tells such a framework reset
from a user reset (add-form) SHALL be gated by this entry.

#### Scenario: Reset after an action

- **WHEN** the entry's test submits a React 19 form whose `action` resolves, and
  records each `form.reset()` call with the event in progress
- **THEN** one reset is recorded with no user event in progress

#### Scenario: Reset from a user click

- **WHEN** the same test clicks a button whose handler calls `form.reset()`
- **THEN** the recorded reset happens during the user's `click`

### Requirement: iOS VoiceOver Spinbutton Input Entry

The registry SHALL contain `ios-vo-spinbutton-input`, active on iOS and iPadOS (`p.ios`),
for VoiceOver on iOS being unable to focus and edit an `<input>` with
`role="spinbutton"`. It SHALL link React Aria's `useNumberField.ts` comment
(https://github.com/adobe/react-spectrum/blob/main/packages/react-aria/src/numberfield/useNumberField.ts),
which drops the role for this reason, and its removal condition SHALL be "a device test
shows iOS VoiceOver focusing and editing an `<input role="spinbutton">`". Its reproducing
test SHALL show the condition over the platform presets and SHALL point to the device
check in the manual protocol, since the failure is only observable with VoiceOver on a
device. The Number Input code that renders the input without the `spinbutton` role and its
value attributes (add-number-input) SHALL be gated by this entry.

#### Scenario: iPhone

- **WHEN** `quirkActive("ios-vo-spinbutton-input")` is evaluated for an iOS platform
- **THEN** it is true

#### Scenario: macOS and Android

- **WHEN** it is evaluated for a macOS platform and for an Android platform
- **THEN** it is false in both

### Requirement: Keypad Decimal Separator Entry

The registry SHALL contain `keypad-decimal-separator`, active on touch platforms (iOS,
iPadOS and Android: `p.ios || p.android`), for touch numeric keypads inserting a decimal
separator chosen by the device, not the field's locale (a "." whatever the field's
locale, or the device region's separator). It SHALL link react-spectrum#5731 and
ark#3500, and its removal condition SHALL be "touch decimal keypads follow the field's
`lang` or `inputmode` locale". While it is active, an inserted "." or device-locale decimal
separator that differs from the field locale's decimal separator SHALL be mapped to the
field locale's decimal separator; the mapping belongs to the Number Input change and SHALL
be gated by this entry. Its reproducing test SHALL show the condition over the platform
presets and the mapping of a keypad insertion recorded from a device.

#### Scenario: Touch platforms

- **WHEN** `quirkActive("keypad-decimal-separator")` is evaluated for iOS, Android and
  Windows platforms
- **THEN** it is true for iOS and Android and false for Windows

#### Scenario: Keypad "." in an Italian field

- **WHEN** on Android the keypad inserts "." into a field whose locale is `it-IT`
- **THEN** the field receives "," as the decimal separator

### Requirement: Contracts Declare Invariant Exceptions Through Quirks

A contract SHALL be able to exempt a part from a named generic invariant only by
referencing a registry entry that lists that invariant. Referencing an unknown entry,
or an entry that does not list the invariant, SHALL be a compile error. The model-based
runner SHALL skip only that invariant, for that part, while the entry's condition holds,
and SHALL list every applied exception in its report.

#### Scenario: Submenu trigger on Apple (BU MenuSubmenuTrigger)

- **WHEN** a menu contract references the `vo-submenu-expanded` entry to exempt the
  submenu trigger from "aria-expanded mirrors state", and the run uses an Apple
  platform
- **THEN** that check is skipped for the submenu trigger only, every other part is
  still checked, and the report names the entry

#### Scenario: Same run on Windows

- **WHEN** the same contract runs with a Windows platform
- **THEN** the invariant is checked for the submenu trigger as well

### Requirement: Yearly Re-Test

Every entry's reproducing test SHALL exist and run. A check SHALL report every entry
whose last-verified date is more than twelve months old, and the docs SHALL list the
entries that affect each component as its known assistive-technology quirks.

#### Scenario: Stale entry

- **WHEN** an entry was last verified thirteen months ago
- **THEN** the stale-quirks check reports it with its id, links and removal condition

#### Scenario: Missing test

- **WHEN** an entry's test path does not exist
- **THEN** the registry check fails

