## Purpose

Defines rind-ui's Badge: a small, static piece of status text (a count, a label, a
dot) that is never interactive and never a live region, and the rules by which its
meaning reaches assistive technology through the control it sits on. Research:
`docs/research/badge.md`.

## ADDED Requirements

### Requirement: Anatomy

The Badge SHALL consist of one part, `root`, rendering a `span` by default, accepting
the props of the element it renders and supporting element substitution through
`render`. The Badge SHALL have no state machine: its output SHALL be a pure function of
its props.

#### Scenario: Text badge

- **WHEN** `<Badge.Root>Beta</Badge.Root>` is rendered
- **THEN** a `span` with the text "Beta" is rendered and it has no `role` attribute

### Requirement: Never A Live Region

The Badge SHALL NOT carry `role="status"`, `role="alert"`, `role="log"`, `aria-live`,
`aria-atomic` or `aria-relevant`, SHALL NOT be focusable, and SHALL NOT announce
anything when its content changes. A consumer `role` or `aria-live` passed to the root
SHALL be forwarded (element props are never dropped) and SHALL cause a development
warning that names the Announcer as the way to announce a change. The contract SHALL
NOT declare the `live-region` trait, so a wrapper that turns the badge into a live region
fails the generic "no live region of its own" invariant.

#### Scenario: Count changes silently (regression: Kobalte role="status")

- **WHEN** a badge's content changes from "3" to "4" while a screen reader is reading
  elsewhere on the page
- **THEN** nothing is announced and the badge element has no live-region role or
  attribute

#### Scenario: Wrapper adds a live role

- **WHEN** a consumer wrapper renders `<Badge.Root role="status">` and runs the
  model-based invariants over its host
- **THEN** a development warning is logged and the "no `aria-live` of its own" invariant
  fails for the badge

### Requirement: Text For Assistive Technology

A `label` prop SHALL set the text assistive technology gets for the badge. With `label`,
the root SHALL render its children inside an element with `aria-hidden="true"` followed
by the label rendered with rind-ui's visually hidden style; without `label`, the
children SHALL be exposed as they are. The root SHALL NOT carry `aria-label` or
`aria-labelledby` (prohibited on a generic element); a consumer `aria-label` SHALL be
forwarded and SHALL cause a development warning recommending `label`. A badge that is
exposed (not `aria-hidden`) and has neither text content nor `label` SHALL cause a
development warning.

#### Scenario: Overflowing count (regression: mui/material-ui#22070)

- **WHEN** `<Badge.Root label="more than 99 notifications">99+</Badge.Root>` is
  rendered
- **THEN** "99+" is visible and hidden from assistive technology, and the badge's text
  in the accessibility tree is "more than 99 notifications"

#### Scenario: Dot badge without text (regression: mui/material-ui#49441, adobe/react-spectrum#4043)

- **WHEN** an empty `<Badge.Root />` is rendered without `label` and without
  `aria-hidden`
- **THEN** a development warning asks for `label` or `aria-hidden="true"`

#### Scenario: Decorative badge

- **WHEN** `<Badge.Root aria-hidden="true">2</Badge.Root>` is rendered inside a button
  whose name already states the count
- **THEN** no part of the badge is exposed and nothing is logged

#### Scenario: Label is translated with the page

- **WHEN** `<Badge.Root label="3 unread">3</Badge.Root>` is rendered
- **THEN** the label is a text node in the document, not an attribute value

### Requirement: Count On An Interactive Host

When a badge is placed inside an interactive host (an element whose role is `button`,
`link`, `tab`, `menuitem`, `menuitemcheckbox`, `menuitemradio`, `option`, `treeitem`,
`switch` or `checkbox`), its text SHALL reach the host's accessible name or description
in one of two ways: (1) the host has no `aria-label`/`aria-labelledby`, so its name is
computed from content and includes the badge's text; or (2) the host keeps an
`aria-label` or `aria-labelledby` and lists the badge's id in its `aria-describedby`.
The badge root SHALL have a stable id (derived from the instance id, overridable) so the
host can reference it. After mount, in development, a badge that is exposed and inside
such a host that has an `aria-label` or `aria-labelledby` whose computed text does not
contain the badge's text, and whose `aria-describedby` does not list the badge's id,
SHALL cause a development warning naming the host and both remedies.

#### Scenario: Name from content (preferred)

- **WHEN** a button contains an icon with a visually hidden "Comments" text and
  `<Badge.Root label="3 unread">3</Badge.Root>`, and has no `aria-label`
- **THEN** the button's accessible name is "Comments 3 unread"

#### Scenario: Host keeps an aria-label

- **WHEN** a button with `aria-label="Comments"` contains `<Badge.Root id="c" label="3
  unread">3</Badge.Root>` and has `aria-describedby="c"`
- **THEN** its accessible name is "Comments" and its accessible description is "3
  unread", and nothing is logged

#### Scenario: Count hidden by the host's label (regression: mui/material-ui#49441, Reado ActivityBar)

- **WHEN** a button with `aria-label="Comments"` contains an exposed badge "3" and no
  `aria-describedby`
- **THEN** a development warning names the button and says the count is not in its
  accessible name or description

#### Scenario: Label already contains the count

- **WHEN** a button with `aria-label="Sync (2 incoming)"` contains an exposed badge "2"
- **THEN** no warning is logged, because the host's name contains the badge's text

### Requirement: Data Attributes

The root SHALL carry `data-scope="badge"`, `data-part="root"` and `data-instance`, and
SHALL forward the consumer attributes `data-variant`, `data-size` and `data-tone`
unchanged. The core SHALL NOT read them.

#### Scenario: Styling hooks

- **WHEN** `<Badge.Root data-variant="solid" data-tone="danger">2</Badge.Root>` is
  rendered
- **THEN** the element has `data-scope="badge"`, `data-part="root"`, `data-instance`,
  `data-variant="solid"` and `data-tone="danger"`, and its accessibility output is the
  same as without the two consumer attributes

### Requirement: Badge Contract

The `badge` contract SHALL locate an instance by `data-scope` and `data-part` inside a
container the driver is given (a badge has no role and no name), failing and listing
every match when more than one matches. It SHALL declare no actions; the queries
`text()` (the text assistive technology gets: the `label` when set, otherwise the text
content, empty when hidden) and `isExposed()`; and no traits.

#### Scenario: Driver reads the spoken text

- **WHEN** a test runs `const b = getBadge(screen, { within: commentsButton })` on a
  badge rendered as `<Badge.Root label="3 unread">3</Badge.Root>`
- **THEN** `await b.text()` is "3 unread" and `await b.isExposed()` is true

#### Scenario: Same test in Playwright

- **WHEN** the same test runs with `page`
- **THEN** it passes unchanged

### Requirement: Theme Expectations

The theme stylesheet SHALL style the badge in the `status` family (`soft` default,
`solid`, `outline`; sizes `sm`, `md`, `lg`; every `data-tone`), reading only
`--rind-badge-*` tokens with semantic fallbacks. The badge SHALL be an inline box that
never stretches in a flex or grid parent, with its text centred, a minimum inline size
equal to its block size, and padding and size in units relative to its font size so
longer text grows the badge instead of clipping. Under `forced-colors: active` the badge
SHALL keep a visible 1 px border. Badge text SHALL meet 4.5:1 against the badge fill in
every tone and variant.

#### Scenario: Zoomed count (regression: mui/material-ui#49441)

- **WHEN** a "99+" badge is rendered at 200 % zoom
- **THEN** the whole text is visible and not clipped

#### Scenario: Forced colors (regression: ariakit#7591)

- **WHEN** a count badge inside a button is rendered with `forced-colors: active`
- **THEN** the badge has a visible border and does not read as a stray number

#### Scenario: Badge in a card (regression: ariakit#7604)

- **WHEN** a badge is the child of a vertical flex card
- **THEN** it keeps its own width
