## ADDED Requirements

### Requirement: Anatomy

A Message Thread SHALL consist of `Root`, `Viewport` and one `Message` per rendered message,
and MAY contain a `JumpToLatest`. `Viewport` SHALL have `role="feed"`, a name (default
"Conversation") and `tabindex="0"`. Each `Message` SHALL have `role="article"`,
`tabindex="-1"`, `aria-posinset` and `aria-setsize`, and a name from its speaker.
`JumpToLatest` SHALL be a `<button type="button">`. Every part SHALL accept the `render`
prop. No part SHALL carry `aria-live` or a live-region role.

#### Scenario: Feed of articles

- **WHEN** a thread with three messages (user, assistant, user) is rendered
- **THEN** the viewport is a `feed` named "Conversation" and the messages are articles
  named "You", "Assistant", "You" with `aria-posinset` 1 to 3 and `aria-setsize` 3

### Requirement: Follow States

The Message Thread SHALL be `following` or `detached`. While `following` with
`anchor="bottom"`, content growth and viewport shrink SHALL keep the viewport scrolled to
the bottom. A user scroll upward, an upward wheel on the viewport, or a text selection
being dragged inside it SHALL detach. A user scroll that ends within `bottomThreshold`
(default 32 px) of the bottom SHALL re-attach. The component's own scrolls SHALL never
count as the user's.

#### Scenario: Reading back stops the follow

- **WHEN** a following thread receives a streamed answer and the user wheels up
- **THEN** the state is `detached` and further growth does not move the view

#### Scenario: Prompt grows

- **WHEN** a following thread's viewport shrinks because the prompt below grew
- **THEN** the viewport is still scrolled to the bottom

#### Scenario: Back at the bottom

- **WHEN** a detached user scrolls down to within 32 px of the bottom
- **THEN** the state is `following`

### Requirement: New Messages

When `count` grows: a following thread SHALL scroll to the bottom. A detached thread SHALL
add the new messages to its unread count. A new message from the user (`lastFromUser`)
SHALL re-attach and scroll to the bottom with `anchor="bottom"`, and SHALL be scrolled to
the top of the viewport with `anchor="top"`, where the thread then never follows growth.

#### Scenario: Unread while reading back

- **WHEN** two assistant messages arrive while detached
- **THEN** JumpToLatest is named "2 new messages, jump to latest"

#### Scenario: Top anchor

- **WHEN** the user sends a message in a thread with `anchor="top"`
- **THEN** that message's top is at the viewport's top and the answer grows below it
  without scrolling

### Requirement: Jump To Latest

`JumpToLatest` SHALL be rendered only while detached and SHALL be named by
`messages.jumpLabel(unread)`. Pressing it SHALL scroll to the bottom, set `following` and
clear the unread count. With keyboard or virtual modality, focus SHALL move to the last
message's article.

#### Scenario: Keyboard jump

- **WHEN** a keyboard user presses JumpToLatest
- **THEN** the view is at the bottom and focus is on the last article

### Requirement: Feed Keyboard

With focus in the thread, Page Down and Page Up SHALL move focus to the next and the
previous message's article and bring it into the viewport, scrolling only the viewport.
Control+End and Control+Home SHALL move focus to the first focusable element after and
before the thread. A text field inside a message SHALL keep these keys.

#### Scenario: Between messages

- **WHEN** focus is on the first article and Page Down is pressed twice
- **THEN** focus is on the third article and the page itself has not scrolled

### Requirement: Older Messages

When the top of the viewport is reached, `onLoadOlder` SHALL be called. While
`loadingOlder` is true, the viewport SHALL carry `aria-busy="true"`. When messages are
prepended, the first previously visible message SHALL stay where it was in the viewport
(Safari included).

#### Scenario: Prepend keeps the place

- **WHEN** ten older messages are prepended while the user reads the first one
- **THEN** that message's position in the viewport changes by less than 1 px

### Requirement: Motion

Scrolls SHALL be smooth, or instant under the Environment's reduced-motion preference.

#### Scenario: Reduced motion

- **WHEN** reduced motion is preferred and JumpToLatest is pressed
- **THEN** the viewport is at the bottom at once

### Requirement: Data Attributes

Every part SHALL carry `data-scope="message-thread"`, `data-part`, `data-instance`,
`data-state` and `data-anchor`; `Message` SHALL carry `data-from`.

#### Scenario: State attributes

- **WHEN** the thread is detached
- **THEN** every part carries `data-state="detached"`

### Requirement: Contract

The Message Thread SHALL ship `messageThreadContract`, located by role `feed` and name,
with the actions `scrollUp`, `scrollToBottom`, `jump`, `nextMessage` and
`previousMessage`, the queries `state`, `isAtBottom`, `unread`, `focusedMessage` and
`messageCount`, and a `getMessageThread` driver.

#### Scenario: Driver

- **WHEN** a test calls `scrollUp()` on a following thread
- **THEN** `state()` is "detached"

### Requirement: Message Thread Invariants

After every step:
- no part SHALL carry `aria-live` or a live-region role;
- every message SHALL be an `article` with a name, `aria-posinset` and `aria-setsize`;
- JumpToLatest SHALL be rendered if and only if the state is `detached`.

#### Scenario: Invariants hold

- **WHEN** any model step runs
- **THEN** the invariants hold

### Requirement: Theme

`@rind-ui/theme` SHALL ship `message-thread.css` in `@layer rind.components` with
`:where()` selectors, family `decoration`, with visible focus on the viewport and on
articles and a JumpToLatest of at least 24 × 24 px.

#### Scenario: Focus visible

- **WHEN** an article has keyboard focus
- **THEN** it shows the focus ring
