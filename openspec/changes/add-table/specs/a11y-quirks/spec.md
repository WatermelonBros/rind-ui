## ADDED Requirements

### Requirement: TalkBack Sort State Entry

The registry SHALL contain `talkback-aria-sort`, active on Android (`p.android`), for
TalkBack not exposing `aria-sort` on column headers. It SHALL link React Aria's
`useTableColumnHeader`
(https://github.com/adobe/react-spectrum/blob/main/packages/react-aria/src/table/useTableColumnHeader.ts,
"aria-sort not supported in Android Talkback"). Its removal condition SHALL be "a device test
shows TalkBack reading the sort direction of a column header with `aria-sort`". Its
reproducing test SHALL show the condition over the platform presets and SHALL point to the
device check in the manual protocol. The Table's sort-state description (add-table) SHALL be
gated by this entry.

#### Scenario: Android

- **WHEN** `quirkActive("talkback-aria-sort")` is evaluated for an Android platform
- **THEN** it is true

#### Scenario: Other platforms

- **WHEN** it is evaluated for a macOS, an iOS and a Windows platform
- **THEN** it is false in each
