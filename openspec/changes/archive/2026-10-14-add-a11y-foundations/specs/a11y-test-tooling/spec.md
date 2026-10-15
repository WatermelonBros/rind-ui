## Purpose

Defines the accessibility test tooling `@rind-ui/testing` and the repo add on top of
drivers and model-based tests: adapter inputs the accessibility invariants need,
announcement logs, a virtual screen reader, the Chromium accessibility tree, ARIA
snapshots, nightly real screen-reader runs, and the published support matrix and
manual protocol.

## ADDED Requirements

### Requirement: Adapter Inputs For Accessibility Checks

Both adapters SHALL support, identically: key presses marked as composing
(`isComposing: true`, `keyCode: 229`); hover with `pointerType: "touch"`; programmatic
focus with no preceding input; the keys `F10` and `ContextMenu`; and running a test
under a chosen platform and locale. An adapter's notion of "hidden" SHALL include
`inert` ancestors in both adapters.

#### Scenario: Composing Enter in Playwright and jsdom

- **WHEN** the same driver test presses a composing Enter through the DOM adapter and
  the Playwright adapter
- **THEN** the element receives `keydown` with `isComposing: true` and `keyCode: 229` in
  both

#### Scenario: Inert content is not found

- **WHEN** a part is inside an `inert` subtree in jsdom
- **THEN** the DOM adapter treats it as hidden, as the Playwright adapter does

### Requirement: Full IME Composition Sequence

Both adapters SHALL offer a composition input on text-entry parts,
`compose(updates, commit?)`, that takes the intermediate texts and the committed text and
drives a complete composition, in this order: `compositionstart`; for each intermediate
text a `keydown` marked composing (`isComposing: true`, `keyCode: 229`),
`compositionupdate` and an `input` event with `isComposing: true` and the element's value
updated; then, for the commit, one more composing `input` (`isComposing: true`) carrying
the committed text, followed by `compositionend` with the committed text, leaving the
committed text as the element's value. This is the order real Chromium (DevTools
protocol) and Firefox produce: the commit arrives as a composing `input` before
`compositionend`, not as an `input` after it. Called without a commit, `compose(updates)`
SHALL leave the composition open (no `compositionend`), so a test can act during it. The
Playwright adapter SHALL use the DevTools protocol's `Input.imeSetComposition` and
`Input.insertText` in Chromium and synthesise the same sequence in the page in Firefox
and WebKit. Marking single keys as composing (above) is not sufficient.

#### Scenario: Japanese composition in both adapters

- **WHEN** the same driver test composes the intermediate texts "に", "にほ", "にほん"
  and commits "日本" into a text input, through the DOM adapter and the Playwright
  adapter
- **THEN** in both the element receives `compositionstart`, four composing `input`
  events (three updates, then one carrying "日本"), then `compositionend` with data
  "日本", and its value is "日本"

#### Scenario: Keyboard module sees the composition

- **WHEN** the keyboard module's key descriptions are recorded during the Japanese composition
- **THEN** every `keydown` between `compositionstart` and `compositionend` is described
  with `composing: true`

#### Scenario: Composition left open

- **WHEN** a driver test composes "に", "にほ" with no commit
- **THEN** the element has received `compositionstart` and two composing `input` events,
  no `compositionend`, and keydowns sent next are still described as composing

### Requirement: Announcement Log

`@rind-ui/testing` SHALL provide a recording announcer and SHALL let drivers read every
announcement made since the driver was created (message, priority, key), in both
adapters, without asserting on live-region DOM internals. The log SHALL be cleared by
rind-ui's per-test reset.

#### Scenario: Streamed message in Playwright

- **WHEN** a Playwright test streams "Hel", "lo", " there" into a message and reads the
  driver's announcements
- **THEN** the log is exactly `["Hello there"]`

#### Scenario: No leak between tests

- **WHEN** one test announces and the next test reads the log before announcing
- **THEN** the log is empty

### Requirement: Virtual Screen Reader Assertions

`@rind-ui/testing` SHALL offer a helper that runs a virtual screen reader over a
container (in jsdom and in the browser) and returns its spoken phrase log, used to
assert announcement sequences and the reading order of composed widgets. Each wave-1
pattern SHALL have one reading-order test with it.

#### Scenario: Toast announced once

- **WHEN** a toast is shown and the virtual screen reader's log is read
- **THEN** the toast's text appears exactly once

### Requirement: Chromium Accessibility Tree

`@rind-ui/testing/playwright` SHALL export `chromiumTree(page)`, which returns
Chromium's computed accessibility tree (role, name, ignored and ignored reasons per
node) through the DevTools protocol, retrying until the tree is available, and SHALL
report that it is unavailable in other engines rather than failing. The model-based
runner SHALL use it in Chromium for: names that must resolve across `inert`
(RA#9737), description targets that must not be ignored (RA#8915), the focused node not
ignored, and open popups exposed (RX#4115).

#### Scenario: Menu named by an inert trigger (RA#9737)

- **WHEN** an open menu is labelled with `aria-labelledby` pointing at a trigger inside
  an inert subtree, in Chromium
- **THEN** the runner fails the step because Chromium's tree gives the menu an empty
  name, although Playwright's in-page name computation reports one

#### Scenario: Firefox

- **WHEN** `chromiumTree` is called with a Firefox page
- **THEN** it returns an "unavailable" result and the dependent checks are skipped and
  listed as skipped

### Requirement: ARIA Snapshots Per State Story

Every contract state SHALL have a Storybook state story whose play function leaves the
component in that state; a check SHALL fail when a contract state has no state story.
Playwright SHALL match a partial ARIA snapshot (role, name and states) for each state
story in Chromium, Firefox and WebKit, and the same snapshot SHALL be emitted into the
component's generated docs as what assistive technology sees in that state.

#### Scenario: Missing state story

- **WHEN** a contract declares an `open` state and no story leaves the component open
- **THEN** the coverage check fails naming the state

#### Scenario: Structural regression

- **WHEN** a change removes `aria-expanded` from a trigger in the open state story
- **THEN** the snapshot test fails in all three engines

### Requirement: Nightly Screen-Reader Runs

The repo SHALL run golden flows nightly with real screen readers — VoiceOver with
Playwright's WebKit on macOS (not Safari, which Playwright cannot drive) and NVDA with
Chrome on Windows — matching key phrases by containment,
not full equality. A failure SHALL open an issue with the phrase difference and the
OS, browser and screen-reader versions, and SHALL NOT block pull requests.

#### Scenario: VoiceOver phrase missing

- **WHEN** the nightly VoiceOver run no longer hears "1 of 6" when highlighting the
  first option
- **THEN** an issue is opened with the expected phrase, the spoken log and the versions,
  and no pull request check fails

### Requirement: Published Support Matrix And Manual Protocol

The docs SHALL publish the support matrix (tier 1: JAWS + Chrome, NVDA + Chrome,
NVDA + Firefox, VoiceOver + Playwright WebKit on macOS and iOS, TalkBack + Chrome on Android;
tier 2 on bug report; VoiceOver + Firefox and Orca without guarantee) and the manual
tier-1 protocol as a checklist: pinned and reset AT versions, the matrix, the per-state
× per-action script in three input modes, comparison with the APG example and the
native control before filing an AT bug, recording, and forced-colors, zoom and
reduced-motion checks. Each component docs page SHALL show a "Tested with" table built
from recorded manual passes (AT, browser and OS versions, date).

#### Scenario: Component docs page

- **WHEN** a component has a recorded manual pass with NVDA 2026.3 and Chrome 155 on
  2026-10-20
- **THEN** its docs page's "Tested with" table shows that row

#### Scenario: Protocol is reachable

- **WHEN** a contributor opens the accessibility docs
- **THEN** the support matrix and the manual protocol checklist are linked from the
  docs index
