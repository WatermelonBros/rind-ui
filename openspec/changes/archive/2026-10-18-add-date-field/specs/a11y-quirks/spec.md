## MODIFIED Requirements

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
value attributes (add-number-input) SHALL be gated by this entry. The entry SHALL also cover
date and time segments, which are the same element (an `<input role="spinbutton">`): the Date
Field code that renders segments without the `spinbutton` role and value attributes
(add-date-field) SHALL be gated by this entry, and the entry's reproducing test SHALL gain a
date-segment case.

#### Scenario: iPhone

- **WHEN** `quirkActive("ios-vo-spinbutton-input")` is evaluated for an iOS platform
- **THEN** it is true

#### Scenario: macOS and Android

- **WHEN** it is evaluated for a macOS platform and for an Android platform
- **THEN** it is false in both

#### Scenario: Date segment on iPhone

- **WHEN** a Date Field renders its segments for an iOS platform
- **THEN** the entry is active and no segment carries `role="spinbutton"`, `aria-valuenow`,
  `aria-valuemin` or `aria-valuemax`

#### Scenario: Date segment on macOS

- **WHEN** a Date Field renders its segments for a macOS platform
- **THEN** the entry is inactive and each editable segment has `role="spinbutton"`
