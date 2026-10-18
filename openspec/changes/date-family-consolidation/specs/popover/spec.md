## MODIFIED Requirements

### Requirement: Close Reasons

Every close SHALL carry exactly one reason from: `trigger`, `close-trigger`,
`escape-key`, `outside-press`, `outside-focus`, `parent-dismissed`, `select`, `api`. The
reason SHALL be passed to `onOpenChange` and exposed on the content as
`data-close-reason` until the next open. `select` SHALL be sent by a component composed
on the Popover whose content committed a choice (the Date Field picker's pick).

#### Scenario: Close trigger

- **WHEN** the user presses the `CloseTrigger`
- **THEN** `onOpenChange(false, details)` receives `details.reason ===
  "close-trigger"` and the exiting content carries `data-close-reason="close-trigger"`

#### Scenario: Parent closes

- **WHEN** a popover inside a dialog is open and the dialog closes
  programmatically
- **THEN** the popover closes first with reason `"parent-dismissed"`

#### Scenario: A composed content commits

- **WHEN** a Date Field picker's calendar picks a date with `closeOnSelect`
- **THEN** the popover closes with reason `"select"` and the content carries
  `data-close-reason="select"`
