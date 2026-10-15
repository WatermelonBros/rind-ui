## ADDED Requirements

### Requirement: NVDA Calendar Focus Mode Entry

The registry SHALL reserve `nvda-calendar-focus-mode`, active on Windows (`p.windows`), for
NVDA not entering focus mode on a `gridcell` that holds focus, so the arrow keys move the
screen-reader cursor instead of the calendar's focus. It SHALL link react-spectrum#4637,
reka-ui#2228 and reka-ui#2438. While it is active the Calendar root SHALL carry
`role="application"`; the code that adds it SHALL be gated by this entry. Its removal
condition SHALL be "a device test shows NVDA with Chrome and Firefox following the focused
`gridcell` without `role="application"`". Its reproducing test SHALL show the condition
over the platform presets and SHALL point to the device check in the manual protocol, since
the failure is only observable with NVDA. The entry SHALL be enabled only if the Calendar's
device check fails; until then it stays reserved and inactive.

#### Scenario: Windows

- **WHEN** `quirkActive("nvda-calendar-focus-mode")` is evaluated for a Windows platform
  while the entry is enabled
- **THEN** it is true and the Calendar root renders with `role="application"`

#### Scenario: macOS and iOS

- **WHEN** it is evaluated for a macOS platform and for an iOS platform
- **THEN** it is false in both and the Calendar root has no `role`

#### Scenario: Reserved, not enabled

- **WHEN** the device check passes and the entry stays reserved
- **THEN** it is false on every platform and no Calendar part carries `role="application"`
