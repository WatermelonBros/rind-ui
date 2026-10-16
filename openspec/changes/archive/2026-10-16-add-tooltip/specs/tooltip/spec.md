## Purpose

Defines the Tooltip component: a short, non-interactive text that describes or
names a focusable trigger, shown on pointer hover and keyboard focus, always
hoverable and dismissible (WCAG 1.4.13), never shown on touch, with its parts,
ARIA wiring, `data-*` attributes, keyboard behaviour and test contract.

## ADDED Requirements

### Requirement: Anatomy

A tooltip SHALL consist of `Root` (no element), `Trigger` (default `button`),
`Positioner` (default `div`), `Content` (default `div`) and an optional `Arrow`
(default `div`), and MAY render `Positioner` and its descendants inside the shared
`Portal`. Every rendered part SHALL carry `data-scope="tooltip"`, its `data-part`
and the instance's `data-instance`. Parts SHALL accept element substitution
without changing behaviour. A rind-ui part (or any component) used as the trigger SHALL keep
its own `id`, `data-scope`, `data-part` and `data-state`: the tooltip SHALL locate it by
reference and add only `aria-describedby` (or `aria-labelledby` for `type: "label"`), merged
with any ids it already has, and its hover, focus and press handlers.

#### Scenario: A switch as the trigger

- **WHEN** a Switch control is rendered as the tooltip trigger, with its own label
- **THEN** it keeps its id, `data-scope="switch"` and its name from the label, and the
  tooltip opens on hover and on keyboard focus (regression: mui/base-ui#5305)

#### Scenario: A checkbox as the trigger

- **WHEN** a Checkbox control is rendered as the tooltip trigger, with its own label
- **THEN** it keeps its id, `data-scope="checkbox"` and its name, and the tooltip opens on
  hover and on keyboard focus

#### Scenario: Trigger rendered as an icon button component

- **WHEN** the trigger is substituted with a consumer's icon-button component
- **THEN** the rendered button carries the tooltip's `aria-describedby`, hover and
  focus handlers, and opens the tooltip on hover and keyboard focus

### Requirement: Open State And Reasons

The open state SHALL be a controllable value: `open`, `defaultOpen` (default
`false`), `onOpenChange(open, details)`. `details.reason` SHALL be one of `hover`,
`focus`, `api` when opening and `pointer-leave`, `blur`, `escape-key`,
`outside-press`, `trigger-press`, `group`, `disabled`, `api` when closing. A
`disabled` tooltip SHALL never open and SHALL close with `disabled` when it
becomes disabled while open.

#### Scenario: Escape reason

- **WHEN** an open tooltip is closed with Escape
- **THEN** `onOpenChange(false, details)` receives `details.reason ===
  "escape-key"`

#### Scenario: Becoming disabled

- **WHEN** an open tooltip's `disabled` prop becomes `true`
- **THEN** it closes with reason `"disabled"` and does not reopen on hover or focus

### Requirement: Opening On Hover

The tooltip SHALL open on hover through `hover-intent` with an open delay
(`openDelay`, default 700 ms) and through the document `delay-group` (skip delay
`skipDelay`, default 300 ms): when the group is warm it opens without the delay
and carries `data-instant`. Hover with a touch pointer SHALL never open it.

#### Scenario: First tooltip in a toolbar

- **WHEN** the pointer moves onto a toolbar button with a tooltip and stays
  700 ms
- **THEN** the tooltip opens with reason `"hover"` and without `data-instant`

#### Scenario: Leaving before the delay

- **WHEN** the pointer leaves the trigger 300 ms after entering it
- **THEN** the tooltip never opens

### Requirement: Opening On Keyboard Focus

The tooltip SHALL open immediately (no open delay) when its trigger receives focus
with the `keyboard` modality, including focus moved by rind-ui in response to a
key press (Tab wrapping in a modal layer, arrow keys in a roving composite). It
SHALL NOT open when the trigger receives focus with the `pointer`, `touch` or
`virtual` modality, when the window regains focus, or when focus is moved onto
the trigger by a layer's initial focus or focus restore.

#### Scenario: Tab onto the trigger

- **WHEN** the user tabs onto a tooltip trigger
- **THEN** the tooltip opens immediately with reason `"focus"`

#### Scenario: Popover initial focus

- **WHEN** a popover opens with the keyboard and its initial focus lands on a
  button that has a tooltip
- **THEN** the tooltip stays closed (regression: radix#2248, ark#2565)

#### Scenario: Focus restored after a menu closes

- **WHEN** a menu opened from a tooltip-bearing trigger closes with Escape and
  focus is restored to the trigger
- **THEN** the tooltip stays closed (regression: react-spectrum#1170,
  ariakit#750)

#### Scenario: Browser tab re-activated

- **WHEN** the user clicked a tooltip trigger, switched browser tabs and came back,
  and the trigger receives `focus` again
- **THEN** the tooltip stays closed (regression: radix#1800)

#### Scenario: Focus wrapped by a modal trap

- **WHEN** a dialog contains several tooltip triggers and the user presses Tab on
  the last one, wrapping focus to the first
- **THEN** the first trigger's tooltip opens (regression: ark#3378)

#### Scenario: Screen reader cursor

- **WHEN** a virtual focus (no preceding key or pointer event) lands on a tooltip
  trigger
- **THEN** the tooltip stays closed, and the trigger's accessible description
  still contains the tooltip text

### Requirement: Closing

An open tooltip SHALL close: when the pointer leaves the hover zone and the trigger
does not have keyboard focus, after `closeDelay` (default 300 ms), with reason
`pointer-leave`; immediately when the trigger loses focus and the pointer is not in
the hover zone (`blur`); on Escape (`escape-key`); on a press outside the trigger,
the content and descendant layers (`outside-press`); when another group member
opens (`group`). Pressing the trigger (pointer down, Enter or Space) SHALL close it
with `trigger-press` when `closeOnPress` is true (the default), and it SHALL NOT
reopen until the pointer leaves the trigger and enters again or the trigger
receives keyboard focus again. There SHALL be no timer that hides an open tooltip
on its own.

#### Scenario: Press closes and does not reopen

- **WHEN** a hovered tooltip trigger is clicked and the pointer stays on it
- **THEN** the tooltip closes with reason `"trigger-press"` and stays closed until
  the pointer leaves and re-enters

#### Scenario: Focus kept, pointer leaves

- **WHEN** a tooltip opened by keyboard focus is hovered and the pointer then
  leaves the hover zone
- **THEN** the tooltip stays open while the trigger keeps keyboard focus

#### Scenario: Persistent while hovered

- **WHEN** the pointer rests on an open tooltip's content for ten seconds
- **THEN** the tooltip is still open

### Requirement: Hoverable Content

The content SHALL always be part of the hover zone (WCAG 1.4.13 hoverable): the
pointer can move from the trigger onto the content, through the grace area, and
stay there without the tooltip closing. This SHALL NOT be configurable.

#### Scenario: Move onto the tooltip

- **WHEN** the pointer moves from the trigger across the 8 px gap onto the tooltip
  content
- **THEN** the tooltip stays open (regression: ariakit#887, zag#1506)

### Requirement: Description And Label Wiring

With `type: "description"` (the default) the content SHALL have `role="tooltip"`
and the trigger's `aria-describedby` SHALL include the content id whenever the
content element is mounted, open or closed, merged after any ids the consumer
passes. With `type: "label"` the content SHALL have no role and the trigger's
`aria-labelledby` SHALL point at the content id whenever it is mounted, with no
`aria-describedby` from the tooltip. The content SHALL therefore stay mounted
while closed, with the `hidden` attribute (after its exit animation), from the
first client commit on (a portalled content is not rendered on the server, and
the reference is added once it mounts, so no IDREF ever dangles).

#### Scenario: Browse-mode reading while closed

- **WHEN** a closed description tooltip "Delete permanently" belongs to a button
  named "Delete"
- **THEN** the button's accessible description is "Delete permanently" and the
  content element exists with `hidden` (regression: react-spectrum#2101)

#### Scenario: Consumer description kept

- **WHEN** the trigger already has `aria-describedby="hint"`
- **THEN** it becomes `aria-describedby="hint <content id>"` (regression:
  radix#2598)

#### Scenario: Icon-only button labelled by its tooltip

- **WHEN** an icon-only button has a tooltip with `type: "label"` and text "Bold"
- **THEN** the button's accessible name is "Bold" whether or not the tooltip is
  open, and the content has no `role`

#### Scenario: Label equals description

- **WHEN** a description tooltip's text equals its trigger's accessible name in
  development
- **THEN** a warning suggests `type: "label"`, and the generic "name differs from
  description" invariant fails (regression: radix#2988)

#### Scenario: Consumer label overridden

- **WHEN** a `type: "label"` tooltip's trigger also has `aria-label` in development
- **THEN** a warning says the `aria-label` is ignored by assistive technology

### Requirement: Not Focusable, Not Interactive

The content SHALL never receive focus and SHALL have no `tabindex`. In
development, a tooltip whose content contains a tabbable element SHALL log a
warning recommending Hover Card or Popover.

#### Scenario: Link inside a tooltip

- **WHEN** a tooltip's content contains a link in development
- **THEN** a warning names the tooltip and the link

### Requirement: Trigger Requirements

The trigger SHALL be focusable; rind-ui SHALL NOT add `tabindex` to make a
non-focusable element focusable, and a non-focusable rendered trigger SHALL log a
development warning. A trigger rendered with the native `disabled` attribute SHALL
log a development warning recommending `focusableWhenDisabled`. A trigger with
`aria-disabled="true"` SHALL open the tooltip on hover and keyboard focus like any
other. Disabled-ness SHALL be read from the rendered element.

#### Scenario: Explaining a disabled action

- **WHEN** a "Push" toolbar button rendered with `aria-disabled="true"` has a
  tooltip "Nothing to push"
- **THEN** the tooltip opens on hover and on keyboard focus (regression:
  mui/base-ui#4966, mui/base-ui#3075)

#### Scenario: Natively disabled trigger

- **WHEN** the rendered trigger element has the `disabled` attribute in development
- **THEN** a warning explains that it cannot be focused or hovered and suggests
  `focusableWhenDisabled` (regression: ariakit#471, react-spectrum#8539)

### Requirement: Touch

The tooltip SHALL never open from touch input — tap, long press, or the focus that
follows a tap — and a tap on the trigger SHALL activate the trigger normally.

#### Scenario: Tap on an icon button

- **WHEN** the user taps an icon button with a tooltip on a phone
- **THEN** the button's action runs and the tooltip stays closed (regression:
  ark#3572, mui/base-ui#559, reka-ui#1443 — by design)

### Requirement: Layer And Escape

While open or closing, the tooltip SHALL register a non-modal layer of kind
`tooltip`, a child of the layer that contains its trigger. Escape SHALL close the
tooltip first when it is the topmost layer, even when it was opened by hover and
focus is elsewhere inside a parent layer; one Escape SHALL produce one close.
The tooltip layer SHALL dismiss on Escape and on outside press only; focus
changes are handled by the `blur` rule, not by outside-focus dismissal.

#### Scenario: Hover tooltip inside a dialog

- **WHEN** a tooltip inside a dialog is open by hover while focus is on another
  element of the dialog, and the user presses Escape
- **THEN** the tooltip closes and the dialog stays open; a second Escape closes the
  dialog (regression: mui/base-ui#4022, ariakit#7622)

### Requirement: Inside Modal Layers

A tooltip whose trigger is inside a modal layer SHALL keep its content (open or
closed) out of every inert subtree while the trigger is exposed, and Tab from its
trigger SHALL move to the next tabbable element of the modal layer.

#### Scenario: Description inside a dialog

- **WHEN** a tooltip trigger is inside an open modal dialog
- **THEN** the tooltip content has no `inert` ancestor and the trigger's
  description is exposed in the accessibility tree (regression:
  react-spectrum#8915)

#### Scenario: Tab away from an open tooltip in a dialog

- **WHEN** a tooltip is open by keyboard focus on a button inside a dialog and the
  user presses Tab
- **THEN** focus moves to the next element of the dialog and the tooltip closes
  (regression: radix#3185)

### Requirement: Composition With Other Triggers

A tooltip trigger that is also the trigger of a popover, menu or dialog SHALL keep
that component's behaviour intact: the tooltip SHALL NOT prevent default or stop
propagation of any press, key or focus event, pressing the trigger SHALL close the
tooltip, and focus restored to the trigger by the other component SHALL NOT reopen
it.

#### Scenario: Menu button with a tooltip

- **WHEN** the user presses Enter on a menu button that has a tooltip, then closes
  the menu with Escape
- **THEN** the menu opened and received focus, the tooltip closed on the press, and
  it stays closed after focus returns (regression: bits-ui#2200, ariakit#3754)

### Requirement: Keyboard Interactions

| Key | Where | Behaviour |
|---|---|---|
| Tab / Shift+Tab | Onto the trigger | Opens immediately |
| Tab / Shift+Tab | Away from the trigger | Closes (`blur`) |
| Escape | While open and topmost | Closes; focus and pointer stay |
| Enter / Space | Trigger | The trigger's own action; closes the tooltip when `closeOnPress` |

The tooltip SHALL NOT consume Escape when it is closed, and SHALL ignore Escape
during IME composition.

#### Scenario: Escape while closed

- **WHEN** a tooltip is closed, its trigger is focused inside a popover, and the
  user presses Escape
- **THEN** the popover closes

### Requirement: Announcements

The tooltip SHALL make no announcement through the announcer; its text reaches
assistive technology through the trigger's description or name.

#### Scenario: Open and close

- **WHEN** a tooltip opens and closes with a recording announcer installed
- **THEN** no message was recorded

### Requirement: Positioning

The tooltip SHALL be positioned with the `popup` preset and side `top`,
`sideOffset` 8 and collision padding 8, against its trigger; consumer
`positioning` options SHALL override them. With default options the tooltip SHALL
NOT cover its trigger.

#### Scenario: Trigger at the top edge

- **WHEN** a trigger touches the top of the viewport and its tooltip opens
- **THEN** the tooltip flips below the trigger and carries `data-side="bottom"`

### Requirement: Visibility And Presence

When closed, the positioner and content SHALL keep `data-state="closed"` until
their exit animations finish and then carry `hidden`; they SHALL NOT be unmounted
while the root is mounted. Opening SHALL remove `hidden` and reuse the same
elements. A transition marked instant by the delay group SHALL carry
`data-instant` so the theme skips animation.

#### Scenario: Exit animation then hidden

- **WHEN** an open tooltip with a 150 ms fade-out closes
- **THEN** it keeps `data-state="closed"` without `hidden` for the animation and
  then gets `hidden`, and its element is the same when it reopens

### Requirement: Closed Tooltips Cost Nothing

A closed tooltip SHALL hold no layer, no document- or window-level listener, no
timer, no observer and no positioning; only the trigger's own handlers and the
group membership exist.

#### Scenario: Two hundred tooltips

- **WHEN** a page renders 200 closed tooltips
- **THEN** no positioning observer, document listener or timer exists for them, and
  hovering one tooltip re-renders only that instance (regression: radix#3858,
  bits-ui#1687)

### Requirement: Data Attributes

Connect SHALL produce, in addition to `data-scope`, `data-part` and
`data-instance`:

- `Trigger`: `data-state="open|closed"`, `data-hover`, `data-focus`,
  `data-focus-visible`.
- `Positioner`: `data-state`, `data-instant`, `data-side`, `data-align`,
  `data-placing`, `data-anchor-hidden`.
- `Content`: `data-state`, `data-instant`, `data-side`, `data-align`,
  `data-placing`, `data-type="description|label"`.
- `Arrow`: `data-side`, `data-uncentered`.

#### Scenario: Instant open

- **WHEN** a tooltip opens during the group's warm window
- **THEN** its content carries `data-state="open"` and `data-instant`

### Requirement: Contract

`tooltipContract` SHALL locate an instance by its trigger's role and exact
accessible name, and declare:

- actions `show` (pointer: hover the trigger and wait for the open delay;
  keyboard: move focus onto the trigger with Tab), `hide` (pointer: move the
  pointer away and wait for the close delay; keyboard: press Escape),
  `hoverContent`, `pressTrigger` and `pressEscape`, with postconditions on
  `data-state`;
- queries `isOpen`, `text`, `description` (the trigger's accessible description),
  `label` (the trigger's accessible name), `isInstant`, and the positioning
  fragment `side`, `align`, `isAnchorHidden`, `isPlaced`;
- traits `layer`, `anchored` and `timed` (the close delay never elapses while the
  trigger or content is hovered or the trigger has keyboard focus), and
  per-contract invariants: when closed the
  content is `hidden` and still referenced by the trigger; the content is never
  focused.

The `tooltip` driver SHALL be generated from it and run unchanged with Testing
Library (with fake timers advanced through the adapter) and Playwright.

#### Scenario: Driver with fake timers

- **WHEN** a jsdom test with fake timers runs `await getTooltip(screen, { name:
  "Bold" }).show()`
- **THEN** it resolves once the delay was advanced and the tooltip is open

#### Scenario: Touch replay

- **WHEN** `testMachine(tooltipContract, …)` replays `show` with a touch pointer
- **THEN** the tooltip stays closed and the "hover never from touch" invariant
  passes

#### Scenario: Virtual focus replay

- **WHEN** the runner adds a virtual focus step on the trigger
- **THEN** the tooltip stays closed and the "focus alone does not commit"
  invariant passes without any contract exception
