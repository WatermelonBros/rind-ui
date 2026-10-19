# hover-card Specification

## Purpose
Defines the Hover Card component: a non-modal preview layer opened by resting the
pointer on, or keeping keyboard focus on, a link; it may contain interactive
content, stays reachable by keyboard, and must never hold information or actions
that are not also available through the link itself.
## Requirements
### Requirement: Anatomy

A hover card SHALL consist of `Root` (no element), `Trigger` (default `a`),
`Positioner` (default `div`), `Content` (default `div`) and an optional `Arrow`
(default `div`), and MAY render `Positioner` and its descendants inside the shared
`Portal`. Every rendered part SHALL carry `data-scope="hover-card"`, its
`data-part` and the instance's `data-instance`. The trigger SHALL keep its own
role and `href`.

#### Scenario: Link trigger

- **WHEN** a hover card's trigger renders `<a href="/u/jane">Jane</a>`
- **THEN** it keeps role `link` and its `href`, and gets the hover card's ARIA
  attributes and handlers

### Requirement: Open State And Reasons

The open state SHALL be controllable: `open`, `defaultOpen` (default `false`),
`onOpenChange(open, details)` with `details.reason` `hover`, `focus` or `api` when
opening and `pointer-leave`, `blur`, `escape-key`, `outside-press`,
`outside-focus`, `parent-dismissed`, `disabled` or `api` when closing. A `disabled`
hover card SHALL never open.

#### Scenario: Escape reason

- **WHEN** an open hover card is closed with Escape
- **THEN** `onOpenChange(false, details)` receives `details.reason === "escape-key"`

### Requirement: Opening

The hover card SHALL open after `openDelay` (default 700 ms) when the pointer
rests on the trigger, through `hover-intent`, and after the same delay when the
trigger has focus with the `keyboard` modality caused by a key. It SHALL NOT open
from touch input, from pointer or virtual (screen-reader cursor) focus, when the
window regains focus, or when a layer's initial focus or focus restore moves focus
onto the trigger. Leaving the trigger (pointer or focus) before the delay SHALL
cancel the open.

#### Scenario: Tabbing quickly through links

- **WHEN** the user tabs through ten preview links, staying 200 ms on each
- **THEN** no hover card opens

#### Scenario: Lingering on a link

- **WHEN** the user tabs onto a preview link and waits 700 ms
- **THEN** the hover card opens with reason `"focus"` and focus stays on the link

#### Scenario: Popover autofocus on a preview trigger

- **WHEN** a popover opens and its initial focus lands on a hover card trigger
- **THEN** the hover card stays closed (regression: radix#2138)

#### Scenario: Tap follows the link

- **WHEN** the user taps a preview link on a phone
- **THEN** the browser navigates to the link and no hover card opens; nothing calls
  `preventDefault()` on the touch (regression: reka-ui#802)

### Requirement: No Initial Focus

Opening SHALL NOT move focus; the hover card is a preview. Focus enters the content
only by the user's Tab (see Keyboard Access) or pointer.

#### Scenario: Hover open

- **WHEN** the hover card opens by hover while focus is in a search field
- **THEN** focus stays in the search field

### Requirement: Keyboard Access

The content SHALL take its place in the Tab sequence right after the trigger
through `non-modal-tab-order`: Tab on the trigger of an open hover card enters the
content, Shift+Tab from its first tabbable element returns to the trigger, and Tab
past its last tabbable element continues after the trigger and closes it. Tabbable
elements inside the content SHALL keep their own `tabindex`.

#### Scenario: Follow button in a profile card

- **WHEN** a hover card with a "Follow" button is open by keyboard focus and the
  user presses Tab
- **THEN** "Follow" is focused and the card stays open (regression: radix#2692)

#### Scenario: Escape then continue

- **WHEN** focus is on "Follow" inside the card and the user presses Escape and
  then Tab
- **THEN** the card closes with focus on the trigger, and Tab moves to the element
  after the trigger

### Requirement: Staying Open

An open hover card SHALL NOT close because the pointer left the hover zone while
focus is inside its content or one of its descendant layers, while the trigger has
keyboard focus, or while a descendant layer is open.

#### Scenario: Pointer leaves while the trigger is focused

- **WHEN** a hover card opened by keyboard focus is hovered and the pointer then
  leaves
- **THEN** the card stays open (regression: zag#3224)

#### Scenario: Browser autofill over the card

- **WHEN** an input inside the card is focused and the browser's autofill dropdown
  covers the pointer
- **THEN** the card stays open (regression: radix#2502)

#### Scenario: Select inside the card

- **WHEN** a select inside the card is open and the pointer moves over its
  portalled listbox
- **THEN** the card and the select stay open (regression: radix#3175,
  react-spectrum#10443, mui/base-ui#3129)

#### Scenario: Nested hover card

- **WHEN** a link inside an open hover card opens a second hover card and the
  pointer moves onto it
- **THEN** both stay open (regression: mui/base-ui#3673)

### Requirement: Closing

An open hover card SHALL close after `closeDelay` (default 300 ms) when the pointer
leaves the hover zone and none of the Staying Open conditions hold
(`pointer-leave`); after `closeDelay` when focus leaves both the trigger and the
content and the pointer is not in the hover zone (`blur`); immediately on Escape
while it is the topmost layer, on a press outside its trigger, content and
descendant layers, and on focus moving outside them. Moving the pointer across the
gap between trigger and content SHALL NOT close it (grace area).

#### Scenario: Crossing the gap

- **WHEN** the card is placed 8 px below the trigger and the pointer moves from the
  trigger onto the card
- **THEN** it stays open (regression: zag#3181, reka-ui#1063)

#### Scenario: Pointer leaves

- **WHEN** the pointer leaves the trigger away from the card and nothing has focus
  inside
- **THEN** the card closes 300 ms later with reason `"pointer-leave"`

### Requirement: Layer

While open or closing, the hover card SHALL register a non-modal layer of kind
`popover`, a child of the layer that contains its trigger, dismissed by Escape,
outside press and outside focus. Focus SHALL be restored to the trigger on close
only when it was inside the content or on `body`.

#### Scenario: Hover card inside a dialog

- **WHEN** a hover card opened inside a dialog is hovered and the user presses
  Escape
- **THEN** only the hover card closes (regression: radix#920)

### Requirement: ARIA Attributes

The content SHALL have `role="dialog"`, no `aria-modal`, `tabindex="-1"`, and an
accessible name from the consumer's `aria-label`/`aria-labelledby`, else from the
trigger (`aria-labelledby` → trigger id). The trigger SHALL carry
`aria-haspopup="dialog"`, `aria-expanded` equal to the open state and
`aria-controls` pointing at the content only while it is mounted; it SHALL NOT get
`aria-describedby` from the card. The arrow SHALL be `aria-hidden="true"`.

#### Scenario: Open card

- **WHEN** a hover card for the link "Jane Doe" is open
- **THEN** the link has `aria-expanded="true"` and `aria-controls` = the content
  id, and the content is a dialog named "Jane Doe"

#### Scenario: Closed card

- **WHEN** the card is closed and unmounted
- **THEN** the link has `aria-expanded="false"` and no `aria-controls`

### Requirement: Keyboard Interactions

The hover card SHALL support these keys, and SHALL ignore Escape during IME
composition:

| Key | Where | Behaviour |
|---|---|---|
| Tab onto trigger | Trigger | Opens after `openDelay` |
| Tab | Trigger of an open card | First tabbable element of the content |
| Shift+Tab | First tabbable element | Trigger |
| Tab | Last tabbable element | Element after the trigger; closes |
| Escape | While topmost | Closes; focus to the trigger if it was inside |
| Enter | Trigger | The link's own activation |

#### Scenario: Escape during IME composition

- **WHEN** a user composing text in an input inside the card presses Escape
- **THEN** the card stays open

### Requirement: Announcements

The hover card SHALL make no announcement through the announcer; its presence is
conveyed by `aria-haspopup` and `aria-expanded` on the trigger.

#### Scenario: Open and close

- **WHEN** a hover card opens and closes with a recording announcer installed
- **THEN** no message was recorded

### Requirement: Positioning And Presence

The hover card SHALL be positioned with the `popup` preset (side `bottom`),
`sideOffset` 8 and collision padding 8 against its trigger (consumer `positioning`
overrides), only while open or closing, and SHALL use the shared presence for
positioner, content and arrow (unmounted after the exit animation; `keepMounted`
content is `hidden`, registers no layer and no hover zone).

#### Scenario: Kept mounted while closed

- **WHEN** a hover card with `keepMounted` is closed and the pointer moves over the
  space its content would occupy
- **THEN** nothing opens and the hidden content has no effect on hover or delays
  (regression: bits-ui#1697, bits-ui#1703)

### Requirement: Usage Rule

The documentation and the development build SHALL state that a hover card is an
enhancement: everything in it must also be reachable by following the trigger
link. In development, a hover card whose trigger is not a link (no `href`) SHALL
log a warning recommending Popover.

#### Scenario: Button trigger

- **WHEN** a hover card's trigger renders a `button` in development
- **THEN** a warning recommends Popover for button triggers

### Requirement: Data Attributes

Connect SHALL produce, in addition to `data-scope`, `data-part` and
`data-instance`:

- `Trigger`: `data-state="open|closed"`, `data-hover`, `data-focus`,
  `data-focus-visible`.
- `Positioner`: `data-state`, `data-side`, `data-align`, `data-placing`,
  `data-anchor-hidden`.
- `Content`: `data-state`, `data-side`, `data-align`, `data-placing`,
  `data-nested`, `data-has-nested`.
- `Arrow`: `data-side`, `data-uncentered`.

#### Scenario: Nested card styling

- **WHEN** a hover card is open inside another hover card
- **THEN** the inner content has `data-nested` and the outer content has
  `data-has-nested`

### Requirement: Contract

`hoverCardContract` SHALL locate an instance by its trigger's role (`link` by
default) and exact accessible name, and declare actions `show` (pointer: hover
and wait for the open delay; keyboard: Tab onto the trigger and wait),
`hide` (pointer: leave and wait for the close delay; keyboard: Escape), `enter`
(Tab into the content), `pressEscape`, `pressOutside`, `tab`, `shiftTab`,
`waitForUnmount`; queries `isOpen`, `hasFocus`, `isTopmost` and the positioning
fragment; traits `layer`, `restores-focus`, `presence`, `anchored`, `timed`. The
driver SHALL run unchanged with Testing Library (fake timers through the adapter)
and Playwright.

#### Scenario: Keyboard twin

- **WHEN** `getHoverCard(screen, { name: "Jane Doe" }).via("keyboard").show()` runs
  and then `enter()`
- **THEN** the card is open and focus is on its first tabbable element

#### Scenario: Touch and virtual replays

- **WHEN** `testMachine(hoverCardContract, …)` replays `show` with a touch pointer
  and adds a virtual focus step on the trigger
- **THEN** the card stays closed in both and the `no-touch-hover` and
  `focus-does-not-commit` invariants pass

