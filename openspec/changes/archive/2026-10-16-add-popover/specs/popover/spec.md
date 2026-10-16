## Purpose

Defines the Popover component: a trigger that opens an anchored, positioned panel
with arbitrary content, non-modal by default and modal on request, built on the
overlay infrastructure and floating positioning, with its parts, ARIA, `data-*`
attributes, keyboard behaviour and test contract.

## ADDED Requirements

### Requirement: Anatomy

A popover SHALL consist of the parts `Root` (no element), `Trigger` (default
`button`), `Anchor` (optional, default `div`), `Indicator` (optional, default
`span`), `Positioner` (default `div`), `Content` (default `div`), `Arrow`
(optional, default `div`), `Title` (optional, default `h2`), `Description`
(optional, default `p`) and `CloseTrigger` (optional, default `button`), and MAY
render `Positioner` and its descendants inside the shared `Portal` part. Every
rendered part SHALL carry `data-scope="popover"`, `data-part` with its kebab-case
part name and the instance's `data-instance`, whether portalled or not. A composite
component built on the Popover MAY pass a `scope` option to `popover` connect, and connect
SHALL then use it as `data-scope` for the trigger, anchor, indicator, positioner, content and
arrow props it produces (default `"popover"`); `data-part` and `data-instance` are unchanged.
Each part SHALL accept element substitution without changing behaviour.

#### Scenario: Portalled parts stay attributed

- **WHEN** a popover renders its content in a portal at the end of `body`
- **THEN** the positioner, content and arrow carry `data-scope="popover"`, their
  `data-part` and the same `data-instance` as the trigger

#### Scenario: Composite re-scopes the data attributes

- **WHEN** a composite connects a popover with `scope: "date-picker"`
- **THEN** its trigger, positioner and content props carry `data-scope="date-picker"` with the
  unchanged `data-part` and `data-instance`

#### Scenario: Trigger rendered as another element

- **WHEN** the trigger is rendered as a `div` through element substitution
- **THEN** it gets `role="button"` and `tabindex="0"`, and Enter, Space and a bare
  `click` toggle the popover exactly as with the default `button`

### Requirement: Open State

The open state SHALL be a controllable value: `open`, `defaultOpen` (default
`false`) and `onOpenChange(open, details)`, where `details.reason` is `"trigger"`
when opening and the close reason when closing. In controlled mode an open or close
request SHALL only call `onOpenChange`; the popover changes state when the `open`
prop changes. Calling `details.cancel()` SHALL keep the current state.
`open` MAY be controlled by a parent coordinator (a composite that owns the popover's state
together with other services, such as Date Picker); the popover SHALL behave exactly as in any
controlled use, with every request reported once through `onOpenChange` and no state of its own
that disagrees with `open`.

#### Scenario: Uncontrolled toggle

- **WHEN** an uncontrolled popover's trigger is pressed twice
- **THEN** it opens, then closes, and `onOpenChange` was called with `true` and
  reason `"trigger"`, then with `false` and reason `"trigger"`

#### Scenario: Controlled refusal

- **WHEN** a controlled popover with `open={false}` has its trigger pressed and the
  parent does not change `open`
- **THEN** `onOpenChange(true, …)` was called and the content is not rendered

#### Scenario: Coordinator owns the state

- **WHEN** a composite passes `open` and an `onOpenChange` that opens only after its own
  service agrees, and an outside press requests a close
- **THEN** `onOpenChange(false, { reason: "outside-press" })` is called once and the content
  stays until the composite changes `open`

#### Scenario: Open at mount

- **WHEN** a popover is rendered with `defaultOpen` and then closed with Escape
- **THEN** focus moves to its trigger, not to `body` (regression: react-spectrum#10661)

### Requirement: Close Reasons

Every close SHALL carry exactly one reason from: `trigger`, `close-trigger`,
`escape-key`, `outside-press`, `outside-focus`, `parent-dismissed`, `api`. The
reason SHALL be passed to `onOpenChange` and exposed on the content as
`data-close-reason` until the next open.

#### Scenario: Close trigger

- **WHEN** the user presses the `CloseTrigger`
- **THEN** `onOpenChange(false, details)` receives `details.reason ===
  "close-trigger"` and the exiting content carries `data-close-reason="close-trigger"`

#### Scenario: Parent closes

- **WHEN** a popover inside a dialog is open and the dialog closes
  programmatically
- **THEN** the popover closes first with reason `"parent-dismissed"`

### Requirement: Trigger Toggles Once Per Press

Pressing the trigger (pointer, Enter, Space, or a bare `click` from assistive
technology) SHALL open a closed popover and close an open one, exactly once per
press. The trigger and the anchor SHALL count as inside the popover for
dismissal, so pressing the trigger of an open popover never produces an
outside-press close followed by a re-open. Another popover's trigger SHALL count
as outside.

#### Scenario: Pressing the trigger of an open popover

- **WHEN** a popover is open and the user clicks its trigger
- **THEN** it closes with reason `"trigger"` and does not re-open (regression:
  headlessui#2713, mui/base-ui#4466, radix#3682)

#### Scenario: Opening a sibling popover

- **WHEN** popover A is open and the user clicks the trigger of an unrelated
  popover B
- **THEN** A closes with reason `"outside-press"`, B opens, and B stays open
  (regression: zag#2241, ark#3287, bits-ui#1016)

#### Scenario: Screen reader activation

- **WHEN** a screen reader activates the trigger with a bare `click` (`detail: 0`,
  no pointer or key events)
- **THEN** the popover opens once and focus moves into the content as for a
  keyboard open

### Requirement: Dismissal

An open popover SHALL register a non-modal (or, with `modal`, modal) layer of
kind `popover` and SHALL close when the layer receives a dismiss request:
Escape (`closeOnEscape`, default `true`), a press outside
(`closeOnInteractOutside`, default `true`) or focus moving outside (non-modal
only). The consumer callbacks `onEscapeKeyDown(event)` and
`onInteractOutside(event)` SHALL be able to veto with `event.preventDefault()`.
Elements returned by `persistentElements` SHALL count as inside. One user gesture
SHALL produce at most one close request.

#### Scenario: Escape

- **WHEN** focus is inside an open popover and the user presses Escape
- **THEN** it closes with reason `"escape-key"`

#### Scenario: Veto outside press

- **WHEN** `onInteractOutside` calls `preventDefault()` and the user clicks the page
- **THEN** the popover stays open

#### Scenario: Outside click on a focusable element

- **WHEN** a controlled popover is open and the user clicks a button outside it
- **THEN** `onOpenChange` is called exactly once, with reason `"outside-press"`
  (regression: ark#3492)

#### Scenario: Persistent element

- **WHEN** a toast is listed in `persistentElements` and the user clicks it while
  the popover is open
- **THEN** the popover stays open

### Requirement: Nesting

A popover opened from inside another layer (popover, dialog, menu) SHALL be that
layer's child through the adapter's layer context, whatever the DOM position of
its content; a layer opened from outside the popover SHALL NOT be its child.
Escape SHALL close only the topmost layer, a press inside a child layer SHALL NOT
dismiss the popover, and an outside press SHALL close every open layer that does
not contain the target, down to the first one that does.

#### Scenario: Dialog opened after an unrelated popover

- **WHEN** a non-modal popover with `closeOnInteractOutside` false is open and a
  keyboard shortcut opens an unrelated modal dialog, moving focus into it
- **THEN** the dialog is a root layer, not a child of the popover: the popover
  closes with reason `"outside-focus"` and the dialog stays open (regression:
  ark#2610)

#### Scenario: Dialog opened from a popover

- **WHEN** dialog 1 contains popover 1, which contains a button that opens dialog
  2, and the user closes dialog 2 with its close button
- **THEN** only dialog 2 closes; popover 1 and dialog 1 stay open and focus is on
  the button in popover 1 (regression: zag#2933)

#### Scenario: Nested popovers and an outside press

- **WHEN** popover 2 is open inside popover 1 and the user clicks the page outside
  both
- **THEN** both close; pressing Escape instead closes only popover 2
  (regression: headlessui#3332)

#### Scenario: Select inside a popover

- **WHEN** a select opened from inside a popover renders its listbox in a portal
  and the user picks an option
- **THEN** the option is selected and the popover stays open

### Requirement: Non-Modal Mode

With `modal` false (the default), the popover SHALL NOT make anything inert, SHALL
NOT lock scroll and SHALL NOT wrap Tab; its content SHALL follow the
`non-modal-tab-order` capability. Moving focus between elements of the content,
or into its descendant layers, SHALL NOT dismiss it. The popover SHALL NOT close
because the page or an ancestor of the trigger scrolls.

#### Scenario: Tabbing inside the content

- **WHEN** a non-modal popover contains three inputs and the user tabs from the
  first to the third
- **THEN** the popover stays open (regression: headlessui#3231)

#### Scenario: Tab leaves the popover

- **WHEN** focus is on the last tabbable element of a non-modal popover and the
  user presses Tab
- **THEN** focus moves to the element after the trigger and the popover closes with
  reason `"outside-focus"` (regression: radix#4128)

#### Scenario: Scroll does not close

- **WHEN** the page scrolls (by wheel, or because the browser scrolls a focused
  input into view above the on-screen keyboard) while a non-modal popover is open
- **THEN** the popover stays open and attached to its trigger (regression:
  react-spectrum#9467)

### Requirement: Modal Mode

With `modal` true, the popover's layer SHALL be modal: everything outside it and
its descendant layers is inert, page scroll is locked, Tab and Shift+Tab wrap
inside the content, and the content carries `aria-modal="true"` and `data-modal`.
In development, a modal popover that renders no `CloseTrigger` SHALL log a warning
that touch screen-reader users have no Escape key.

#### Scenario: Outside is inert

- **WHEN** a modal popover is open
- **THEN** the application root is inert, the popover content is not, and the
  page does not scroll with the wheel

#### Scenario: Tab wraps

- **WHEN** focus is on the last tabbable element of a modal popover and the user
  presses Tab
- **THEN** focus moves to the first tabbable element of the content

#### Scenario: Modal without a close trigger

- **WHEN** a modal popover without a `CloseTrigger` opens in development
- **THEN** a warning names the popover and the missing part

#### Scenario: Nested modal popovers opened together

- **WHEN** a modal popover and a modal popover nested in it open in the same
  render
- **THEN** the inner one is the topmost modal: it is not inert, everything else (the page and
  the outer popover, as beneath any nested modal) is, and focus is inside the inner one
  (regression: react-spectrum#10662)

### Requirement: Initial Focus

When the popover opens, focus SHALL move into the content after its first
placement is written (never before, so the page does not scroll), choosing: the
consumer's `initialFocus` (where `false` means do not move and `null` means
default); an element marked `data-autofocus`; the first tabbable element; the
content itself (`tabindex="-1"`). When opened by touch the default SHALL be the
content. A content element focused this way SHALL count as inside the popover.

#### Scenario: Keyboard open

- **WHEN** the trigger is activated with Enter and the content's first tabbable
  element is an input
- **THEN** the input is focused after the content is placed, and neither the page
  nor any scroll container changed its scroll position (regression:
  mui/base-ui#4520, mui/base-ui#3259)

#### Scenario: No tabbable content

- **WHEN** a popover whose content is only text (or a loading state) opens
- **THEN** the content element is focused and the popover stays open
  (regression: reka-ui#2803)

#### Scenario: Skip initial focus

- **WHEN** `initialFocus` returns `false`
- **THEN** focus stays on the trigger

### Requirement: Focus Restore

When the popover closes — whatever the reason, including controlled and
programmatic closes — focus SHALL return to the trigger (or the consumer's
`finalFocus`) if focus was inside the popover or on `body`, after the overlay
infrastructure removed any inertness, keeping the interaction modality. When
focus is already elsewhere (the user clicked another focusable element), it SHALL
stay there.

#### Scenario: Controlled close

- **WHEN** a controlled popover opened with the keyboard is closed by the parent
  setting `open={false}` while focus is inside it
- **THEN** the trigger is focused and has `data-focus-visible` (regression:
  zag#1747, zag#1788)

#### Scenario: Close trigger

- **WHEN** the user presses the `CloseTrigger`
- **THEN** the trigger is focused (regression: zag#1746)

#### Scenario: Outside click on a text field

- **WHEN** a non-modal popover is open and the user clicks a text field on the page
- **THEN** the popover closes and the text field keeps focus (regression:
  radix#2942)

#### Scenario: Mouse close leaves no focus ring

- **WHEN** a popover opened by mouse closes by an outside click on non-focusable
  page content
- **THEN** the trigger has `data-focus` and no `data-focus-visible`
  (regression: bits-ui#1213, headlessui#1694)

### Requirement: Accessible Name And Description

The content SHALL have `role="dialog"` and an accessible name taken, in order,
from: the `Title` part while it is rendered (`aria-labelledby`); the consumer's
`aria-label` or `aria-labelledby`; for a non-modal popover only, the trigger
(`aria-labelledby` → trigger id). The `Description` part SHALL be referenced by
`aria-describedby` only while rendered, merged with consumer ids. Which parts are
rendered SHALL be re-evaluated on every open. A modal popover with none of the
first two name sources SHALL report a development error.

#### Scenario: Title rendered lazily

- **WHEN** a popover whose content (with a `Title`) mounts only when opened is
  opened twice
- **THEN** each time the content has `aria-labelledby` pointing at the rendered
  title (regression: ark#4182)

#### Scenario: Non-modal without a title

- **WHEN** a non-modal popover without `Title` or `aria-label` is opened from a
  trigger named "Filters"
- **THEN** the dialog's accessible name is "Filters"

#### Scenario: Modal without a name

- **WHEN** a modal popover has no `Title`, `aria-label` or `aria-labelledby`
- **THEN** a development error is reported and the generic "accessible name"
  invariant fails

### Requirement: ARIA Attributes

The trigger SHALL carry `aria-haspopup="dialog"`, `aria-expanded` equal to the
open state, and `aria-controls` pointing at the content only while the content is
mounted. The content SHALL carry `role="dialog"`, `tabindex="-1"` and, when modal,
`aria-modal="true"`. `Indicator` and `Arrow` SHALL be `aria-hidden="true"`.

#### Scenario: Closed popover

- **WHEN** the popover is closed and its content is not mounted
- **THEN** the trigger has `aria-expanded="false"` and no `aria-controls`
  (regression: reka-ui#2597)

#### Scenario: Open popover

- **WHEN** the popover is open
- **THEN** the trigger has `aria-expanded="true"` and `aria-controls` equal to the
  content's id

### Requirement: Keyboard Interactions

The popover SHALL support:

| Key | Where | Behaviour |
|---|---|---|
| Enter, Space | Trigger | Toggle |
| Escape | Anywhere while it is the topmost layer | Close, restore focus |
| Tab | Trigger of an open non-modal popover | First tabbable element of the content |
| Tab | Last tabbable element, non-modal | Element after the trigger; close |
| Shift+Tab | First tabbable element, non-modal | Trigger |
| Tab, Shift+Tab | Edges of a modal popover | Wrap inside the content |

Escape pressed during an IME composition, or already handled by an element
inside the content (`preventDefault()`), SHALL NOT close the popover.

#### Scenario: Escape with focus on body

- **WHEN** the focused element inside the popover was removed and focus is on
  `body`, and the user presses Escape
- **THEN** the popover closes

#### Scenario: Escape in a search field

- **WHEN** a search field inside the popover clears itself on Escape and calls
  `preventDefault()`
- **THEN** the popover stays open

### Requirement: Announcements

The popover SHALL make no announcement through the announcer; opening is conveyed
by focus moving into the named dialog, closing by focus returning to the trigger.

#### Scenario: Open and close

- **WHEN** a popover is opened and closed with the keyboard while a recording
  announcer is installed
- **THEN** the announcer recorded no message

### Requirement: Positioning

The popover SHALL be positioned through the floating-positioning capability with
the `popup` preset (side `bottom`, align `center`), `sideOffset` 8 and collision
padding 8, against the `Anchor` part when rendered, otherwise the trigger;
consumer `positioning` options SHALL override the defaults. Positioning SHALL run
only while open. The popover SHALL expose an imperative `reposition()` (on the adapter's
actions handle) that recomputes the position; it is DOM-tested and has no contract action,
since the contract environment has no scroll or resize primitive.

#### Scenario: Custom anchor

- **WHEN** a popover renders an `Anchor` around a text field and its trigger is an
  icon inside it
- **THEN** the content is placed against the anchor's box

#### Scenario: Flip near the bottom

- **WHEN** the trigger is near the bottom of the viewport and there is no room below
- **THEN** the content opens above and carries `data-side="top"`

### Requirement: Presence

The positioner, content and arrow SHALL use the shared presence: when the popover
closes they keep `data-state="closed"` until their exit animations finish and are
then unmounted; re-opening during the exit reuses the same elements. Closing SHALL
NOT wait for presence. With `keepMounted`, closed content SHALL be `hidden`,
register no layer and lock nothing.

#### Scenario: Exit animation

- **WHEN** the content has a 200 ms fade-out and the popover closes
- **THEN** the trigger reports `aria-expanded="false"` and focus is restored at
  once, and the content is removed after the animation

### Requirement: Title Heading Level

The `title` part SHALL render `h{level}`, with `level` = the Title's `level` prop ?? 2,
so it stays `h2` by default; its heading attributes SHALL come from add-heading's shared
`headingProps` helper, so a title substituted through `render` with a non-heading
element gets `role="heading"` and `aria-level`. The `content` part SHALL wrap its
children in a `Heading.Level` set to the title's level + 1 (3 by default), so a
`Heading` inside the popover renders one level below the title without a `level` prop.

#### Scenario: Title defaults to h2

- **WHEN** a popover renders a title with no `level` prop
- **THEN** the title is an `h2` with `data-level="2"`

#### Scenario: Heading inside content is one level deeper

- **WHEN** a popover renders a title with `level={3}` and a `Heading` with no `level`
  inside its content
- **THEN** the inner heading is an `h4`

#### Scenario: Substituted title keeps its level

- **WHEN** the title is rendered with `render={<div />}`
- **THEN** the element has `role="heading"` and `aria-level="2"`

### Requirement: Data Attributes

Connect SHALL produce, in addition to `data-scope`, `data-part` and
`data-instance`:

- `Trigger`: `data-state="open|closed"`, `data-pressed`, `data-focus`,
  `data-focus-visible`, `data-disabled` when disabled.
- `Indicator`: `data-state`.
- `Positioner`: `data-state`, `data-side`, `data-align`, `data-placing`,
  `data-anchor-hidden`.
- `Content`: `data-state`, `data-side`, `data-align`, `data-placing`,
  `data-anchor-hidden`, `data-modal` (modal only), `data-nested` (parent layer is
  a popover), `data-has-nested` (an open child popover), `data-close-reason`, and
  the CSS variables `--layer-index` and `--nested-layer-count`.
- `Arrow`: `data-side`, `data-uncentered`.
- `CloseTrigger`: `data-pressed`, `data-focus`, `data-focus-visible`.

#### Scenario: Styling hooks while open

- **WHEN** a non-modal popover is open and placed below its trigger
- **THEN** the content has `data-state="open"`, `data-side="bottom"`, no
  `data-placing` and no `data-modal`

### Requirement: Messages

Strings the popover exposes to assistive technology SHALL come from its
`messages`: the `CloseTrigger`'s default accessible name (`close`, "Close"),
used only when the close trigger has no content or label of its own.

#### Scenario: Icon-only close trigger in Italian

- **WHEN** an icon-only `CloseTrigger` renders with `messages={{ close: "Chiudi" }}`
- **THEN** its accessible name is "Chiudi"

### Requirement: Disabled

A `disabled` popover SHALL not open from its trigger; an open popover that becomes
disabled SHALL close with reason `"api"`.

#### Scenario: Disabled trigger press

- **WHEN** a disabled popover's trigger is pressed
- **THEN** the popover stays closed and `onOpenChange` is not called

### Requirement: Contract

`popoverContract` SHALL locate an instance by its trigger's role (`button`) and
exact accessible name, resolve the other parts through `data-scope`, `data-part`
and `data-instance`, and declare:

- actions `open`, `close` (press the trigger while open), `toggle`,
  `closeWithButton` (press `CloseTrigger`), `pressEscape`, `pressOutside`, `tab`,
  `shiftTab` and `waitForUnmount`, each with pointer and keyboard
  implementations or a stated reason, and postconditions (`open`: content placed
  and focus inside unless initial focus is skipped; close actions: trigger
  `aria-expanded="false"`);
- queries `isOpen`, `isModal`, `title`, `description`, `hasFocus`, `isTopmost`,
  `closeReason`, and the positioning fragment `side`, `align`, `isAnchorHidden`,
  `isPlaced`;
- traits `layer`, `restores-focus`, `presence` and `anchored`, plus `modal` when
  the `modal` prop is true.

The `popover` driver in `@rind-ui/testing` SHALL be generated from it and run
unchanged with Testing Library and Playwright.

#### Scenario: Driver in both environments

- **WHEN** a test runs `const p = getPopover(screen, { name: "Filters" }); await
  p.open(); await p.pressEscape()` and the same test runs with `page`
- **THEN** both pass, and `await p.isOpen()` is `false` and focus is on the trigger
  at the end

#### Scenario: Keyboard twin

- **WHEN** `getPopover(screen, { name: "Filters" }).via("keyboard").open()` runs
- **THEN** the trigger is focused and activated with Enter, and focus ends inside
  the content

#### Scenario: Model-based run

- **WHEN** `testMachine(popoverContract, …)` runs with `modal` true and false in
  the browser project
- **THEN** every transition passes in the pointer, keyboard and virtual
  modalities, with the `layer`, `restores-focus`, `presence`, `anchored` and (for
  modal) `modal` invariants
