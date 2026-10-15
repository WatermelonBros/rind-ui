## Purpose

Moves focus into a layer when it opens, keeps keyboard focus inside the topmost
modal layer while it is open, recovers when the focused element disappears, and
returns focus to a sensible element when the layer closes — never leaving it on
`body`.

## ADDED Requirements

### Requirement: Initial Focus

When a layer opens, focus SHALL move into it once its container is connected and
rendered, no later than the next animation frame, without scrolling the page
(`preventScroll`). The target SHALL be chosen in this order: the consumer's choice;
an element marked `data-autofocus`; the first tabbable element; the container
itself (made focusable with `tabindex="-1"`). When the layer was opened by touch, the
default target SHALL be the container, so the on-screen keyboard does not open. A
consumer choice of `false` SHALL mean "do not move focus"; `null` SHALL mean "use the
default". If focus has already moved since the layer opened (the user or the app
moved it, inside or outside the layer), initial focus SHALL NOT move it again.

#### Scenario: First tabbable

- **WHEN** a dialog whose first tabbable element is a text field is opened with the
  keyboard
- **THEN** the text field is focused and the page does not scroll

#### Scenario: Opened by touch

- **WHEN** the same dialog is opened by a tap
- **THEN** the dialog container is focused and the text field is not

#### Scenario: Skip initial focus

- **WHEN** the consumer's initial focus choice returns `false`
- **THEN** focus does not move (regression: zag#3346)

#### Scenario: Focus moved before initial focus ran

- **WHEN** a field inside a layer is focused by the app (or the user) between the
  layer opening and the frame in which initial focus would run
- **THEN** initial focus leaves focus where it is (regression: ariakit#7033,
  reka-ui#2886)

#### Scenario: No tabbable content

- **WHEN** a dialog contains only text
- **THEN** the container is focused and has `tabindex="-1"`

### Requirement: Tab Stays Inside The Topmost Modal Layer

While a modal layer is the topmost modal layer, Tab from its last tabbable element
SHALL move focus to its first tabbable element, and Shift+Tab from its first
tabbable element, or from the container itself, SHALL move focus to its last.
Tabbable elements of descendant layers that render inside the container count as
part of it. Tab stops SHALL include scroll containers the browser makes keyboard
focusable (scrollable, with no focusable descendants) and SHALL follow the
browser's sequential order for positive `tabindex` values. Radio buttons SHALL
count as one tab stop per group (the checked one, or the first when none is
checked). Wrapping SHALL move focus without scrolling the page. With one tab stop, Tab SHALL keep focus on it;
with none, Tab SHALL keep focus on the container. Containment SHALL NOT use focus
sentinel elements. Non-modal layers SHALL NOT contain focus.

#### Scenario: Wrap forward

- **WHEN** focus is on the last button of a modal dialog and the user presses Tab
- **THEN** focus moves to the dialog's first tabbable element

#### Scenario: Keyboard-focusable scroller

- **WHEN** a modal dialog contains a scrollable region with only text, followed by a
  button, and the user tabs from the dialog's first element
- **THEN** focus reaches the scrollable region, so it can be scrolled with arrow
  keys, before the button (regression: react-spectrum#10395)

#### Scenario: Wrap does not scroll the page

- **WHEN** focus wraps from the last to the first element of a modal dialog
- **THEN** the page behind does not scroll (regression: headlessui#1787)

#### Scenario: Single tab stop

- **WHEN** a modal layer contains only a radio group and the user presses Tab
- **THEN** focus stays on the checked radio and never reaches the browser chrome
  (regression: zag#3042)

#### Scenario: No sentinels

- **WHEN** a modal dialog is open
- **THEN** no focusable element exists outside the dialog's own parts that was added
  by the system (no `tabindex="0"` guard spans)

### Requirement: Containment Never Pulls Focus Across Documents

Containment SHALL act only on Tab key presses inside the layer's own document and
on removal of the focused element; it SHALL NOT move focus in response to focus
entering another document, an iframe or a node added while the layer was open.

#### Scenario: Overlays in host and iframe

- **WHEN** a modal dialog is open in the host page and another in a same-origin
  iframe, and the user moves focus between them
- **THEN** neither document moves focus back, and both remain keyboard usable
  (regression: react-spectrum#8952)

### Requirement: Paused By A Modal Above

Containment SHALL apply only to the topmost modal layer. When a modal layer opens
above another, the lower layer's containment SHALL pause; when it closes, the lower
layer's containment SHALL resume without moving focus.

#### Scenario: Nested dialog closes

- **WHEN** a nested dialog opened from the parent's "Open nested" button closes
- **THEN** focus is on "Open nested", not on the parent's first focusable element
  (regression: zag#1718)

### Requirement: Recovery When The Focused Element Is Removed

When the element that had focus inside the topmost modal layer is removed from the
document, focus SHALL move to the layer's container. Recovery SHALL trigger only
when the last focused element is disconnected, not merely because
`document.activeElement` reads as `body`.

#### Scenario: Clicked button disappears

- **WHEN** the user clicks a "Remove" button inside a modal dialog and the button is
  removed
- **THEN** focus is on the dialog container, and the next Tab stays inside the dialog
  (regression: radix#1498, radix#2005)

#### Scenario: TalkBack swipe

- **WHEN** a TalkBack user swipes to the next element inside a modal dialog and the
  browser briefly reports `body` as the active element while the previously focused
  element is still connected
- **THEN** focus is not pulled back to the first element (regression:
  react-spectrum#7471)

### Requirement: Focus Restore On Close

When a layer closes, focus SHALL be restored at close time (not at unmount), after
outside hiding has been removed, and only if focus is inside the closing layer or
its descendants, or on `body`. The target SHALL be chosen in this order: the
consumer's choice (`false` = do not move); the element that opened the layer or was
focused before it opened, if it is connected, not inert and focusable; the most
recent still-connected element from a bounded focus history; the container of the
parent layer. Restoring focus SHALL never call `focus()` on an element inside an
`inert` subtree, and SHALL never leave focus on `body` when any of these candidates
exists (accessibility rules 11 and 13).

#### Scenario: Back to the trigger

- **WHEN** a dialog opened from a button closes by Escape
- **THEN** the button is focused

#### Scenario: Open at mount

- **WHEN** a popover rendered open at mount, before anything was focused, closes by
  Escape
- **THEN** focus moves to its trigger, not to `body` (regression:
  react-spectrum#10661)

#### Scenario: Trigger removed

- **WHEN** a dialog opened from a menu item closes after the menu has unmounted
- **THEN** focus moves to the menu's trigger, the most recent connected element in
  the focus history, not to `body` (regression: react-spectrum#2444)

#### Scenario: Inert cleanup ordering

- **WHEN** a modal popover closes and its trigger was inert while it was open
- **THEN** the trigger is no longer inert when focus is restored to it, and it ends
  up focused (regression: react-spectrum#10610)

#### Scenario: User clicked elsewhere

- **WHEN** a non-modal popover is open and the user clicks a text field on the page,
  closing the popover
- **THEN** the text field keeps focus (regression: radix#2942)

#### Scenario: Restore without timers after teardown

- **WHEN** a layer's owner is destroyed and the test environment is torn down right
  after
- **THEN** no timer scheduled by focus restore fires after teardown; all deferred
  work runs through the injected scheduler and is cancelled on stop (regression:
  radix#4148)

### Requirement: Shadow DOM

Initial focus, containment, recovery and restore SHALL work when the layer, its
trigger or its focusable descendants are inside open shadow roots, reading the
deep active element through shadow roots.

#### Scenario: Dialog in a shadow root

- **WHEN** a modal dialog renders inside an open shadow root and the user presses Tab
  from its last element
- **THEN** focus wraps to its first element (regression: radix#3353)

### Requirement: Exported Tab Order Helper

The sequential tab-order computation used by Tab wrapping SHALL be exported as the
named `core/dom` helper `tabbables(container): HTMLElement[]`, returning the container's
tab stops in the order Tab visits them under the rules of "Tab Stays Inside The Topmost
Modal Layer" (positive `tabindex` order, one stop per radio group, keyboard-focusable
scroll containers included). Tab wrapping SHALL use this helper, so any other consumer
(Scroll Area deciding whether its content has a tabbable element, requested by
add-scroll-area) gets exactly the order focus containment uses.

#### Scenario: Helper matches the wrap order

- **WHEN** `tabbables(container)` is called on a container holding a button with
  `tabindex="2"`, a text field, a radio group of three unchecked radios and a scrollable
  region with only text
- **THEN** it returns the button, the text field, the first radio and the scrollable
  region in that order, and Tab wrapping in a modal layer with that content visits the
  same elements in the same order (regression: react-spectrum#10395)

### Requirement: Focus Moves Use The Shared Focus Operation

Every focus move this capability makes (initial focus, wrapping, restore) SHALL go
through the safe programmatic focus operation of `interaction-modality`
(`add-a11y-foundations`), so the interaction modality is preserved and the target is
scrolled into view with the nearest-edge rule. Initial focus and focus restore SHALL
pass the focus cause `layer`; Tab wrapping SHALL pass `navigation`.

#### Scenario: Keyboard close keeps the focus ring

- **WHEN** a dialog opened and closed with the keyboard restores focus to its trigger
- **THEN** the modality is still `keyboard` and the trigger has `data-focus-visible`

#### Scenario: Pointer close shows no ring

- **WHEN** a dialog closed by clicking its close button restores focus to its trigger
- **THEN** the trigger has `data-focus` and no `data-focus-visible`
