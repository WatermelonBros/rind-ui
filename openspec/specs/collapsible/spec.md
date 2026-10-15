# collapsible Specification

## Purpose
Defines rind-ui's Collapsible: one button that shows and hides one region of
content, following the WAI-ARIA APG Disclosure pattern. It covers keyboard, ARIA,
focus, hide modes, find-in-page, the size custom properties used for animation,
the styling attributes of each part, and the contract its driver is generated from.
## Requirements
### Requirement: Anatomy

Collapsible SHALL consist of these parts:

| Part | Default element |
|---|---|
| `Root` | `div` |
| `Trigger` | `button` with `type="button"` |
| `Content` | `div` |
| `Indicator` | `span` |

Every part SHALL carry `data-scope="collapsible"`, `data-part` (`root`,
`trigger`, `content`, `indicator`) and `data-instance`. Every part SHALL accept a
`render` substitute without changing its behaviour.

#### Scenario: Default markup

- **WHEN** a Collapsible with a trigger labelled "Details" is rendered
- **THEN** the trigger is a `<button type="button">` named "Details" carrying
  `data-scope="collapsible"` and `data-part="trigger"`

#### Scenario: Trigger rendered as a non-button

- **WHEN** the trigger is substituted with a `<span>` (regression: ark#3196,
  base-ui#3632)
- **THEN** the span has `role="button"` and `tabIndex=0`, and it toggles the
  content with a pointer, Enter, Space and a bare click

### Requirement: Disclosure Semantics

The trigger SHALL carry `aria-expanded="true"` while the machine's open value is
true and `aria-expanded="false"` otherwise. It SHALL take that value at the
moment of the transition, never later, and SHALL NOT keep it during an exit
animation. The trigger SHALL carry `aria-controls` with the content's id exactly
while the content element is rendered, whether visible or hidden, and SHALL NOT
carry it while the content is unmounted. The content SHALL have no role unless
the consumer gives it one. The Indicator SHALL carry `aria-hidden="true"`.

#### Scenario: Expanded state follows the value, not the animation

- **WHEN** an open collapsible is closed and its content plays a 300 ms exit
  animation
- **THEN** the trigger has `aria-expanded="false"` from the closing step on,
  while the content is still in the document

#### Scenario: aria-controls only for rendered content (radix#3242, headlessui#1741)

- **WHEN** a closed collapsible uses `closedContent="unmount"`
- **THEN** the trigger has no `aria-controls`, and when it opens `aria-controls`
  references the content's id

#### Scenario: Kept-mounted content is referenced

- **WHEN** a closed collapsible uses the default `closedContent="until-found"`
- **THEN** the trigger's `aria-controls` references the hidden content element

### Requirement: Keyboard And Activation

The trigger SHALL toggle the content on activation with press semantics: a
pointer press released over the trigger, Enter, or Space, with key repeats
ignored. A bare `click` from assistive technology SHALL toggle exactly once.
Collapsible SHALL handle no other key, and opening SHALL NOT move focus.

#### Scenario: Enter and Space

- **WHEN** the focused trigger of a closed collapsible receives Enter, and then
  Space
- **THEN** the content opens after Enter and closes after Space

#### Scenario: Screen reader activation toggles once (kobalte#119)

- **WHEN** a screen reader activates the trigger with a single bare `click`
  (`detail: 0`, no pointer or key events)
- **THEN** the content opens and stays open

#### Scenario: Held key

- **WHEN** Enter is held down on the trigger and auto-repeats
- **THEN** the content toggles once

### Requirement: Focus On Close

When the content closes while focus is inside it, focus SHALL move to the
trigger, keeping the current modality, before the content is hidden or removed.
Focus elsewhere SHALL NOT move.

#### Scenario: Close from inside

- **WHEN** focus is on a link inside open content and the consumer closes the
  collapsible
- **THEN** focus is on the trigger, never on `body`

#### Scenario: Focus outside is left alone

- **WHEN** focus is on an unrelated input and the collapsible closes
- **THEN** focus stays on the input

### Requirement: Disabled

A `disabled` collapsible SHALL ignore activation from every input. Its trigger
SHALL be natively `disabled`, or, with `focusableWhenDisabled`, SHALL carry
`aria-disabled="true"` and stay focusable. Disabling SHALL NOT change whether the
content is visible, and a controlled consumer SHALL still be able to open and
close it. A disabled closed collapsible SHALL hide its content with plain
`hidden` instead of `hidden="until-found"`, so find-in-page cannot open it.
Changes to `disabled` SHALL take effect on the next interaction.

#### Scenario: Disabling does not reveal (react-spectrum#9004)

- **WHEN** a closed collapsible's `disabled` prop changes from true to false
- **THEN** the content stays hidden

#### Scenario: Open and disabled (react-spectrum#7444)

- **WHEN** a collapsible is rendered with `defaultOpen` and `disabled`
- **THEN** the content is visible and the trigger ignores presses

#### Scenario: No find-in-page reveal while disabled

- **WHEN** a disabled closed collapsible is rendered with the default
  `closedContent`
- **THEN** its content has `hidden` but not `hidden="until-found"`

### Requirement: Closed Content Modes

`Root` SHALL accept `closedContent` with values `"until-found"` (default),
`"hidden"` and `"unmount"`. When closed and settled:

- `until-found` SHALL keep the content mounted with `hidden="until-found"` (in
  server-rendered HTML the boolean `hidden`, upgraded after hydration, per the
  hidden-content capability);
- `hidden` SHALL keep it mounted with `hidden`;
- `unmount` SHALL remove it from the document.

In every mode the closed content SHALL be hidden from assistive technology.
Content SHALL never carry `aria-hidden`. Closed, mounted content SHALL keep its
form controls in the document, so they take part in form submission.

#### Scenario: Forms in closed content submit (radix#2808)

- **WHEN** a form contains a closed collapsible with a named input, using the
  default mode, and is submitted
- **THEN** the input's value is part of the submitted form data

#### Scenario: Kept-mounted content is never visible while closed (radix#2546, radix#957)

- **WHEN** a collapsible with `closedContent="hidden"` and a CSS height
  animation starts closed, and is then opened and closed
- **THEN** the content has `hidden` whenever the collapsible is closed and its
  exit animation has finished

#### Scenario: No aria-hidden on hidden content (react-spectrum#10552)

- **WHEN** a closed collapsible renders its content with `hidden="until-found"`
- **THEN** the content has no `aria-hidden` attribute

#### Scenario: Closed content readable in server HTML (base-ui#5821, kobalte#528)

- **WHEN** a closed collapsible is rendered on the server with the default mode
- **THEN** the HTML contains the content's text (it is not unmounted), inside an element
  carrying `hidden` (React serialises the boolean form, per the hidden-content
  capability), and after hydration the attribute is `hidden="until-found"`

#### Scenario: Unmounted after exit

- **WHEN** a collapsible with `closedContent="unmount"` closes with an exit
  animation
- **THEN** the content stays in the document with `data-state="closed"` until
  the animation finishes, and is then removed

#### Scenario: Externally controlled close with no animation (base-ui#4553)

- **WHEN** a controlled collapsible with `closedContent="hidden"` and no
  animation is closed by the parent setting `open` to false
- **THEN** the content has `hidden` after that update

### Requirement: Find-In-Page Reveal

When the browser fires `beforematch` on closed content, the machine SHALL
receive `OPEN` with `reason: "find-in-page"`. It SHALL open the content, never
toggle it. The reveal SHALL be immediate: the content SHALL reach its open size
in the same task as the `beforematch` event, skipping the open animation, and
SHALL carry `data-reveal="find-in-page"` until its next transition. A controlled
consumer that refuses the change SHALL get `hidden="until-found"` back. In
development, closed `until-found` content whose computed `display` is `none`
SHALL produce a warning that names the content part, because a stylesheet then
prevents find-in-page.

#### Scenario: Search opens the content and highlights the match (base-ui#5513)

- **WHEN** the user searches the page for text that exists only inside a closed
  collapsible whose theme animates height with a transition
- **THEN** the collapsible opens, `onOpenChange` is called with
  `details.event.reason === "find-in-page"`, and the content is at its full size
  before the browser highlights the match

#### Scenario: Reveal opens, never toggles

- **WHEN** `beforematch` fires on content whose collapsible is already open
- **THEN** the collapsible stays open

#### Scenario: CSS reset hides the content (react-spectrum#7160)

- **WHEN** a stylesheet applies `[hidden] { display: none }` and a collapsible
  is closed in `until-found` mode in development
- **THEN** a warning names the collapsible content and the cause

### Requirement: Size Custom Properties

`Content` SHALL always carry the custom properties
`--rind-collapsible-content-height` and `--rind-collapsible-content-width`,
including when their value is zero. Their values SHALL be:

- `0px` while closed;
- on opening, the content's natural size in px, measured after the opened
  content is committed;
- `auto` once the content's enter animations have finished;
- on closing, the current size in px, followed after a style flush by `0px`.

The shared content-size module SHALL also expose a switch entry point `switched()` for a
viewport shared by several panels (add-navigation-menu): it SHALL write the size
currently rendered (the px value, or the computed size if `auto`), measure the new
natural size of the already committed incoming content, flush, write the new px values
and write `auto` on `settled()`. A second `switched()` before `settled()` SHALL start
from the size currently rendered (mui/base-ui#4619). `opened`, `closed` and `settled`
SHALL be unchanged.

Measurement SHALL use the content's scroll size with its own alignment
properties neutralised, so flex and grid content measure their natural size. An
initially open collapsible SHALL start at `auto`, with no measurement and no
animation. A find-in-page reveal SHALL go straight to `auto`.

#### Scenario: Zero-size content defines its own variables (radix#3037)

- **WHEN** an open collapsible with empty content is nested inside another open
  collapsible
- **THEN** the inner content's `--rind-collapsible-content-height` is `auto`
  (or `0px` while closed), never inherited from the outer content

#### Scenario: Content grows after opening (base-ui#1458)

- **WHEN** an open, settled collapsible's content gains a new line of text
- **THEN** the content is not clipped, because the height variable is `auto`

#### Scenario: Flex and grid content (radix#2832, base-ui#2767)

- **WHEN** content styled `display: flex` or `display: grid` with
  `justify-content: center` opens with a height transition
- **THEN** the measured height equals the content's natural height and the
  animation runs once

#### Scenario: First open animates in every engine (radix#1265)

- **WHEN** a collapsible in `unmount` mode opens for the first time in
  Chromium, Firefox and WebKit
- **THEN** its height variable goes from `0px` to the measured px value, so a
  height transition runs in each engine

#### Scenario: Initially open content does not animate or shift (zag#1396, radix#2891)

- **WHEN** a collapsible renders with `defaultOpen`, on the server or the client
- **THEN** the height variable is `auto` from the first paint, no transition
  runs, and the layout does not shift on hydration

#### Scenario: Switching panels animates between their sizes (mui/base-ui#4619)

- **WHEN** a shared viewport showing a settled 200px-tall panel switches to a 320px-tall
  panel, and switches again to a 120px-tall panel while the first change is still
  animating
- **THEN** the height variable goes from `200px` to `320px` without passing through
  `0px`, the second switch starts from the height rendered at that moment and ends at
  `120px`, and the variable is `auto` once settled

### Requirement: Mount And Re-Insertion Do Not Replay

The open animation SHALL run only on a transition from closed to open. Content
that is mounted open, re-inserted into the document (list reorders), or revealed
again by a framework's hidden-subtree mechanism (React `<Activity>`) SHALL NOT
replay the opening animation when the theme animates with transitions on the
size variables. The content SHALL keep `data-state` in every state, and SHALL
carry `data-reveal="mount"` from its first render until its first transition,
so keyframe-based styles can skip the mount.

#### Scenario: Reordering a list (zag#2138, reka-ui#920)

- **WHEN** open collapsibles that were closed and reopened once are reordered in
  a list
- **THEN** no opening transition runs on any of them

#### Scenario: Activity hide and show (radix#3778)

- **WHEN** an open collapsible inside React `<Activity>` is hidden and shown
  again
- **THEN** no opening transition runs and `data-state` stays `open`

#### Scenario: data-state is never dropped (ark#3716, ark#3432)

- **WHEN** a collapsible renders initially open
- **THEN** its content carries `data-state="open"` and `data-reveal="mount"`,
  and after the first close only `data-state="closed"`

### Requirement: Exit Presence

Closing SHALL NOT wait for the exit animation: `aria-expanded`, `data-state` and
focus reflect "closed" in the closing step. The content element SHALL stay in
the document, or stay without `hidden`, until its own finite animations finish,
and SHALL then be hidden or removed according to `closedContent`, without
painting a frame at its resting style. Re-opening during the exit SHALL keep the
same element. With no running animation (reduced motion, jsdom), the content
SHALL be hidden or removed in the closing step.

#### Scenario: Exit animation is not skipped (base-ui#3099)

- **WHEN** content with a height transition closes in the same step as another
  disclosure opens
- **THEN** the content keeps its exit transition until it ends

#### Scenario: No flicker on close (radix#1074)

- **WHEN** content fades out to opacity 0 and the animation ends
- **THEN** no frame is painted with the content at its resting opacity before it
  is hidden

#### Scenario: Reduced motion

- **WHEN** the user prefers reduced motion and the theme is loaded
- **THEN** opening and closing complete with no running transition

### Requirement: Open State

`Root` SHALL expose the open state as a controllable value: `open`,
`defaultOpen` (default false) and `onOpenChange(open, details)`. Every
user-caused change SHALL be reported during the step that caused it, with
`details.event` being a `TOGGLE` (with its modality), or an `OPEN` / `CLOSE`
with a `reason` of `"api"` or `"find-in-page"`. A controlled parent that refuses
a change SHALL leave the content as it was. A parent changing `open` SHALL NOT
call `onOpenChange`.

#### Scenario: Uncontrolled toggle

- **WHEN** an uncontrolled collapsible's trigger is pressed
- **THEN** it opens and `onOpenChange(true, details)` is called with
  `details.event.type === "TOGGLE"`

#### Scenario: Controlled refusal

- **WHEN** a controlled closed collapsible's trigger is pressed and the parent
  does not change `open`
- **THEN** the content stays closed and hidden

#### Scenario: Parent-driven change (bits-ui#2169)

- **WHEN** the parent sets `open` from false to true
- **THEN** the content opens and `onOpenChange` is not called

### Requirement: Styling Attributes

Parts SHALL expose:

| Part | Attributes |
|---|---|
| `Root` | `data-state` (`open`/`closed`), `data-disabled` |
| `Trigger` | `data-state`, `data-disabled`, `data-focus`, `data-focus-visible`, `data-pressed`, `data-hover` |
| `Content` | `data-state`, `data-disabled`, `data-reveal` (`mount` or `find-in-page`, until the next transition), the size custom properties |
| `Indicator` | `data-state`, `data-disabled` |

`data-state="closed"` on mounted content SHALL be the exit-animation hook, and
`data-state` SHALL be present on every part in every state.

#### Scenario: Attributes agree with ARIA

- **WHEN** a collapsible is open and disabled
- **THEN** every part has `data-state="open"` and `data-disabled`, and the
  trigger has `aria-expanded="true"`

### Requirement: Contract

Collapsible SHALL ship a contract with scope `collapsible` and anatomy `root`,
`trigger`, `content` and `indicator`. It SHALL locate an instance by its
trigger's role `button` and exact accessible name. It SHALL declare:

- actions `open`, `close` and `toggle`, each with a pointer implementation (a
  click on the trigger) and a keyboard implementation (Enter on the trigger),
  and postconditions on the open state;
- queries `isOpen` (from `aria-expanded`), `isDisabled`, `contentText`, and
  `hiddenMode` (`"visible"`, `"until-found"`, `"hidden"` or `"unmounted"`);
- traits `disclosure` and `presence`;
- the `OPEN` event with `reason: "find-in-page"` as explicitly not driven
  through the environment, with that reason.

It SHALL ship per-contract invariants: content never carries `aria-hidden`;
`aria-controls` is present exactly while the content is in the document; and
both size custom properties are defined on rendered content.

#### Scenario: Driver in both environments

- **WHEN** a test calls `getCollapsible(screen, { name: "Details" }).open()` and
  then `isOpen()`, and the same test runs with a Playwright `page`
- **THEN** both resolve `true` once the content is open

#### Scenario: Keyboard twin

- **WHEN** a test runs `getCollapsible(screen, { name: "Details" }).via("keyboard").toggle()`
- **THEN** the trigger receives Enter and the open state flips

#### Scenario: Model-based test of a consumer wrapper

- **WHEN** a consumer runs `testMachine` with the collapsible contract on a
  wrapper that adds `aria-hidden` to the content
- **THEN** the per-contract invariant fails naming the content part

