## Purpose

Defines rind-ui's Alert: an inline, non-modal message in the page layout that never
takes focus and is never a live region of its own, announced through the injected
Announcer only when it appears or changes after the page has loaded, with a dismissal
that keeps focus. Research: `docs/research/alert.md`.

## ADDED Requirements

### Requirement: Anatomy

An Alert SHALL consist of `Root` (a `div`), and the optional parts `Icon` (a `span`),
`Title` (a `div`), `Description` (a `div`) and `CloseTrigger` (a `button`). Every part
SHALL accept the props of the element it renders and the `render` prop. Content
without Title or Description (plain children of Root) SHALL be allowed.

#### Scenario: Minimal alert

- **WHEN** `<Alert.Root><Alert.Title>Saved</Alert.Title></Alert.Root>` is rendered
- **THEN** a `div` containing the title text is rendered and no element of the alert
  has a `role` attribute

#### Scenario: Title as a heading

- **WHEN** an alert's Title is rendered with `render={<Heading />}` inside a
  `Heading.Level` whose level is 3
- **THEN** the title is exposed as a heading of level 3 and the alert behaves the same

### Requirement: No Live Region Of Its Own

No part of the Alert SHALL carry `role="alert"`, `role="status"`, `role="log"`,
`aria-live`, `aria-atomic`, `aria-relevant` or `aria-busy`. Announcements SHALL go only
through the injected Announcer. The contract SHALL NOT declare the `live-region` trait.
A consumer live role or attribute on Root SHALL be forwarded and SHALL cause a
development warning naming the `announce` prop.

#### Scenario: Rendered output

- **WHEN** an alert with `announce="assertive"` is rendered and shown
- **THEN** no element of the alert has a live-region role or attribute, and the
  message reaches the Announcer's regions instead

#### Scenario: Consumer adds role="alert"

- **WHEN** a consumer wrapper renders `<Alert.Root role="alert">` and runs `testMachine`
- **THEN** a development warning is logged and the "no `aria-live` of its own" invariant
  fails for the alert

### Requirement: Announcement Priority

`announce` SHALL take `"polite"` (default), `"off"` or `"assertive"`. Without an
`announce` prop, an alert that appears after hydration SHALL therefore be announced once
politely; a server-rendered alert SHALL stay silent (Announce On Appearance After Load).
With `"off"` the alert SHALL never announce. `"assertive"` SHALL be used for important, time-sensitive
messages (errors, failures, expiring sessions) and `"polite"` for advisory messages;
the priority SHALL be passed unchanged to the Announcer. The consumer attribute
`data-tone` SHALL NOT influence the priority, and `announce` SHALL NOT influence any
`data-*` the theme reads.

#### Scenario: Success message (regression: mui/material-ui#40198)

- **WHEN** an alert "Message sent" with `announce="polite"` appears
- **THEN** one polite announcement is made, not an assertive one

#### Scenario: Danger tone without announcement

- **WHEN** a static "This project is archived" alert has `data-tone="danger"` and
  `announce="off"`
- **THEN** it is never announced

#### Scenario: Polite by default

- **WHEN** an alert "Connection lost" with no `announce` prop mounts on the client after
  hydration
- **THEN** exactly one polite announcement is made; the same alert server-rendered and
  hydrated makes none

### Requirement: Announce On Appearance After Load

An alert with `announce` other than `"off"` SHALL announce exactly once when it appears
after the page has loaded: when its Root mounts on the client outside hydration, or when
its `open` state becomes true. An alert whose Root was server-rendered and hydrated
SHALL NOT announce on mount. Moving, reordering or re-rendering a shown alert without a
text change SHALL NOT announce. The announcer SHALL be prepared (its regions created)
when an alert with `announce` other than `"off"` mounts, before any message. Each
announcement SHALL be keyed per alert instance, so announcements requested for the same
instance within the Announcer's debounce collapse into the last one.

#### Scenario: Error appears after an action (regression: chakra-ui#3240)

- **WHEN** a save fails and `{error && <Alert.Root announce="assertive">…}` mounts with
  the title "Couldn't save" and the description "Disk full"
- **THEN** exactly one assertive announcement "Couldn't save. Disk full." is made, and the
  Announcer's regions existed before the message was inserted

#### Scenario: Alert present at page load (regression: mui/material-ui#49440)

- **WHEN** a page is server-rendered with an alert that has `announce="assertive"` and
  is hydrated
- **THEN** the announcement log is empty

#### Scenario: Strict Mode

- **WHEN** an alert with `announce="polite"` mounts on the client under React Strict
  Mode
- **THEN** exactly one announcement is made

#### Scenario: Reordered alerts (regression: ariakit#7235)

- **WHEN** two shown alerts are reordered in a keyed list without text changes
- **THEN** no announcement is made

#### Scenario: Shown again through open

- **WHEN** a mounted alert with `announce="polite"` goes from `open={false}` to
  `open={true}`
- **THEN** one announcement is made

### Requirement: Announce Text Changes

While shown, an alert with `announce` other than `"off"` SHALL announce again when the
text it would announce changes, whatever caused the change (its own props or a
descendant's state). A change back to text already announced SHALL be announced (it is
a change). Changes while closed SHALL NOT be announced.

#### Scenario: Status text updates

- **WHEN** a shown alert with `announce="polite"` changes from "Reconnecting…" to
  "Connected"
- **THEN** one announcement "Connected." is made

#### Scenario: Burst of changes

- **WHEN** a shown alert's text changes three times within 200 ms
- **THEN** only the last text is announced

### Requirement: Announced Text

The announced message SHALL be the consumer's `announcement` string when given.
Otherwise it SHALL be built from the text segments of the labelled Icon (its `label`),
the Title and the Description, in that order, skipping empty ones, joined by the
`messages.announcement(segments)` formatter (English default: each segment that does
not already end in sentence punctuation gets a full stop, segments separated by a
space); when neither Title nor Description is rendered, the single segment SHALL be the
text of Root. Text inside `aria-hidden` subtrees, inside `hidden` elements and inside the
CloseTrigger SHALL be excluded; visually hidden text SHALL be included. The message SHALL
carry the alert's locale. An empty message SHALL NOT be announced.

#### Scenario: Close button not spoken

- **WHEN** an alert with a Title "Couldn't save" and a CloseTrigger "Dismiss" appears
  with `announce="assertive"`
- **THEN** the announcement is "Couldn't save."

#### Scenario: Consumer announcement

- **WHEN** an alert whose visible text is "3 errors" has
  `announcement="3 errors in the form. Fix them and submit again."`
- **THEN** that string is announced

#### Scenario: Language

- **WHEN** an alert rendered with locale `it-IT` announces on an English page
- **THEN** the announcement carries `lang="it-IT"`

### Requirement: Focus

The alert SHALL NOT move focus when it appears, changes or is shown again, and SHALL NOT
make any of its parts focusable except the CloseTrigger and consumer controls.

#### Scenario: Appearance does not steal focus

- **WHEN** an alert with `announce="assertive"` appears while focus is in a text field
- **THEN** focus stays in the text field

### Requirement: Dismissal

`open` SHALL be controllable (`open`, `defaultOpen` default `true`, `onOpenChange(open,
details)`). Activating the CloseTrigger SHALL request closing with `details.reason ===
"close-trigger"`. Closing SHALL keep the Root mounted with `data-state="closed"` until
its exit animations end (presence), then unmount it. Nothing SHALL be announced on
dismissal.

#### Scenario: Dismiss

- **WHEN** the user activates the CloseTrigger of an uncontrolled alert
- **THEN** `onOpenChange(false, { reason: "close-trigger" })` is called once, the alert
  is removed after its exit animation, and the announcement log has no new entry

### Requirement: Focus After Dismissal

When closing is requested while focus is inside the alert, focus SHALL move — before
`onOpenChange` is called, so a consumer that unmounts the alert in response does not
lose focus — to the element returned by `finalFocus(details)` when it returns one, else
to the next tabbable element after the alert in document order, else to the previous
tabbable element before it. `finalFocus` returning `false` SHALL leave focus alone. The
move SHALL go through rind-ui's safe programmatic focus. When focus was outside the
alert, focus SHALL NOT move. When no target exists, a development warning SHALL ask for
`finalFocus`.

#### Scenario: Focused dismiss button (regression: Reado GuidedReviewPanel)

- **WHEN** a keyboard user activates the focused "Dismiss" button of an alert followed by
  a "Retry" button
- **THEN** after closing, focus is on "Retry" with `data-focus-visible`, never on `body`

#### Scenario: Consumer unmounts on close

- **WHEN** `{show && <Alert.Root open onOpenChange={() => setShow(false)}>}` is
  dismissed from its focused CloseTrigger
- **THEN** focus is on the next tabbable element after the alert, not on `body`

#### Scenario: Focus elsewhere

- **WHEN** an alert is closed programmatically while focus is in an unrelated field
- **THEN** focus stays in that field

### Requirement: Close Trigger Name

A CloseTrigger that renders no text content and has no `aria-label` or
`aria-labelledby` SHALL be named by the alert's `messages.dismiss` (English default
"Dismiss"); a CloseTrigger with text content SHALL be named by that text. It SHALL be a
native `button` of `type="button"`.

#### Scenario: Icon-only dismiss

- **WHEN** a CloseTrigger contains only an SVG icon and the consumer passes
  `messages={{ dismiss: "Chiudi" }}`
- **THEN** its accessible name is "Chiudi"

### Requirement: Icon And Severity

The Icon part SHALL carry `aria-hidden="true"` by default. With a `label` prop, it SHALL
instead carry `role="img"` and `aria-label` set to the label, so the severity is part of
the alert's text ("Error"). The alert's severity SHALL NOT be conveyed only by colour or
icon: the docs SHALL require it in text (in the Title or as the Icon `label`).

#### Scenario: Decorative icon

- **WHEN** an alert with an Icon and the Title "Error: couldn't save" is rendered
- **THEN** the icon is not exposed and the announcement is "Error: couldn't save."

#### Scenario: Labelled icon (regression: mui/material-ui#49440)

- **WHEN** an alert with `<Alert.Icon label="Error" />` and the Title "Couldn't save"
  appears with `announce="assertive"`
- **THEN** the icon is an image named "Error" and the announcement is "Error. Couldn't
  save."

### Requirement: No Name On Root

Root SHALL carry no `aria-label`, `aria-labelledby` or `aria-describedby` emitted by
rind-ui (a role-less element cannot be named). A consumer who gives Root `role="region"`
SHALL be able to name it with `aria-labelledby` pointing at the Title's id, which SHALL be
stable and derived from the instance id.

#### Scenario: Region recipe

- **WHEN** a consumer renders `<Alert.Root role="region" aria-labelledby={titleId}>` with
  a Title "Maintenance tonight"
- **THEN** the alert is a region named "Maintenance tonight"

### Requirement: Data Attributes

Every part SHALL carry `data-scope="alert"`, its `data-part` (`root`, `icon`, `title`,
`description`, `close-trigger`) and `data-instance`. Root SHALL carry
`data-state="open"` while shown and `data-state="closed"` while exiting. Every part
SHALL forward `data-variant`, `data-size` and `data-tone` unchanged; the core SHALL NOT
read them.

#### Scenario: Exit hook

- **WHEN** an alert with an exit transition is dismissed
- **THEN** its Root has `data-state="closed"` until the transition ends and is then
  removed

### Requirement: Alert Contract

The `alert` contract SHALL locate an instance by the exact text of its Title, or by
`data-scope` and `data-part` inside a container, failing and listing every match when
more than one matches. It SHALL declare the action `dismiss` (pointer, touch and
keyboard implementations on the CloseTrigger, completing when the alert is closed), the
queries `isOpen`, `title` and `description`, and the trait `presence`. Its event map
SHALL map `CLOSE_TRIGGER_PRESS` to `dismiss` and the `open` prop to prop steps; mount
and text-change events SHALL be `{ skip }` with a reason and covered by machine unit
tests and prop steps. The driver SHALL expose the announcements made since it was
created.

#### Scenario: Driver round trip

- **WHEN** a test mounts an alert with `announce="assertive"` after load, runs `const a
  = getAlert(screen, { title: "Couldn't save" })` and `await a.dismiss()`
- **THEN** `a.announcements` is `["Couldn't save."]` with priority `assertive`, `await
  a.isOpen()` is false, and focus is not on `body`

#### Scenario: Same test in Playwright

- **WHEN** the same test runs with `page`
- **THEN** it passes unchanged

### Requirement: Model-Based Coverage

`testMachine` over the alert contract SHALL cover `open → closed` through `dismiss` in
the pointer, keyboard and virtual modalities and `$sync:open` in both directions, for
`announce` `"off"`, `"polite"` and `"assertive"`, and SHALL check after each step that
the announcement log grew by exactly the announcements the oracle expects (one per
appearance and per text change while shown with `announce` other than `"off"`, none
otherwise) and that focus is never on `body` after a dismissal from inside.

#### Scenario: Off never speaks

- **WHEN** the runner walks every path with `announce="off"`
- **THEN** the announcement log stays empty

### Requirement: Theme Expectations

The theme stylesheet SHALL style the alert in the `status` family (`soft` default,
`solid`, `outline`; sizes `sm`, `md`, `lg`; every `data-tone`), reading only
`--rind-alert-*` tokens with semantic fallbacks. Title, Description and CloseTrigger
SHALL lay out with logical properties (the CloseTrigger at the inline end, mirrored in
RTL). Under `forced-colors: active` the alert SHALL keep a visible border and the icon
SHALL use `currentColor`. Exit transitions SHALL use duration tokens that are zero under
reduced motion. Text SHALL meet 4.5:1 against the alert background in every tone and
variant, and the CloseTrigger target SHALL be at least 24×24 CSS px.

#### Scenario: Forced colors

- **WHEN** a soft danger alert is rendered with `forced-colors: active`
- **THEN** its boundary is visible as a border

#### Scenario: Reduced motion

- **WHEN** an alert is dismissed with reduced motion emulated
- **THEN** it is removed in the same step, with no running transition
