# streaming-message Specification

## Purpose
TBD - created by archiving change add-streaming-message. Update Purpose after archive.
## Requirements
### Requirement: Anatomy

A Streaming Message SHALL consist of `Root` and `Content`, and MAY contain a `Caret`.
`Root` SHALL have no role of its own and SHALL forward `role`, `aria-label` and
`aria-labelledby`. `Content` SHALL render its children, or, when they are a function, call
it with the displayed text and the state; with no children it SHALL render the displayed
text as plain text. Every part SHALL accept the `render` prop.

#### Scenario: Consumer renderer

- **WHEN** a Content whose children are a function is rendered for the text "Hello"
- **THEN** the function receives "Hello" and the state, and its result is rendered

### Requirement: States

The Streaming Message SHALL be in exactly one of `pending`, `streaming`, `settling`,
`complete`, `cancelled` or `error`, chosen from the `status` prop: `cancelled` and `error`
for those statuses; for `complete`, `settling` while a smooth reveal has not shown all of
`text`, else `complete`; `streaming` and `pending` for those statuses.

#### Scenario: Complete waits for the reveal

- **WHEN** a smoothly revealing message receives `status` `complete` with part of its text
  not yet shown
- **THEN** its state is `settling` until the whole text is shown, then `complete`

#### Scenario: Cancel shows what arrived

- **WHEN** a revealing message receives `status` `cancelled`
- **THEN** the state is `cancelled` and the Content shows all of `text` at once

### Requirement: Displayed Text

The displayed text SHALL be all of `text`, except in `streaming` and `settling` while the
smooth reveal is on, where it SHALL be the first `shown` characters. Text present at mount
SHALL be shown at once. When `text` stops being an extension of the shown prefix, the
reveal SHALL restart from the start (smooth on) or show the new text at once (smooth off).

#### Scenario: No reveal on mount

- **WHEN** a message mounts with `status` `complete` and a long `text`
- **THEN** the whole text is displayed in the first render, server and client alike

#### Scenario: Rewritten text

- **WHEN** a streaming message's `text` changes from "Hello wor" to "Hi"
- **THEN** the reveal restarts and never displays a prefix of the old text

### Requirement: Smooth Reveal

With `smooth` (default `true`) and no reduced-motion preference, the reveal SHALL advance
on Scheduler ticks of 16 ms at a pace set when a chunk arrives (`revealStep`): fast enough
to drain the backlog of that moment in `drainMs` (default 250), never slower than one
character per `maxCharIntervalMs` (default 5), never past the received text. Under reduced motion, read from the Environment's `MotionPreference`
after mount, the reveal SHALL be off.

#### Scenario: Backlog drained in time

- **WHEN** 500 characters arrive at once while streaming
- **THEN** they are all displayed within 16 ticks (256 ms) of the virtual clock

#### Scenario: Reduced motion

- **WHEN** reduced motion is preferred
- **THEN** every chunk is displayed as soon as it arrives

### Requirement: Busy State

While the state is `streaming` or `settling`, `Content` SHALL carry `aria-busy="true"`,
every part SHALL carry `data-busy`, and the `Caret` SHALL be rendered with
`aria-hidden="true"`. Otherwise none of these SHALL be present. No part SHALL carry
`aria-live` or a live-region role.

#### Scenario: Busy only while streaming

- **WHEN** a message goes from `streaming` to `complete`
- **THEN** `aria-busy` is removed and the Caret is no longer rendered

### Requirement: Announcements

The Streaming Message SHALL announce through the Environment's announcer, politely,
keyed per instance, according to `announce`:
- `status` (default): `messages.started` on the first entry to `streaming`,
  `messages.completed` on entering `complete` after a start, `messages.cancelled` on
  `cancelled` and `messages.failed` on `error`;
- `text`: the complete text once on `complete`; `messages.failed` on `error`; nothing
  more after `cancelled`;
- `sentences`: each complete sentence as it arrives, then the rest on completion;
- `none`: nothing.
A chunk SHALL never be announced on its own in `status` and `text` modes. A message
that mounts in a final state SHALL announce nothing.

#### Scenario: Lifecycle

- **WHEN** a message goes `pending` → `streaming` (ten chunks) → `complete`
- **THEN** exactly two announcements are made: "Generating a response" and "Response
  complete"

#### Scenario: Reloaded thread is silent

- **WHEN** a message mounts with `status` `complete`
- **THEN** nothing is announced

### Requirement: Data Attributes

Every part SHALL carry `data-scope="streaming-message"`, `data-part`, `data-instance`,
`data-state`, and `data-busy` while busy.

#### Scenario: State on every part

- **WHEN** a message is streaming
- **THEN** Root, Content and Caret carry `data-state="streaming"` and `data-busy`

### Requirement: Contract

The Streaming Message SHALL ship `streamingMessageContract`, located by
`data-scope="streaming-message"` and `data-part="root"` or by the Root's role and name,
with the queries `state`, `text`, `isBusy` and `hasCaret`, and a `getStreamingMessage`
driver.

#### Scenario: Driver reads the state

- **WHEN** a test reads a streaming message through `getStreamingMessage`
- **THEN** `state()` is "streaming", `isBusy()` and `hasCaret()` are true

### Requirement: Streaming Message Invariants

After every step:
- the Content SHALL not be inside an element with `aria-live` or a live-region role;
- `aria-busy` on the Content, `data-busy` and a rendered Caret SHALL agree;
- in `complete`, `cancelled` and `error`, the Content SHALL show all of `text`.

#### Scenario: Body never live

- **WHEN** any model step runs
- **THEN** no ancestor of the Content has `aria-live` or a live-region role

### Requirement: Theme

`@rind-ui/theme` SHALL ship `streaming-message.css` in `@layer rind.components` with
`:where()` selectors, family `decoration`. The Caret SHALL blink only while busy and not
under `prefers-reduced-motion: reduce`, and SHALL use `CanvasText` in forced colours.

#### Scenario: Caret stops

- **WHEN** reduced motion is preferred
- **THEN** the Caret does not animate

