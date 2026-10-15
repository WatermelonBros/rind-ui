# overlay-testing Specification

## Purpose
Lets every overlay component prove, through its contract and `testMachine`, that it
uses the overlay infrastructure correctly — modality, focus, exit animations and a
clean page after closing — and lets consumers prove the same for their wrappers.
## Requirements
### Requirement: Modal Trait

A contract SHALL be able to declare the `modal` trait (which implies the `layer` and
`restores-focus` traits from `add-foundations`). For such contracts the model-based
runner SHALL check after every step, while the component is open: every element
outside the topmost modal layer, its descendant layers and the always-exposed set
is inert; the focused element is inside the topmost modal layer or one of its
descendant layers; the page scroller is locked; `<body>` has no `pointer-events`
style. It SHALL check after every step in which no layer is open that the page is
unlocked and nothing is inert that was not inert before.

#### Scenario: Wrapper breaks inertness

- **WHEN** a consumer wrapper renders a modal component with outside hiding disabled
  and runs `testMachine`
- **THEN** the step that opened it fails, naming an element outside the layer that
  is not inert

### Requirement: DOM Clean After Close

For every contract with the `layer` trait, the runner SHALL snapshot the attributes
and inline styles of `<html>` and `<body>`, and the `inert` and `aria-hidden`
attributes of every element outside the component, before the first step, and SHALL
assert that they equal the snapshot whenever no layer is open. The same check SHALL
run after unmounting the component while it is open, and under React Strict Mode.

#### Scenario: Stuck style

- **WHEN** a component leaves `overflow: hidden` on `<body>` after closing
- **THEN** the step fails, naming `<body>`, the property and both values
  (regression: radix#1241, ark#3842)

#### Scenario: Unmount while open

- **WHEN** a test unmounts a component while its layer is open
- **THEN** the runner asserts the snapshot is restored

### Requirement: Presence Trait

A contract SHALL be able to declare the `presence` trait. For such contracts the
runner SHALL check that, after closing, the content carries `data-state="closed"`
until it is removed; that it is removed once its finite animations have finished;
and that re-opening before removal keeps the same element. In environments without
animations the content SHALL be removed in the closing step.

#### Scenario: Exit never completes

- **WHEN** a component's content stays in the document after its exit animation
  finished
- **THEN** the runner fails the step with the part name and its running animations

### Requirement: Overlay Driver Support

The test drivers SHALL provide, in both the Testing Library and Playwright adapters:
a press outside every open layer at a point that is not on a scrollbar; a press at a
given part's position that reaches whatever element is hit at that point; waiting
until a part is detached; and reading whether an element is inert (computed from
its ancestors). Contracts of overlay components SHALL expose actions to press
Escape, press outside, press Tab and Shift+Tab, and wait for unmount, and queries
for open state, whether focus is inside, and whether the component is the topmost
layer.

#### Scenario: Same driver in jsdom and the browser

- **WHEN** the layer fixture's driver test opens a modal layer, presses outside and
  checks focus restore
- **THEN** it passes unchanged in the browser project and in the jsdom project with
  `@rind-ui/testing/setup`

### Requirement: Simulated DOM Limits Are Explicit

`@rind-ui/testing/setup` SHALL NOT fake `inert`, top-layer behaviour or layout. In
simulated DOMs, the `modal` trait's inertness and scroll-lock checks SHALL verify
the attributes and styles the system sets, and the runner SHALL report that
behavioural inertness (focus and pointer blocking) is only verified in a real
browser.

#### Scenario: jsdom run

- **WHEN** `testMachine` runs a `modal` contract in jsdom
- **THEN** the attribute checks run, and the run's summary states that inert
  behaviour was not exercised

