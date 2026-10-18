## ADDED Requirements

### Requirement: Alert Dialog Role

`Dialog.Root` SHALL accept `role` (`"dialog"`, the default, or `"alertdialog"`). With
`role="alertdialog"` the dialog is a confirmation: its content SHALL have role
`alertdialog`, its layer kind SHALL be `alertdialog`, it SHALL be modal whatever the
props, an outside press SHALL never close it, its initial focus SHALL default to the
`cancel` part, and a missing description SHALL log a development warning. `modal` and
`closeOnInteractOutside` SHALL NOT be props of a `role="alertdialog"` Root (a type error).
Every other behaviour SHALL be the Dialog's; the parts SHALL keep `data-scope="dialog"`.
There SHALL be no separate Alert Dialog component or machine.

#### Scenario: A confirmation from Dialog parts

- **WHEN** `<Dialog.Root role="alertdialog">` renders a trigger, a title, a description,
  `Dialog.Cancel` and `Dialog.Action`, and the trigger is pressed
- **THEN** an `alertdialog` named by the title and described by the description opens,
  modal, with focus on Cancel, and a press on the backdrop leaves it open

#### Scenario: The role cannot be weakened

- **WHEN** a consumer writes `<Dialog.Root role="alertdialog" modal={false}>`
- **THEN** it does not compile

### Requirement: Cancel And Action Parts

The Dialog SHALL provide `cancel` (`button`) and `action` (`button`) parts, usable in
either role. A press on `cancel` SHALL request a close with reason `cancel`; a press on an
`action` SHALL request a close with reason `action` (the event carries the action's id),
cancellable through `details.cancel()`. Both SHALL default to `type="button"` and carry
`data-scope="dialog"`, their `data-part`, `data-focus`, `data-focus-visible`,
`data-pressed` and `data-disabled`. Any number of actions MAY be rendered.

#### Scenario: Cancel in a plain dialog

- **WHEN** a dialog with the default role renders `Dialog.Cancel` and the user presses it
- **THEN** it closes and `onOpenChange` reports reason `cancel`

### Requirement: Alert Dialog Role — Same Behaviour As Dialog Unless Stated

A Dialog with `role="alertdialog"` (a confirmation) SHALL meet every requirement of the `dialog` capability — open state
and controlled mode, parent layer, nesting, forms, mounting, server rendering,
final focus, roles of the trigger, merging of consumer ids — except the ones this
capability replaces: modality, dismissal defaults, initial focus, role, naming,
the close parts, the scope name and the contract. It SHALL be built from the same
machine definition as the Dialog, not from a copy.

#### Scenario: Shared fix

- **WHEN** a bug in focus restore is fixed in the Dialog machine
- **THEN** a confirmation's model-based tests exercise the fixed code path without
  any change to a confirmation (regression: reka-ui#2702)

### Requirement: Alert Dialog Role — Anatomy

A Dialog with `role="alertdialog"` (a confirmation) SHALL consist of `root`, `trigger`, `backdrop`, `positioner`,
`content`, `title`, `description`, `cancel` (`button`) and `action` (`button`).
`cancel` and `action` SHALL default to `type="button"`; any number of `action`
parts MAY be rendered.

#### Scenario: Delete confirmation

- **WHEN** an alert dialog renders title "Delete project?", a description, "Cancel"
  and "Delete" and is opened
- **THEN** an `alertdialog` named "Delete project?" and described by the description
  is shown, and "Cancel" is focused

### Requirement: Alert Dialog Role — Always Modal

A Dialog with `role="alertdialog"` (a confirmation) SHALL always be a modal layer of kind `alertdialog` and SHALL NOT
accept a `modal` prop. Its content SHALL have `role="alertdialog"` and
`aria-modal="true"`.

#### Scenario: Page behind

- **WHEN** an alert dialog is open
- **THEN** the page behind is inert and scroll-locked, Tab stays inside, and the
  content has `role="alertdialog"` and `aria-modal="true"`

### Requirement: Alert Dialog Role — Dismissal

An outside press, including a press on the backdrop or positioner, SHALL NOT close
a confirmation, and it SHALL NOT accept a `closeOnInteractOutside` prop. Escape
SHALL close it with reason `escape-key` unless `closeOnEscape={false}` or the
consumer vetoes the request.

#### Scenario: Backdrop press

- **WHEN** the user clicks the backdrop of an open alert dialog
- **THEN** it stays open, no `onOpenChange` is called, and no layer beneath closes
  (regression: radix#1738)

#### Scenario: Escape

- **WHEN** the user presses Escape in an open alert dialog
- **THEN** it closes with reason `escape-key` and focus returns to its trigger
  (regression: mui/base-ui#1688)

#### Scenario: Escape vetoed without user activation

- **WHEN** an alert dialog is opened programmatically after a session timeout,
  without any user activation, and the consumer vetoes Escape in `onEscapeKeyDown`
- **THEN** the dialog stays open (native `<dialog>` cannot guarantee this:
  native-platform.md §1; regression: radix#2227)

### Requirement: Alert Dialog Role — Cancel And Action

Pressing `cancel` SHALL request closing with reason `cancel`. Pressing an
`action` SHALL request closing with reason `action`; the dialog SHALL close
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
  closes with reason `action` (regression: radix#1779)

#### Scenario: Controlled cancel

- **WHEN** a controlled alert dialog's "Cancel" is pressed and the parent applies
  `onOpenChange(false)`
- **THEN** the dialog closes and `details.reason` is `cancel`, distinguishable
  from `escape-key` and `action` (regression: react-spectrum#8139,
  react-spectrum#1773)

### Requirement: Alert Dialog Role — Initial Focus

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

### Requirement: Alert Dialog Role — Naming And Description

An open confirmation SHALL have an accessible name (as the Dialog) and an accessible
description that conveys the alert message. When the title (or `aria-label` /
`aria-labelledby`) is missing, or the description (or a consumer
`aria-describedby`) is missing, it SHALL emit one development warning per missing
item and SHALL NOT throw.

#### Scenario: Missing description

- **WHEN** an alert dialog renders a title and no description
- **THEN** one development warning names the missing description, and the content
  has no `aria-describedby` attribute (regression: react-spectrum#9916)

### Requirement: Alert Dialog Role — Nested Alert Dialogs

A confirmation opened from a Dialog, or a Dialog opened from a confirmation, SHALL be
a child layer of it, with the stacking metadata of the Dialog's Nested Dialogs
requirement; closing the child SHALL NOT close the parent.

#### Scenario: Confirm inside an edit dialog

- **WHEN** an edit dialog opens a "Discard changes?" alert dialog and the user presses
  "Cancel"
- **THEN** only the alert dialog closes, the edit dialog has `data-has-nested` until
  then, and focus returns to the edit dialog's "Close" button that opened it
  (regression: radix#1858, mui/base-ui#1165)

### Requirement: Alert Dialog Role — Title Heading Level

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

### Requirement: Alert Dialog Role — Data Attributes

Every part SHALL carry `data-scope="dialog"`, `data-part` (`trigger`,
`backdrop`, `positioner`, `content`, `title`, `description`, `cancel`, `action`) and
`data-instance`, and the same state, focus, press, nesting and close-reason
attributes as the corresponding Dialog part. `data-modal` SHALL always be present on
`positioner` and `content`. `cancel` and `action` SHALL carry `data-focus`,
`data-focus-visible` and `data-pressed`.

#### Scenario: Close reason styling

- **WHEN** the dialog closes because "Delete" was pressed
- **THEN** during its exit animation the content has `data-state="closed"` and
  `data-close-reason="action"`

### Requirement: Alert Dialog Role — Alert Dialog Contract

The confirmation's contract variant (`alertDialogRoleContract`, which
`getDialog(target, { name, role: "alertdialog" })` uses) SHALL locate an instance as the
Dialog contract does, through its trigger (role `button`, exact name `trigger` defaulting
to the dialog's `name`), since a closed dialog has no content to locate; it SHALL declare
the traits `modal` and `presence`, and the Dialog contract's actions and queries, which
include `cancel()` and `confirm(name?)` (press the action with that accessible name, or
the only action), each with pointer and keyboard implementations. Its `pressOutside`
action SHALL complete when the dialog is still open. The event map SHALL map
`CANCEL_PRESS` to `cancel`, `ACTION_PRESS` to `confirm`, and `CLOSE_TRIGGER_PRESS` to a
skip (a confirmation has Cancel and Action).

#### Scenario: Driver

- **WHEN** a test runs `const a = getDialog(screen, { name: "Delete project?", role: "alertdialog" })`,
  `await a.open()`, `await a.confirm("Delete")`
- **THEN** both resolve, and `await a.closeReason()` is `"action"`

#### Scenario: Model run

- **WHEN** `testMachine(alertDialogRoleContract, …)` runs in every modality
- **THEN** every transition is covered, outside-press steps expect the dialog to stay
  open, and every generic, accessibility and overlay invariant passes

## MODIFIED Requirements

### Requirement: Anatomy

The Dialog SHALL consist of these parts: `root` (renders no element), `trigger`
(`button`), `backdrop` (`div`), `positioner` (`div`), `content` (`div`), `title`
(`h2`), `description` (`p`), `close-trigger` (`button`), `cancel` (`button`) and
`action` (`button`). Only `root` and `content` SHALL be required. Any number of
`trigger`, `close-trigger` and `action` parts MAY be rendered. The content, backdrop
and positioner SHALL work the same whether they are rendered inline or inside the shared
`Portal` part. Every part SHALL accept the props of the element it renders and SHALL
support element substitution without a change in behaviour.

#### Scenario: Minimal dialog

- **WHEN** a dialog renders only a root and a content with `aria-label="Settings"`
  and is opened programmatically
- **THEN** a `dialog` named "Settings" is shown, focused and modal

#### Scenario: Ark-shaped markup

- **WHEN** Reado's `Modal` (root, portal, backdrop, positioner, content with
  `aria-label`) is rewritten with rind-ui parts of the same names
- **THEN** it opens, traps focus, closes on Escape and on a backdrop press, and
  returns focus, with no other change to its markup
