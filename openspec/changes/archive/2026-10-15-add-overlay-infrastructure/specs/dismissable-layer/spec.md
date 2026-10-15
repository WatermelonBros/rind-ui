## Purpose

Closes overlay layers in response to Escape, a press outside them, or focus moving
outside them, routed through the layer stack so that only the right layer reacts,
with a typed reason and a consumer veto on every dismissal.

## ADDED Requirements

### Requirement: Dismiss Requests With Reasons And Veto

Every dismissal SHALL be delivered to the layer's owner as a request carrying a
reason — `escape-key`, `outside-press`, `outside-focus` or `parent-dismissed` — the
originating event and its target. The request SHALL be cancelable: when the consumer
cancels it, the layer SHALL stay open and the dismissal SHALL NOT propagate to any
other layer. Each source (Escape, outside press, outside focus) SHALL be
individually enabled or disabled per layer.

#### Scenario: Veto Escape

- **WHEN** a consumer cancels the `escape-key` request of an open layer
- **THEN** the layer stays open and no layer beneath it closes

#### Scenario: Source disabled

- **WHEN** a layer disables outside-press dismissal and the user presses outside it
- **THEN** the layer stays open

### Requirement: Escape Closes Only The Topmost Layer

Pressing Escape SHALL dismiss only the topmost layer, once per key press, and SHALL
be a no-op when no layer is open (accessibility rule 19). It SHALL be handled
document-wide, so it works wherever focus is (including on `body`). It SHALL be
active as soon as the layer is registered, with no deferral. It SHALL be ignored
while an input method composition is in progress (`isComposing` or `keyCode`
229), and when an element inside the layer already handled the key by calling
`preventDefault()`. rind-ui components SHALL call `preventDefault()` on Escape
only when they actually acted on it.

#### Scenario: Nested layers

- **WHEN** a select is open inside a dialog and the user presses Escape
- **THEN** only the select closes; a second Escape closes the dialog

#### Scenario: Focus on body

- **WHEN** focus is on `body` (the focused element was removed) and the user presses
  Escape
- **THEN** the topmost layer closes

#### Scenario: Escape right after opening

- **WHEN** a dialog has just been registered and painted and the user presses Escape
  in the same animation frame
- **THEN** the dialog closes (regression: zag#3248)

#### Scenario: IME composition

- **WHEN** a user composing Japanese text in an input inside a dialog presses Escape
  to cancel the composition
- **THEN** the dialog stays open

#### Scenario: Inner widget consumes Escape

- **WHEN** a search field inside a dialog clears itself on Escape and calls
  `preventDefault()`
- **THEN** the dialog stays open

#### Scenario: Composite that does nothing with Escape

- **WHEN** focus is on a tab inside a modal dialog and the user presses Escape
- **THEN** the dialog closes; the tabs did not consume the key (regression:
  kobalte#688)

### Requirement: What Counts As An Outside Press

A press SHALL count as outside a layer only when all of the following hold: the
pointer went down and up outside the layer and its descendant layers; the pointer
went down after the layer was registered; it is the primary button without the
macOS Control modifier, and a single touch point; it is not on a scrollbar of the
page or of a scroll container; its target is connected; its target is not
inside an exiting layer; and its target is not inside an element marked
`data-rind-top-layer` (toast regions and other always-on-top regions). A bare `click` with no preceding pointer events (as sent
by assistive technology) SHALL never be an outside press. Pointer tracking SHALL be
done in the capture phase at the document, so that `stopPropagation()` in consumer
handlers does not break it.

#### Scenario: The opening click

- **WHEN** a popover opens on `pointerdown` of its trigger and the pointer is
  released outside the new popover
- **THEN** the popover stays open, because the press started before it was
  registered

#### Scenario: Outside press right after opening

- **WHEN** a menu opens from a keyboard press and the user clicks the page within the
  same animation frame
- **THEN** the menu closes on that click, because registration is synchronous
  (regression: bits-ui#2141)

#### Scenario: Text selection ending outside

- **WHEN** the user starts selecting text inside a dialog and releases the mouse
  outside it
- **THEN** the dialog stays open

#### Scenario: Scrollbar

- **WHEN** the user presses the page's scrollbar while a non-modal layer is open
- **THEN** the layer stays open (regression: ark#2925)

#### Scenario: Right click and Control-click

- **WHEN** the user right-clicks, or Control-clicks on macOS, outside a dialog
- **THEN** the dialog stays open

#### Scenario: Handler stops propagation

- **WHEN** a button inside a popover calls `stopPropagation()` on `pointerdown`, and
  the user then presses outside the popover once
- **THEN** the popover closes on that single press (regression: radix#2782)

#### Scenario: Screen reader activation outside

- **WHEN** a touch screen reader activates an element with a synthesized `click`
  and no pointer events while a select is open
- **THEN** the select is not dismissed by that click (regression: radix#1343)

### Requirement: Dismiss Surfaces

A layer MAY declare some of its own elements as dismiss surfaces — typically its
backdrop, and its positioner where the positioner extends beyond the content. A press
that starts and ends on a dismiss surface of a layer (and not inside that layer's
content or descendant layers) SHALL count as an outside press for that layer, under
every other rule of "What Counts As An Outside Press". Dismiss surfaces SHALL still
belong to the layer for every other purpose (focus containment, outside-inert,
presence).

#### Scenario: Backdrop click closes a modal dialog

- **WHEN** a modal dialog with a full-screen backdrop is open and the user presses
  and releases on the backdrop
- **THEN** the dialog receives a dismiss request with reason `outside-press`

#### Scenario: Press starting in content, ending on the backdrop

- **WHEN** the user starts a text selection inside the dialog content and releases
  over the backdrop
- **THEN** no dismiss request is made

#### Scenario: Positioner area around content

- **WHEN** a dialog's positioner fills the viewport to centre its content and the user
  presses the positioner outside the content
- **THEN** the press counts as outside the dialog

### Requirement: Touch Presses Dismiss On Click

For touch and pen presses, the outside-press dismissal SHALL happen on the `click`
that follows the pointer release, not on `pointerdown` or `pointerup`, so that the
compatibility click cannot land on an element revealed underneath. One press
gesture SHALL dismiss layers at most once.

#### Scenario: Ghost click

- **WHEN** a user taps outside a select whose list covers a button
- **THEN** the select closes and the button underneath is not activated
  (regression: radix#1658)

#### Scenario: Closing a nested dialog on touch

- **WHEN** a user taps the close button of a child dialog opened from a parent dialog
  opened from a popover
- **THEN** only the child dialog closes (regression: ark#2557)

### Requirement: Which Layers One Outside Press Dismisses

On an outside press, starting from the topmost layer, each layer whose subtree does
not contain the target SHALL be dismissed, stopping at the first layer that contains
the target, at the first layer that cancels the request, or at a modal layer. A
modal layer SHALL be dismissed by an outside press only when it is the topmost layer
when the press starts.

#### Scenario: Menu inside a controlled dialog

- **WHEN** a dropdown menu is open inside a controlled modal dialog and the user
  clicks the dialog's backdrop
- **THEN** only the menu closes; the dialog's `onOpenChange` is not called
  (regression: radix#4035)

#### Scenario: Submenu chain

- **WHEN** a menu with an open submenu is open and the user clicks the page
- **THEN** the submenu and the menu both close

#### Scenario: Press inside a lower non-modal layer

- **WHEN** two sibling non-modal popovers are open and the user presses inside the
  first one
- **THEN** only the second (topmost) popover closes

### Requirement: Nodes Added While Open Are Not Outside

Elements inserted into the document after the topmost modal layer opened, which do
not belong to any registered layer (browser extension overlays, password managers,
third-party widgets that portal to `body`), SHALL NOT count as outside for presses
or focus.

#### Scenario: Grammarly inside a dialog

- **WHEN** a browser extension inserts its suggestion panel into `body` while a modal
  dialog is open and the user clicks it
- **THEN** the dialog stays open (regression: radix#2055, radix#2219)

#### Scenario: Third-party select inside a dialog

- **WHEN** a non-rind combobox inside a modal dialog portals its options to `body`
  and the user picks one
- **THEN** the option is selected and the dialog stays open (regression:
  radix#3119, react-spectrum#5916, ark#3557)

#### Scenario: Pressing a toast above a dialog

- **WHEN** a modal dialog is open and the user presses "Undo" in a toast inside the
  `data-rind-top-layer` toast region
- **THEN** the dialog receives no dismiss request and the toast action runs

### Requirement: Outside Focus

Focus moving outside a non-modal layer and its descendants SHALL dismiss it with
reason `outside-focus`. It SHALL NOT dismiss when the new focus target is `null`
(window blur, tab switch, screen reader artefacts), when it is inside a descendant
layer, a node added while the layer was open, or an element marked
`data-rind-top-layer`, or while a pointer press is in progress. Modal layers SHALL NOT be dismissed by focus moving outside.

#### Scenario: Switching tabs

- **WHEN** a non-modal popover is open and the user switches browser tabs and back
- **THEN** the popover is still open (regression: react-spectrum#4130)

#### Scenario: Tabbing out of a popover

- **WHEN** focus is on the last element of a non-modal popover and the user presses
  Tab, moving focus to the page
- **THEN** the popover closes with reason `outside-focus`

### Requirement: No Pointer-Events Mutation

Dismissal and modality SHALL NOT be implemented by setting `pointer-events` on
`<body>` or any element outside the layer's own parts.

#### Scenario: Dialog opened from a menu item

- **WHEN** a menu item opens a modal dialog and the dialog then closes
- **THEN** `body` has no `pointer-events` style and the page responds to clicks
  (regression: radix#1241, radix#3317, radix#3141, radix#3645)
