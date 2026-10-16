# skeleton Specification

## Purpose
Defines rind-ui's Skeleton: placeholder shapes for content that is still loading, with
the loading state exposed once for the whole loading area — a busy region, placeholders
hidden from assistive technology and unreachable, a findable loading text, an optional
completion announcement — and motion that respects the user's preference. Research:
`docs/research/skeleton.md`.
## Requirements
### Requirement: Anatomy

A Skeleton SHALL consist of `Root` (a `div`) holding the loading state, and inside it
the optional parts `Status` (a `span`), `Content` (a `div`) and any number of `Item`
parts (a `span` each). Every part SHALL accept the props of the element it renders and
the `render` prop. Items SHALL read the loading state from the nearest Root; an Item's
own `loading` prop SHALL override it.

#### Scenario: Loading list

- **WHEN** `<Skeleton.Root loading><Skeleton.Status /><Skeleton.Content render={<ul />}>`
  with three `<li><Skeleton.Item /></li>` is rendered
- **THEN** a `ul` with `aria-busy="true"` and three hidden placeholders follows a
  visually hidden "Loading" text

#### Scenario: Shared state (regression: chakra-ui#2130)

- **WHEN** a Root with `loading` contains five Items without their own `loading` prop
- **THEN** all five are in the loading state, and all five leave it when Root's
  `loading` becomes false

### Requirement: Loading State

The loading state SHALL be a read-only binding of Root's `loading` prop (default
`true`): `loading` when true, `loaded` when false. It SHALL be observed, not controlled
from inside: there SHALL be no event that changes it other than a new `loading` value.
The server-rendered output SHALL already reflect the state.

#### Scenario: Server rendering

- **WHEN** a Root with `loading` is server-rendered
- **THEN** the HTML already contains `aria-busy`, the hidden placeholders and the
  Status text, and hydration logs no mismatch

### Requirement: Busy Region

While loading, `Content` SHALL carry `aria-busy="true"`; when loaded it SHALL carry no
`aria-busy` attribute. No other part SHALL carry `aria-busy`. Root SHALL carry no ARIA
attribute of its own.

#### Scenario: Busy only while loading

- **WHEN** a Skeleton goes from `loading` to `loaded`
- **THEN** Content had `aria-busy="true"` before and has no `aria-busy` attribute after

### Requirement: Hidden Placeholders

While loading, every Item SHALL carry `aria-hidden="true"`; an Item that has children
SHALL also be `inert`, so nothing inside it is focusable or exposed. When loaded, an
Item SHALL carry neither attribute and SHALL render its children unchanged. Items SHALL
NOT carry a role (`progressbar`, `status`, `group` or other) in any state.

#### Scenario: Placeholders are silent (regression: mui/material-ui#28057, Kobalte role="group")

- **WHEN** a screen reader reads a region with six loading Items
- **THEN** it reads no placeholder and no group

#### Scenario: Stale controls are unreachable

- **WHEN** an Item wraps a button while loading and the user presses Tab from before the
  skeleton
- **THEN** focus skips the button

#### Scenario: Loaded content is untouched

- **WHEN** the Item that wrapped the button leaves the loading state
- **THEN** the button is focusable and exposed, and the Item has no `aria-hidden` or
  `inert`

### Requirement: Loading Text

While loading, `Status` SHALL render the Root's `messages.loading` (English default
"Loading") — or its own children when given — with rind-ui's visually hidden style;
when loaded it SHALL render nothing. Status SHALL NOT be a live region and SHALL NOT be
inside Content: Status inside Content SHALL cause a development warning, because
assistive technology that honours `aria-busy` may suppress it there.

#### Scenario: Loading text is findable (regression: mui/material-ui#31363, adobe/react-spectrum#8479)

- **WHEN** a screen-reader user reads through a loading Skeleton
- **THEN** "Loading" is read once, from an element that is not inside the busy region
  and has no live-region role

#### Scenario: Custom text

- **WHEN** `<Skeleton.Status>Loading comments</Skeleton.Status>` is rendered while
  loading
- **THEN** "Loading comments" is the loading text

#### Scenario: Status inside the busy region

- **WHEN** a Status is rendered inside Content
- **THEN** a development warning says to move it outside Content

### Requirement: Completion Announcement

With `announceOnLoad` (`true` for `messages.loaded`, English default "Loaded", or a
string), the Skeleton SHALL announce politely through the Announcer, keyed per instance,
when its state goes from `loading` to `loaded`. It SHALL NOT announce when it mounts
already loaded, when it mounts loading, or when it goes from `loaded` to `loading`.
Without `announceOnLoad` (default) it SHALL never announce. The Announcer SHALL be
prepared when a Skeleton with `announceOnLoad` mounts.

#### Scenario: Comments loaded

- **WHEN** a Skeleton with `announceOnLoad="12 comments loaded"` goes from loading to
  loaded
- **THEN** exactly one polite announcement "12 comments loaded" is made

#### Scenario: Mounted loaded (regression: chakra-ui#2864)

- **WHEN** a Skeleton with `announceOnLoad` mounts with `loading={false}`
- **THEN** nothing is announced

#### Scenario: Default is silent

- **WHEN** a Skeleton without `announceOnLoad` finishes loading
- **THEN** the announcement log is empty

### Requirement: Motion

Items SHALL carry `data-animate` while loading unless `animate={false}` is passed (on
the Item or the Root). The core SHALL run no animation itself. The theme's shimmer SHALL
run only under `prefers-reduced-motion: no-preference`, SHALL stop when the Item leaves
the loading state, SHALL NOT flash (one sweep no faster than 1.5 s), and SHALL be in
phase across all Items on the page without script.

#### Scenario: Reduced motion (regression: mui/material-ui#49442)

- **WHEN** a loading Skeleton is rendered with reduced motion emulated
- **THEN** no Item has a running animation

#### Scenario: Animation stops on load

- **WHEN** a Skeleton leaves the loading state
- **THEN** no Item has a running animation

### Requirement: Data Attributes

Every part SHALL carry `data-scope="skeleton"`, its `data-part` (`root`, `status`,
`content`, `item`), `data-instance` and `data-state="loading" | "loaded"`. Items SHALL
carry `data-animate` (present, empty value) while animating and no `data-animate`
otherwise. Boolean attributes SHALL be present-and-empty or absent, never `"true"` /
`"false"`. Every part SHALL forward `data-variant`, `data-size` and `data-tone`
unchanged. The core SHALL write no inline styles.

#### Scenario: Attribute selector matches (regression: kobaltedev/kobalte#453)

- **WHEN** a stylesheet selects `[data-scope="skeleton"][data-part="item"][data-animate]`
- **THEN** it matches every animating Item and no other element

### Requirement: Skeleton Contract

The `skeleton` contract SHALL locate an instance by `data-scope` and `data-part` inside a
container the driver is given, failing and listing every match when more than one
matches. It SHALL declare no actions; the queries `isLoading()` (from Root's
`data-state`) and `statusText()` (the loading text, empty when loaded); the observable
values `loading: { isLoading: true }` and `loaded: { isLoading: false }`; the event map
`$sync:loading` → a prop step `{ loading: to === "loading" }`; and no traits. The
driver SHALL expose the announcements made since it was created.

#### Scenario: Driver queries

- **WHEN** a test runs `const s = getSkeleton(screen, { within: commentsSection })`
  while the comments load
- **THEN** `await s.isLoading()` is true and `await s.statusText()` is "Loading"

#### Scenario: Same test in Playwright

- **WHEN** the same test runs with `page`
- **THEN** it passes unchanged

### Requirement: Model-Based Coverage

`testMachine` over the skeleton contract SHALL walk `loading ⇄ loaded` with prop steps,
with and without `announceOnLoad`, and SHALL check after each step: `aria-busy` on
Content exactly while loading; every Item `aria-hidden` (and `inert` when it has
children) exactly while loading; the Status text present exactly while loading and not
inside Content; no focusable element inside a loading Item; and the announcement log
grew by one exactly on `loading → loaded` with `announceOnLoad`.

#### Scenario: Wrapper puts the status inside the region

- **WHEN** a consumer wrapper renders Status inside Content and runs `testMachine`
- **THEN** the run fails naming the Status part

### Requirement: Theme Expectations

The theme stylesheet SHALL style Items with `--rind-skeleton-*` tokens (fill, shimmer
highlight, radius, text-line height) read with semantic fallbacks, with fill and
highlight defined for light and dark schemes; SHALL keep the placeholder's box under
`forced-colors: active` (a `GrayText` fill or border); and SHALL hide wrapped children
visually while loading (transparent text, hidden descendants) without changing their
size, so the loaded content does not shift the layout. Multi-line text placeholders
SHALL draw one shape per line box.

#### Scenario: Dark mode (regression: mui/material-ui#19429)

- **WHEN** a loading Skeleton is rendered in the dark scheme
- **THEN** its fill and highlight come from the dark tokens

#### Scenario: Forced colors

- **WHEN** a loading Skeleton is rendered with `forced-colors: active`
- **THEN** every placeholder is visible

#### Scenario: Circle in Safari (regression: mui/material-ui#24050)

- **WHEN** a circular placeholder (`--rind-skeleton-radius: 9999px`) shimmers in WebKit
- **THEN** it stays round during the animation

