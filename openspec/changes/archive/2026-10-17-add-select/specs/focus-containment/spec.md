## MODIFIED Requirements

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
sentinel elements. Non-modal layers SHALL NOT contain focus. A modal layer registered as
closed by Tab (`tabCloses`: a select, a menu) SHALL NOT have its Tab wrapped or prevented:
the layer closes and the browser's Tab moves on from its opener.

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

#### Scenario: Tab out of a modal select

- **WHEN** a modal select is open with focus on an option and the user presses Tab
- **THEN** the keydown is not prevented, the select closes and focus moves to the element
  after its trigger
