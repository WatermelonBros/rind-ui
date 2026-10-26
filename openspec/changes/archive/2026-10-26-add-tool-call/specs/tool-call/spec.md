## ADDED Requirements

### Requirement: Tool Call Anatomy

A Tool Call SHALL consist of a `Root` and a `Header` (a native `<button type="button">`), with
optional `Name`, `Status`, `Duration`, `Content`, `Input`, `Output`, `Error` and an `Approval`
group (`role="group"`) with `ApprovalTitle`, `ApprovalDescription`, `Approve`, `Deny` and
`Receipt` (`role="status"`). The Approval's buttons SHALL be rendered only when `onDecision`
is given.

#### Scenario: No handler, no buttons (regression: assistant-ui#6094)

- **WHEN** a Tool Call in `awaiting` has no `onDecision`
- **THEN** no Approve or Deny button is rendered

### Requirement: Tool Call Status

`status` SHALL be a prop (`pending`, `running`, `awaiting`, `done`, `error`, `denied`,
`cancelled`); every part SHALL carry it as `data-state`. The Header's accessible name SHALL be
the tool's name followed by the status in words (`messages.status`).

#### Scenario: Status in the name (regression: assistant-ui#7957)

- **WHEN** a `search_flights` call is `running`
- **THEN** the Header is named "search_flights, running"

### Requirement: Tool Call Disclosure

The Header SHALL toggle the controllable `open` (`aria-expanded`, `aria-controls` = Content).
Entering `awaiting` SHALL open it; nothing SHALL close it automatically.

#### Scenario: Opens for approval

- **WHEN** a closed call's status becomes `awaiting`
- **THEN** it is open, and becoming `done` leaves it open

### Requirement: Tool Call Approval

The approval attempt SHALL follow: status `awaiting` → `awaiting`; Approve or Deny in
`awaiting` or `failed` → `submitting` and `onDecision({ id, approved, reason })`; its promise
resolved (or a non-promise return) → `settled`; rejected → `failed`; status leaving `awaiting`
from outside → `settled`; status `cancelled` while awaiting → `expired`. A press in any other
attempt state SHALL be ignored; while `submitting` both buttons SHALL be `aria-disabled` and
focusable. The identity passed SHALL be the call's `id`, never its name.

#### Scenario: One decision

- **WHEN** Approve is pressed twice before `onDecision` settles
- **THEN** `onDecision` was called once with `{ id, approved: true }`

#### Scenario: Abandoned is expired (regression: CopilotKit#5554)

- **WHEN** an awaiting call's status becomes `cancelled`
- **THEN** the attempt is `expired` and no decision was sent

### Requirement: Tool Call Focus

With `focusOnRequest="approval"`, entering `awaiting` SHALL focus Approve; by default
(`"none"`) the focus SHALL NOT move. When the attempt becomes `settled` or `expired` and the
focus was inside the Approval, the focus SHALL move to the Receipt.

#### Scenario: Focus after deciding (regression: assistant-ui#8704)

- **WHEN** Approve is pressed with the keyboard and the decision settles
- **THEN** the Receipt has the focus and reads the decision

### Requirement: Tool Call Announcements

Entering `awaiting` SHALL announce `messages.awaiting(name)` politely and entering `error`
`messages.failed(name)`; `done` SHALL announce nothing; `announce="off"` SHALL silence both.

#### Scenario: Approval requested

- **WHEN** a `delete_file` call becomes `awaiting`
- **THEN** "delete_file needs your approval" is announced once

### Requirement: Tool Call Duration

The duration SHALL be the `duration` prop when given, otherwise the injected Clock's time from
the first live status (`pending`, `running`) to the first final one; a call mounted already
final SHALL show no measured duration.

#### Scenario: Measured

- **WHEN** a call goes `running` then `done` 2400 ms later
- **THEN** the Duration reads "2.4 seconds"

### Requirement: Tool Call Data Attributes

Every part SHALL carry `data-scope="tool-call"`, `data-part`, `data-instance`, `data-state`
and `data-open` when open; the Approval SHALL carry `data-approval`, `data-risk` and
`data-decision`; the buttons `data-disabled` and the focus attributes.

#### Scenario: Risk

- **WHEN** `risk="high"`
- **THEN** the Approval has `data-risk="high"`

### Requirement: Tool Call Messages

The strings SHALL come from `messages`: `status(status)` (a word per status), `awaiting(name)`,
`failed(name)`, `approve`, `deny`, `approved`, `denied`, `expired`, `duration(seconds)`, with
English defaults.

#### Scenario: Localised receipt

- **WHEN** `messages.approved` is "Approvato" and a decision to approve settles
- **THEN** the Receipt reads "Approvato"

### Requirement: Tool Call Contract

The contract SHALL locate by the Header's name, else the only Tool Call, provide the actions
`toggle`, `approve`, `deny` and the queries `status`, `isOpen`, `approvalState`, `decision`,
`receiptText`.

#### Scenario: Driver

- **WHEN** a test calls `approve()` on an awaiting call whose handler resolves
- **THEN** `approvalState()` becomes `settled` and `decision()` is `approved`

### Requirement: Tool Call Theme

`@rind-ui/theme` SHALL style the Tool Call in the `panel` family with the status shown by an
icon shape and text (never colour alone), Approve and Deny as keys, and a high-risk approval
with the danger tone.

#### Scenario: Error not by colour alone

- **WHEN** the status is `error`
- **THEN** the Status shows its word and a distinct icon
