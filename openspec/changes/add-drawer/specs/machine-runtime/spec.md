## MODIFIED Requirements

### Requirement: Change Details

Every `onXChange` callback SHALL receive details carrying the `reason`, the originating
event, and `cancel()`. The `reason` SHALL be the transition's declared `reason` when it
declares one — for the change the transition makes through its target state and for every
controllable value its actions write — and otherwise the type of the event that caused it.
Calling `cancel()` during the callback SHALL prevent the change in uncontrolled mode and
SHALL be equivalent to the parent refusing it in controlled mode.

#### Scenario: Reason is the event

- **WHEN** a dialog closes because of an `ESCAPE` event
- **THEN** `onOpenChange` receives `details.reason === "ESCAPE"`

#### Scenario: Declared reason

- **WHEN** a transition declaring `reason: "escape-key"` closes a dialog
- **THEN** `onOpenChange` receives `details.reason === "escape-key"`

#### Scenario: Declared reason for an action's write

- **WHEN** a drawer's handle press transition, declaring `reason: "handle"`, runs an action
  that writes the `snapPoint` value
- **THEN** `onSnapPointChange` receives `details.reason === "handle"`

#### Scenario: Cancelled change

- **WHEN** the consumer calls `details.cancel()` inside `onOpenChange`
- **THEN** the value and state do not change, and none of the transition's actions
  run
