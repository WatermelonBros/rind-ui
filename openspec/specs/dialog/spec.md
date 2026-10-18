# dialog Specification

## Purpose
Defines rind-ui's Dialog: a window layered over the page, modal by default, that
moves focus in on open, returns it on close and is named by its title — its parts,
attributes, defaults, keyboard behaviour and the contract its driver and model-based
tests are generated from. Layer mechanics (Escape routing, outside presses, Tab
containment, focus recovery and restore, inert, scroll lock, presence, portal) are
those of `add-overlay-infrastructure` and are not restated here.
## Requirements
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

### Requirement: Open State And Reasons

The open state SHALL be a controllable value (`open`, `defaultOpen`,
`onOpenChange`), closed by default. Every change request SHALL carry, as its
reason, one of: `trigger` (a trigger was activated), `close-trigger`,
`escape-key`, `outside-press`, `outside-focus`, `parent-dismissed` or `api`
(programmatic open or close). Activating a trigger while the dialog is closed SHALL open
it; activating it while open (possible only when non-modal) SHALL close it. When
controlled, the dialog SHALL only propose the change and SHALL follow the `open`
prop; a parent that does not apply the proposal leaves the dialog as it was. A
change made by the parent through the `open` prop SHALL NOT call `onOpenChange`.
Requests made in one task SHALL be processed in order.

#### Scenario: Escape on a controlled dialog whose parent refuses

- **WHEN** a controlled dialog is open, the user presses Escape and the parent keeps
  `open={true}`
- **THEN** `onOpenChange(false, details)` was called with `details.reason ===
  "escape-key"`, the dialog is still open and focus has not moved

#### Scenario: Open then close in one task

- **WHEN** code opens and then closes an uncontrolled dialog synchronously
- **THEN** the dialog ends closed (regression: zag#3324)

#### Scenario: Cancelled request

- **WHEN** `onOpenChange` calls `details.cancel()` for a `close-trigger` change
- **THEN** the dialog stays open

### Requirement: Modal By Default

A dialog SHALL be modal unless `modal={false}`. While a modal dialog is open it SHALL
be a modal layer of kind `dialog`, so that everything outside it and its descendant
layers is inert, page scrolling is locked and Tab stays inside it, as specified by
the overlay capabilities. Its content SHALL carry `aria-modal="true"`. Modality
SHALL NOT depend on `aria-modal` being honoured by assistive technology.

#### Scenario: Page behind a modal dialog

- **WHEN** a modal dialog is open
- **THEN** the application root is inert, the page does not scroll, Tab from the
  last tabbable element of the dialog moves to its first, and `<body>` has no
  `pointer-events` style

### Requirement: Non-Modal Dialogs

With `modal={false}` the dialog SHALL be a non-modal layer: nothing outside it SHALL
be made inert, scrolling SHALL NOT be locked, focus SHALL NOT be contained, and its
content SHALL NOT carry `aria-modal`. The backdrop part SHALL render nothing while
the dialog is non-modal. The positioner SHALL let pointer events through to the page
outside the content. By default a press outside a non-modal dialog and focus moving
out of it SHALL NOT close it; its triggers SHALL stay operable and toggle it.

#### Scenario: Page stays usable

- **WHEN** a non-modal dialog with a positioner and a backdrop part is open and the
  user clicks a button on the page and selects text next to it
- **THEN** the button activates, the text is selected, no backdrop is rendered, and
  the dialog stays open (regression: zag#3401, ark#3892, zag#2957)

#### Scenario: Tabbing out in Safari

- **WHEN** focus leaves a non-modal dialog while tabbing through its form in Safari
- **THEN** the dialog stays open (regression: radix#3811)

#### Scenario: Trigger toggles

- **WHEN** a non-modal dialog is open and the user presses its trigger
- **THEN** it closes with reason `trigger`, and the press was not treated as an
  outside press

### Requirement: Dismissal Defaults

Escape SHALL close the dialog when it is the topmost layer (`closeOnEscape`, default
`true`). An outside press SHALL close a modal dialog (`closeOnInteractOutside`,
default `true` when modal, `false` when non-modal). A press on the backdrop, or on
the positioner outside the content, SHALL count as an outside press of the dialog.
Consumers SHALL be able to veto each dismissal from `onEscapeKeyDown`,
`onInteractOutside` and `onOpenChange`; a vetoed dismissal SHALL NOT close any other
layer. A dialog mounted already open during a press SHALL NOT be closed by that
press.

#### Scenario: Backdrop press

- **WHEN** a modal dialog with a backdrop is open and the user clicks the backdrop
- **THEN** the dialog closes with reason `outside-press`

#### Scenario: Positioner press

- **WHEN** a modal dialog's positioner fills the viewport and the user clicks it
  beside the content
- **THEN** the dialog closes with reason `outside-press`; a click inside the content
  does not close it

#### Scenario: Mounted open by the opening click

- **WHEN** a button's click handler conditionally renders a controlled dialog that
  mounts with `open={true}`
- **THEN** the dialog stays open after the click completes (regression: ark#2744)

#### Scenario: Escape disabled

- **WHEN** `closeOnEscape={false}` and the user presses Escape in an open dialog
- **THEN** the dialog stays open and no layer beneath it closes

### Requirement: Initial Focus

On open, focus SHALL move into the dialog using the overlay's initial focus rule
(`data-autofocus`, then the first tabbable element, then the content; the content
when opened by touch). `initialFocus` SHALL accept a function returning an element,
`null` (default) or `false` (do not move focus), or the part names `"content"` or
`"title"`; when the title is the target it SHALL receive `tabindex="-1"` for as long
as it is the target. When an element inside the dialog has already taken focus on
mount (for example through a framework's `autoFocus`), the dialog SHALL leave focus
there. Focus moves SHALL keep the interaction modality, so a dialog opened with a
pointer shows no focus ring on its initial target.

#### Scenario: Form dialog

- **WHEN** a dialog whose first tabbable element is a "Name" field is opened with
  the keyboard
- **THEN** "Name" is focused without scrolling the page (its focus ring follows the
  browser's `:focus-visible`; `data-focus-visible` is set on the dialog's own parts)

#### Scenario: Long content

- **WHEN** a dialog with long terms text and `initialFocus="title"` opens
- **THEN** the title is focused and has `tabindex="-1"`, so the text is read from the
  start; after close the title no longer has `tabindex`

#### Scenario: Framework autoFocus from a menu

- **WHEN** a dialog opened from a menu item contains an input rendered with React's
  `autoFocus`
- **THEN** the input is focused when the dialog has opened, whether the menu item was
  activated by pointer or keyboard (regression: radix#1615, react-spectrum#8791)

#### Scenario: Opened from a menu with the mouse

- **WHEN** a dialog is opened by clicking a menu item
- **THEN** its initially focused element has `data-focus` and no `data-focus-visible`
  (regression: ark#3812)

#### Scenario: data-autofocus in a portalled dialog

- **WHEN** a portalled dialog marks a field with `data-autofocus` and opens on a
  scrolled page
- **THEN** the field is focused after the content is positioned, and the page scroll
  position is unchanged (regression: react-spectrum#4898, radix#3604)

### Requirement: Final Focus

On close, focus SHALL be restored by the overlay's restore rule, where the opener is
the trigger that opened the dialog; when the dialog was opened programmatically or
through the `open` prop, the opener SHALL be the element that had focus before it
opened. `finalFocus` SHALL accept a function of the close reason returning an
element, `null` (default) or `false` (do not move focus).

#### Scenario: Two triggers

- **WHEN** a dialog with triggers in a toolbar and in a table row is opened from the
  table row and closed by Escape
- **THEN** focus is on the table-row trigger

#### Scenario: Closed by a backdrop press

- **WHEN** a modal dialog opened from a trigger is closed by clicking its backdrop
- **THEN** focus is on the trigger, not on `body`, and the trigger has no
  `data-focus-visible` (regression: reka-ui#2649, bits-ui#1186)

#### Scenario: Opened programmatically

- **WHEN** an "Open programmatically" button sets `open={true}` on a dialog that also
  has a trigger, and the dialog closes
- **THEN** focus returns to the "Open programmatically" button, not to the trigger
  (regression: mui/base-ui#4169)

#### Scenario: Opened from a menu item

- **WHEN** a menu item opens a dialog, the menu closes and unmounts, and the dialog
  later closes
- **THEN** focus is on the menu's trigger, never on `body`

### Requirement: Keyboard Interactions

The dialog SHALL support these keys: Enter and Space on a trigger open the dialog
(and close it when non-modal and open); Enter and Space on a close trigger close it;
Escape closes it as specified in Dismissal Defaults; Tab and Shift+Tab move through
its tabbable elements and wrap at the edges while it is modal. The dialog SHALL NOT
handle Enter itself, so Enter in a form field submits the field's form natively and
Enter that commits an IME composition does not.

#### Scenario: Keyboard round trip

- **WHEN** a keyboard user focuses the trigger, presses Enter, presses Tab until focus
  wraps, then presses Escape
- **THEN** the dialog opened with focus on its first tabbable element, Tab wrapped
  inside it, Escape closed it and focus is on the trigger with `data-focus-visible`

#### Scenario: Enter submits the form inside

- **WHEN** a dialog contains a form with a text field and a submit button and the
  user presses Enter in the field
- **THEN** the form's `submit` event fires and the dialog does not close by itself

### Requirement: Roles And ARIA Attributes

The trigger SHALL have `aria-haspopup="dialog"`, `aria-expanded` (`true` only on the
trigger that opened the open dialog) and `aria-controls` pointing at the content only
while the content is mounted. The content SHALL have `role="dialog"`, `tabindex="-1"`,
`aria-modal="true"` when modal, `aria-labelledby` listing the title only while a
title is rendered, and `aria-describedby` listing the description only while a
description is rendered. Ids the consumer passes in `aria-labelledby` or
`aria-describedby` on the content SHALL be kept, with the parts' ids appended. The
backdrop SHALL be `aria-hidden="true"`. Triggers and close triggers SHALL default to
`type="button"`.

#### Scenario: No description

- **WHEN** a dialog renders a title and no description
- **THEN** the content has no `aria-describedby` attribute (regression: radix#3007,
  radix#1094, radix#2836)

#### Scenario: Title and description

- **WHEN** a dialog renders a title "Edit profile" and a description
- **THEN** the content's accessible name is "Edit profile" and its accessible
  description is the description's text (regression: mui/base-ui#1325)

#### Scenario: Lazy-mounted title

- **WHEN** a dialog whose content mounts only on open is opened, closed and opened
  again
- **THEN** each time it is open the content's `aria-labelledby` points at the rendered
  title (regression: ark#4182)

#### Scenario: Consumer description merged

- **WHEN** the consumer passes `aria-describedby="hint"` on the content and a
  description is rendered
- **THEN** the content's `aria-describedby` lists both `hint` and the description's
  id

#### Scenario: Trigger inside a form

- **WHEN** a trigger is rendered inside a form and pressed
- **THEN** the form is not submitted

### Requirement: Accessible Name

An open dialog SHALL have a non-empty accessible name from a rendered title, an
`aria-label` or an `aria-labelledby` on the content. When none is present after the
content mounts, the dialog SHALL emit one development warning naming the dialog
instance, and SHALL NOT throw. The check SHALL use the parts the dialog knows are
rendered and the content's own attributes, not a document-wide id lookup, so it is
correct inside shadow roots. A missing description SHALL NOT produce a warning.

#### Scenario: Wrapper without a title

- **WHEN** a design-system wrapper renders a dialog with neither a title nor an
  `aria-label`
- **THEN** one development warning is logged, nothing is thrown, and the model-based
  "named role" invariant fails for that wrapper (regression: radix#2986)

#### Scenario: Shadow root

- **WHEN** a dialog with a title renders inside an open shadow root
- **THEN** no warning is logged and the content is named by the title (regression:
  radix#3484)

#### Scenario: Description is optional

- **WHEN** a dialog has a title and no description
- **THEN** no warning is logged (regression: radix#3855)

### Requirement: Close Trigger Name

A close trigger that renders no content of its own SHALL be named by the dialog's
`messages.close` (English default "Close"); a close trigger with text content SHALL
be named by that text.

#### Scenario: Icon-only close button

- **WHEN** a close trigger contains only an SVG icon and the consumer passes
  `messages={{ close: "Chiudi" }}`
- **THEN** its accessible name is "Chiudi"

### Requirement: Announcements

The dialog SHALL NOT announce anything through the announcer when it opens or
closes; its name and description reach assistive technology through the focus move
into the dialog. The dialog's docs SHALL keep descriptions short and SHALL NOT rely
on the description for information the user must hear.

#### Scenario: Opening

- **WHEN** a dialog opens with a recording announcer
- **THEN** the announcement log is empty

### Requirement: Parent Layer

A dialog SHALL be the child of the nearest open dialog-like layer (`dialog`,
`alertdialog`, `drawer` or `popover`) among its logical ancestors — the layer whose content
contains its root, or else its trigger — and SHALL be a root layer otherwise. A popover is a
parent, so a dialog opened from a popover keeps the popover open and focus returns into it
(zag#2933). Menus, selects and tooltips SHALL NOT be the parent of a dialog, so a dialog opened
from inside one of them survives that layer closing (radix#1836).

#### Scenario: Dialog opened from a drawer

- **WHEN** a confirmation dialog is opened from a button inside an open drawer
- **THEN** the dialog is the drawer's child layer: Escape closes only the dialog, and
  closing the drawer closes the dialog first with reason `parent-dismissed`; stacking
  families stay separate (the drawer is not counted as a nested dialog)

#### Scenario: Dialog rendered inside a menu item

- **WHEN** a dialog's root is rendered inside a menu item, the item is activated, and
  the menu closes and unmounts its items
- **THEN** the dialog stays open and usable, and the page has no `pointer-events` or
  inert left over after it closes (regression: radix#1836, radix#3317, radix#3462)

#### Scenario: Dialog opened from a popover inside a dialog

- **WHEN** dialog A opens a popover, the popover opens dialog B, and B is closed with
  its close trigger
- **THEN** only B closes; A and the popover stay open (regression: zag#2933)

#### Scenario: Dialog opened from a popover

- **WHEN** a dialog is opened from a button inside an open popover and takes focus
- **THEN** the dialog is the popover's child layer: the popover stays open while the dialog
  has focus, and after the dialog closes focus returns to the button inside the popover

### Requirement: Nested Dialogs

A dialog opened from inside another dialog SHALL be its child layer. Escape and an
outside press on the child's backdrop SHALL close only the child. Closing the child
SHALL return focus to the element in the parent that opened it and SHALL NOT close
the parent. Closing the parent SHALL close the child first with reason
`parent-dismissed`. For stacking metadata, `dialog` and `alertdialog` layers SHALL
count as the same kind.

#### Scenario: Nested close button

- **WHEN** a nested dialog is closed with its close trigger, by mouse or by touch
- **THEN** the parent dialog stays open and focus is on the parent's "Open nested"
  button (regression: radix#1858, ark#2557, mui/base-ui#5650)

#### Scenario: Alert dialog inside a dialog

- **WHEN** a dialog opens an alert dialog
- **THEN** the dialog's content has `data-has-nested` and the alert dialog's content
  has `data-nested` (regression: mui/base-ui#1165)

### Requirement: Forms Inside Dialogs

A trigger, close trigger or other closing part rendered as a submit button of a form
inside the dialog SHALL let the form's `submit` event be dispatched, with the form
still connected, before the dialog's content unmounts. Closing the dialog SHALL NOT
reset or re-mount a form whose content stays mounted.

#### Scenario: Close trigger as submit button

- **WHEN** a close trigger rendered with `type="submit"` inside a form in the dialog is
  pressed, and the dialog has no exit animation
- **THEN** the form's `submit` handler runs, no "form is not connected" warning is
  logged, and the dialog closes with reason `close-trigger` (regression:
  radix#1109, radix#1779)

### Requirement: Mounting

Content, backdrop and positioner SHALL NOT be mounted before the dialog first opens
and SHALL be unmounted when their exit animations finish after closing. With
`keepMounted` they SHALL stay mounted while closed, hidden from assistive technology,
holding no layer, lock or inert. Re-opening during an exit animation SHALL keep the
same content element. Once closing, the content SHALL be inert, so presses on it
during its exit animation do nothing.

#### Scenario: Keep mounted while closed

- **WHEN** a closed dialog has `keepMounted`
- **THEN** its content is in the document and `hidden`, the page scrolls, and Tab
  reaches the page normally (regression: radix#998)

#### Scenario: Double click on close during exit

- **WHEN** a dialog with a 400 ms exit animation is closed with its close trigger and
  the user clicks the close trigger again during the animation
- **THEN** `onOpenChange` was called once (regression: mui/base-ui#3153)

### Requirement: Server Rendering

A dialog rendered on the server with `defaultOpen` or `open` SHALL produce markup
for the parts rendered inline (portalled parts render after hydration), with
`data-state="open"` and the same ids as the client. No layer, inert, lock or focus
move SHALL happen until the dialog is started on the client.

#### Scenario: Default open, inline

- **WHEN** an inline dialog with `defaultOpen` is server-rendered and hydrated
- **THEN** hydration reports no mismatch and, after hydration, the page behind is inert
  and focus is inside the dialog

### Requirement: Title Heading Level

The `title` part SHALL render `h{level}`, with `level` = the Title's `level` prop ?? 2,
so it stays `h2` by default; its heading attributes SHALL come from add-heading's shared
`headingProps` helper, so a title substituted through `render` with a non-heading
element gets `role="heading"` and `aria-level`. The `content` part SHALL wrap its
children in a `Heading.Level` set to the title's level + 1 (3 by default), so a
`Heading` inside the dialog body renders one level below the title without a `level` prop.

#### Scenario: Title defaults to h2

- **WHEN** a dialog renders a title with no `level` prop
- **THEN** the title is an `h2` with `data-level="2"`

#### Scenario: Heading inside content is one level deeper

- **WHEN** a dialog renders a title with `level={3}` and a `Heading` with no `level`
  inside its content
- **THEN** the inner heading is an `h4`

#### Scenario: Substituted title keeps its level

- **WHEN** the title is rendered with `render={<div />}`
- **THEN** the element has `role="heading"` and `aria-level="2"`

### Requirement: Data Attributes

Every part SHALL carry `data-scope="dialog"`, `data-part` (`trigger`, `backdrop`,
`positioner`, `content`, `title`, `description`, `close-trigger`) and
`data-instance`. Additionally:

- `trigger`: `data-state="open"` on the trigger that opened the open dialog, else
  `"closed"`; `data-focus`, `data-focus-visible`, `data-pressed`; `data-disabled`
  when disabled.
- `backdrop`: `data-state`; `data-nested`, `data-has-nested`; CSS variables
  `--layer-index` and `--nested-layer-count`.
- `positioner`: `data-state`; `data-modal` when modal; `data-nested`,
  `data-has-nested`; the same CSS variables.
- `content`: `data-state` (`"closed"` while exiting); `data-modal` when modal;
  `data-nested`, `data-has-nested`; `data-close-reason` (the last close reason in
  kebab case, such as `escape-key`) from close until the next open; `data-focus-within`
  while focus is inside it; `data-focus` and `data-focus-visible` while the content
  itself is focused; the same CSS variables.
- `trigger` also carries `data-close-reason`, so the reason outlives the content.
- `close-trigger`: `data-focus`, `data-focus-visible`, `data-pressed`.

`title` and `description` SHALL carry only the scoping attributes.

#### Scenario: Exit animation by reason

- **WHEN** a dialog closes by Escape and its content has an exit animation
- **THEN** during the animation the content has `data-state="closed"` and
  `data-close-reason="escape-key"`

#### Scenario: Stacked styling

- **WHEN** a dialog opens a nested dialog
- **THEN** the parent content has `data-has-nested` and `--nested-layer-count: 1`,
  and the nested content has `data-nested` and a `--layer-index` one higher

### Requirement: Dialog Contract

The `dialog` contract SHALL locate an instance through its trigger (role `button` and
exact accessible name `trigger`, defaulting to the dialog's `name`), because a closed
dialog has no content to locate; its `title()` query reads the dialog's own name. It
SHALL declare the traits `layer`, `restores-focus` and `presence`, plus `modal` when the
instance is modal (a separate non-modal contract variant, whose outside press is skipped
with that reason). It SHALL declare the actions `open` (pointer,
touch and keyboard implementations on a trigger), `close` (close trigger, pointer
and keyboard), `pressEscape`, `pressOutside` (a press on the backdrop, or outside the
content when there is none), `tab`, `shiftTab` and `waitForUnmount`, each completing
when its postcondition holds; and the queries `isOpen`, `isModal`, `title`,
`description`, `hasFocus`, `isTopmost` and `closeReason`. Its event map SHALL map
`TRIGGER_PRESS`, `CLOSE_TRIGGER_PRESS`, `ESCAPE_KEY` and `OUTSIDE_PRESS` to those
actions.

#### Scenario: Driver round trip

- **WHEN** a test runs `const d = getDialog(screen, { name: "Edit profile" })`, then
  `await d.open()`, `await d.pressEscape()`
- **THEN** `open()` resolves once the dialog is open with focus inside,
  `pressEscape()` resolves once it is closed, and `await d.closeReason()` is
  `"escape-key"`

#### Scenario: Same test in Playwright

- **WHEN** the same test runs with `page` instead of `screen`
- **THEN** it passes unchanged

### Requirement: Model-Based Coverage

`testMachine` over the dialog contract SHALL cover every transition in every
declared modality including `virtual`, for modal and non-modal props, and SHALL pass
every generic, accessibility and overlay invariant. Programmatic events with no
contract action (`OPEN`, `CLOSE`, `PARENT_DISMISSED`, `OUTSIDE_FOCUS`) SHALL be
reported as uncovered and covered by unit tests of the machine.

#### Scenario: Consumer wrapper drops the title wiring

- **WHEN** a consumer runs `testMachine(dialogContract, …)` on a wrapper that renders
  no title and passes `aria-labelledby="missing"` on the content
- **THEN** the step that opens the dialog fails, naming the dangling IDREF and the
  unnamed `dialog`

### Requirement: Alert Dialog Role

`Dialog.Root` SHALL accept `role` (`"dialog"`, the default, or `"alertdialog"`). With
`role="alertdialog"` the dialog is a confirmation: its content SHALL have role
`alertdialog`, its layer kind SHALL be `alertdialog`, it SHALL be modal whatever the
props, an outside press SHALL never close it, a close trigger SHALL NOT close it (it is
answered with Cancel, an Action or Escape), its initial focus SHALL default to the `cancel`
part (with no enabled Cancel, the content, so a lone "OK" is not activated by a stray Enter),
and a missing description SHALL log a development warning. `modal` and
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

