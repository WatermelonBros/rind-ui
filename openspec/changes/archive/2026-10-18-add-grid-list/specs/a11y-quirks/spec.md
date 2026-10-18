## ADDED Requirements

### Requirement: WebKit Grid Selection Entry

The registry SHALL contain `webkit-grid-selection-not-announced`, active on Apple platforms
with the WebKit engine only, for VoiceOver in Safari not announcing the selected state of a
grid row when it changes. It SHALL link WebKit bug 235068 (selected row state not
announced) and React Aria's `useGridSelectionAnnouncement`
(https://github.com/adobe/react-spectrum/blob/main/packages/react-aria/src/grid/useGridSelectionAnnouncement.ts),
and list `announcement-parity`. Its removal condition SHALL be "VoiceOver speaks
`aria-selected` changes on grid rows". Its reproducing test SHALL show the condition over
the platform presets and SHALL point to the device check in the manual protocol, since the
failure is only observable with VoiceOver. The Grid List selection announcements
(add-grid-list) SHALL be gated by this entry.

#### Scenario: Safari on macOS

- **WHEN** `quirkActive("webkit-grid-selection-not-announced")` is evaluated for an Apple
  platform with the WebKit engine
- **THEN** it is true

#### Scenario: Chrome on macOS and Windows

- **WHEN** it is evaluated for an Apple platform with the Blink engine and for a Windows
  platform
- **THEN** it is false in both
