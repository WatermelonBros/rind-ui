## Purpose

Defines rind-ui's Alert Dialog: a modal dialog that asks the user to confirm or
cancel a consequential action. It behaves as the `dialog` capability
(`add-dialog`) specifies, except where this capability says otherwise; layer
mechanics come from `add-overlay-infrastructure` and are not restated.

## ADDED Requirements

### Requirement: Same Behaviour As Dialog Unless Stated

The Alert Dialog SHALL meet every requirement of the `dialog` capability — open state
and controlled mode, parent layer, nesting, forms, mounting, server rendering,
final focus, roles of the trigger, merging of consumer ids — except the ones this
capability replaces: modality, dismissal defaults, initial focus, role, naming,
the close parts, the scope name and the contract. It SHALL be built from the same
machine definition as the Dialog, not from a copy.

#### Scenario: Shared fix

- **WHEN** a bug in focus restore is fixed in the Dialog machine
- **THEN** the Alert Dialog's model-based tests exercise the fixed code path without
  any change to the Alert Dialog (regression: reka-ui#2702)

### Requirement: Anatomy

The Alert Dialog SHALL consist of `root`, `trigger`, `backdrop`, `positioner`,
`content`, `title`, `description`, `cancel` (`button`) and `action` (`button`).
`cancel` and `action` SHALL default to `type="button"`; any number of `action`
parts MAY be rendered.

#### Scenario: Delete confirmation

- **WHEN** an alert dialog renders title "Delete project?", a description, "Cancel"
  and "Delete" and is opened
- **THEN** an `alertdialog` named "Delete project?" and described by the description
  is shown, and "Cancel" is focused

### Requirement: Always Modal

The Alert Dialog SHALL always be a modal layer of kind `alertdialog` and SHALL NOT
accept a `modal` prop. Its content SHALL have `role="alertdialog"` and
`aria-modal="true"`.

#### Scenario: Page behind

- **WHEN** an alert dialog is open
- **THEN** the page behind is inert and scroll-locked, Tab stays inside, and the
  content has `role="alertdialog"` and `aria-modal="true"`

### Requirement: Dismissal

An outside press, including a press on the backdrop or positioner, SHALL NOT close
the Alert Dialog, and it SHALL NOT accept a `closeOnInteractOutside` prop. Escape
SHALL close it with reason `ESCAPE_KEY` unless `closeOnEscape={false}` or the
consumer vetoes the request.

#### Scenario: Backdrop press

- **WHEN** the user clicks the backdrop of an open alert dialog
- **THEN** it stays open, no `onOpenChange` is called, and no layer beneath closes
  (regression: radix#1738)

#### Scenario: Escape

- **WHEN** the user presses Escape in an open alert dialog
- **THEN** it closes with reason `ESCAPE_KEY` and focus returns to its trigger
  (regression: mui/base-ui#1688)

#### Scenario: Escape vetoed without user activation

- **WHEN** an alert dialog is opened programmatically after a session timeout,
  without any user activation, and the consumer vetoes Escape in `onEscapeKeyDown`
- **THEN** the dialog stays open (native `<dialog>` cannot guarantee this:
  native-platform.md §1; regression: radix#2227)

### Requirement: Cancel And Action

Pressing `cancel` SHALL request closing with reason `CANCEL_PRESS`. Pressing an
`action` SHALL request closing with reason `ACTION_PRESS`; the dialog SHALL close
unless the request is cancelled (`details.cancel()` or, when controlled, the parent
keeping `open={true}`). While a cancelled action's work is in progress the dialog
SHALL stay open, focus SHALL stay where it is and the content SHALL stay
interactive; the consumer closes it afterwards through the `open` prop or the
dialog's API. `cancel` and `action` rendered as submit buttons SHALL follow the
Dialog's rule that the form's `submit` event fires before the content unmounts.

#### Scenario: Async confirm

- **WHEN** "Delete" calls `details.cancel()`, starts a request, disables itself, and
  closes the dialog through the API when the request resolves 2 s later
- **THEN** during the 2 s the dialog is open, interactive and the page is still inert;
  afterwards it closes and focus returns to the trigger (regression: radix#1747)

#### Scenario: Action submits a form

- **WHEN** an action with `type="submit"` inside a form in the alert dialog is pressed
- **THEN** the form's `submit` handler runs with the form connected, then the dialog
  closes with reason `ACTION_PRESS` (regression: radix#1779)

#### Scenario: Controlled cancel

- **WHEN** a controlled alert dialog's "Cancel" is pressed and the parent applies
  `onOpenChange(false)`
- **THEN** the dialog closes and `details.reason` is `CANCEL_PRESS`, distinguishable
  from `ESCAPE_KEY` and `ACTION_PRESS` (regression: react-spectrum#8139,
  react-spectrum#1773)

### Requirement: Initial Focus

By default, on open, focus SHALL move to the `cancel` part, whatever the modality
(a button does not open the on-screen keyboard), else to the content.
`initialFocus` SHALL accept the same values as the Dialog's. The default SHALL
resolve the `cancel` element at the moment focus is moved, and SHALL NOT focus an
element that is no longer connected.

#### Scenario: Opened from a menu item

- **WHEN** an alert dialog is opened from a menu item by keyboard
- **THEN** "Cancel" is focused and has `data-focus-visible` (regression: radix#1615,
  bits-ui#1695)

#### Scenario: Content replaced before focus

- **WHEN** the alert dialog's content is replaced by the framework between opening
  and the frame in which initial focus runs
- **THEN** focus moves to the new "Cancel", and nothing focuses the detached
  element (regression: bits-ui#2136)

#### Scenario: No cancel part

- **WHEN** an alert dialog renders only an "OK" action
- **THEN** the content is focused

### Requirement: Naming And Description

An open Alert Dialog SHALL have an accessible name (as the Dialog) and an accessible
description that conveys the alert message. When the title (or `aria-label` /
`aria-labelledby`) is missing, or the description (or a consumer
`aria-describedby`) is missing, it SHALL emit one development warning per missing
item and SHALL NOT throw.

#### Scenario: Missing description

- **WHEN** an alert dialog renders a title and no description
- **THEN** one development warning names the missing description, and the content
  has no `aria-describedby` attribute (regression: react-spectrum#9916)

### Requirement: Nested Alert Dialogs

An Alert Dialog opened from a Dialog, or a Dialog opened from an Alert Dialog, SHALL be
a child layer of it, with the stacking metadata of the Dialog's Nested Dialogs
requirement; closing the child SHALL NOT close the parent.

#### Scenario: Confirm inside an edit dialog

- **WHEN** an edit dialog opens a "Discard changes?" alert dialog and the user presses
  "Cancel"
- **THEN** only the alert dialog closes, the edit dialog has `data-has-nested` until
  then, and focus returns to the edit dialog's "Close" button that opened it
  (regression: radix#1858, mui/base-ui#1165)

### Requirement: Title Heading Level

The `title` part SHALL render `h{level}`, with `level` = the Title's `level` prop ?? 2,
so it stays `h2` by default; its heading attributes SHALL come from add-heading's shared
`headingProps` helper, so a title substituted through `render` with a non-heading
element gets `role="heading"` and `aria-level`. The `content` part SHALL wrap its
children in a `Heading.Level` set to the title's level + 1 (3 by default), so a
`Heading` inside the alert dialog body renders one level below the title without a `level` prop.

#### Scenario: Title defaults to h2

- **WHEN** an alert dialog renders a title with no `level` prop
- **THEN** the title is an `h2` with `data-level="2"`

#### Scenario: Heading inside content is one level deeper

- **WHEN** an alert dialog renders a title with `level={3}` and a `Heading` with no `level`
  inside its content
- **THEN** the inner heading is an `h4`

#### Scenario: Substituted title keeps its level

- **WHEN** the title is rendered with `render={<div />}`
- **THEN** the element has `role="heading"` and `aria-level="2"`

### Requirement: Data Attributes

Every part SHALL carry `data-scope="alert-dialog"`, `data-part` (`trigger`,
`backdrop`, `positioner`, `content`, `title`, `description`, `cancel`, `action`) and
`data-instance`, and the same state, focus, press, nesting and close-reason
attributes as the corresponding Dialog part. `data-modal` SHALL always be present on
`positioner` and `content`. `cancel` and `action` SHALL carry `data-focus`,
`data-focus-visible` and `data-pressed`.

#### Scenario: Close reason styling

- **WHEN** the dialog closes because "Delete" was pressed
- **THEN** during its exit animation the content has `data-state="closed"` and
  `data-close-reason="action-press"`

### Requirement: Alert Dialog Contract

The `alert-dialog` contract SHALL locate an instance by role `alertdialog` and exact
accessible name, SHALL declare the traits `layer`, `modal`, `restores-focus` and
`presence`, and SHALL declare the Dialog contract's actions and queries except
`close`, plus `cancel()` and `confirm(name?)` (press the action with that accessible
name, or the only action), each with pointer and keyboard implementations. Its
`pressOutside` action SHALL complete when the dialog is still open. The event map
SHALL map `CANCEL_PRESS` to `cancel` and `ACTION_PRESS` to `confirm`.

#### Scenario: Driver

- **WHEN** a test runs `const a = getAlertDialog(screen, { name: "Delete project?" })`,
  `await a.open()`, `await a.confirm("Delete")`
- **THEN** both resolve, and `await a.closeReason()` is `"action-press"`

#### Scenario: Model run

- **WHEN** `testMachine(alertDialogContract, …)` runs in every modality
- **THEN** every transition is covered, outside-press steps expect the dialog to stay
  open, and every generic, accessibility and overlay invariant passes
