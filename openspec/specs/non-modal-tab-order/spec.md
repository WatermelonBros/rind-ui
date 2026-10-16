# non-modal-tab-order Specification

## Purpose
Places the content of an open non-modal layer in the sequential Tab order right
after the element that opened it, wherever the content is rendered in the DOM,
so portalled popovers and hover cards stay reachable in a meaningful sequence
(WCAG 1.3.2, 2.4.3) without focus-sentinel elements. Shared by every non-modal
anchored layer (Popover, Hover Card, later Navigation Menu).
## Requirements
### Requirement: Content Follows Its Trigger

While a non-modal layer that uses this capability is open, pressing Tab on its
trigger SHALL move focus to the first tabbable element of the layer's content
(using the same sequential order as focus containment: positive `tabindex` first,
radio groups as one stop, keyboard-focusable scroll containers included). When the
content has no tabbable element, Tab on the trigger SHALL behave as if the content
did not exist.

#### Scenario: Tab from the trigger enters portalled content

- **WHEN** a non-modal popover rendered in a portal at the end of `body` is open,
  focus is on its trigger, and the user presses Tab
- **THEN** focus moves to the first tabbable element of the popover content, not
  to the element after the trigger in the DOM

#### Scenario: Content without tabbable elements

- **WHEN** an open hover card contains only text and focus is on its trigger
- **THEN** Tab moves focus to the next tabbable element after the trigger

### Requirement: Leaving Backward

Shift+Tab from the first tabbable element of the content, or from the content
element itself, SHALL move focus to the trigger. The layer SHALL stay open.

#### Scenario: Back to the trigger

- **WHEN** focus is on the first input of an open non-modal popover and the user
  presses Shift+Tab
- **THEN** the trigger is focused and the popover is still open

### Requirement: Leaving Forward

Tab from the last tabbable element of the content, or from the content element
itself when it has no tabbable element, SHALL move focus to the first tabbable
element that follows the trigger in the document's sequential order, skipping the
content and its descendant layers. Focus leaving the layer this way is an outside
focus move, so a layer that dismisses on outside focus closes. When nothing
tabbable follows the trigger, the key press SHALL be left to the browser (focus
moves to the browser chrome) and SHALL NOT throw or loop.

#### Scenario: Continue after the trigger

- **WHEN** focus is on the last button of an open non-modal popover whose trigger
  is followed by a "Save" button in the page, and the user presses Tab
- **THEN** "Save" is focused and the popover closes with reason `"outside-focus"`
  (regression: radix#4128)

#### Scenario: Nothing after the trigger

- **WHEN** an open non-modal popover with no tabbable content is the last thing on
  a page whose only other tabbable element is its trigger, and the user presses
  Tab from the content
- **THEN** no error is thrown and no recursion happens; focus moves to the browser
  chrome, which is not an outside focus move (`relatedTarget` is `null`), so the
  popover stays open (regression: mui/base-ui#5715)

### Requirement: Independent Of DOM Position

The resulting Tab order SHALL be the same whether the content is portalled or
rendered inline, and whether or not inline content immediately follows the
trigger in the DOM.

#### Scenario: Inline and portalled

- **WHEN** the same popover is rendered once inline and once portalled and the user
  tabs from the element before the trigger through the open popover
- **THEN** focus visits the same elements in the same order in both cases

### Requirement: Nested Non-Modal Layers

When a non-modal layer is opened from inside another non-modal layer's content,
its content SHALL follow its own trigger inside the parent's sequence, and leaving
it forward SHALL continue with the element after its trigger inside the parent's
content.

#### Scenario: Popover inside a popover

- **WHEN** popover B is open from a button inside popover A, focus is on B's last
  element, and the user presses Tab
- **THEN** focus moves to the element after B's trigger inside A, B closes, and A
  stays open

### Requirement: No Sentinels And No Focus Reclaim

The capability SHALL be implemented with key handling on the trigger and the
content only: it SHALL NOT insert focusable sentinel elements, SHALL NOT redirect
`focusin` events, and SHALL NOT act on a Tab key press whose `keydown` was already
`preventDefault()`-ed by an element inside the content. It SHALL NOT apply to
modal layers, whose Tab behaviour is focus containment.

#### Scenario: No guard elements

- **WHEN** a non-modal popover is open
- **THEN** no element with `tabindex="0"` exists that was added by the system
  outside the popover's own parts

#### Scenario: Inner widget handles Tab

- **WHEN** an element inside the content handles Tab itself (for example an
  editor indenting text) and calls `preventDefault()`
- **THEN** focus does not move and the popover stays open

#### Scenario: Modal popover

- **WHEN** a modal popover is open and focus is on its last tabbable element
- **THEN** Tab wraps to its first tabbable element instead of leaving

### Requirement: Shadow Roots

The sequential order SHALL be computed through open shadow roots, so triggers and
content inside web components keep the same order.

#### Scenario: Trigger inside a shadow root

- **WHEN** a popover's trigger lives in an open shadow root followed by a button in
  the same root, and focus leaves the content forward
- **THEN** the button in the shadow root is focused (regression:
  headlessui#2951)

