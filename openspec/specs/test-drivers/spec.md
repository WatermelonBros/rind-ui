# test-drivers Specification

## Purpose
Defines `@rind-ui/testing`'s drivers and adapters: one typed, behaviour-level test
API generated from each component's contract, which runs unchanged in Testing
Library environments and in Playwright, plus the setup that makes simulated DOMs
work with rind-ui.
## Requirements
### Requirement: Drivers From Contracts

A driver SHALL be created from a contract, a target and the contract's anchor
arguments, and SHALL expose every contract action and query as an asynchronous
method whose name and argument types are inferred from the contract. Nothing
component-specific SHALL be hand-written in `@rind-ui/testing`.

#### Scenario: Typed actions

- **WHEN** a test calls an action name the contract does not declare, or passes an
  argument of the wrong type
- **THEN** the test does not compile

### Requirement: Same Test In Both Environments

The same driver code SHALL run against a Testing Library target (`screen`, a
container, or a DOM environment factory) and a Playwright target (`Page`, `Locator`
or `FrameLocator`); the target type SHALL select the adapter. Moving a test between
environments SHALL change only the target argument.

#### Scenario: Unit test moved to Playwright

- **WHEN** a test written with `screen` is run with `page` instead
- **THEN** it passes or fails for the same behavioural reasons, with no other edit

### Requirement: Modality Selection

A driver SHALL run actions with a default modality and SHALL offer a variant bound to
another modality, limited at compile time to the modalities some action declares.
Running an action with a modality it does not implement SHALL fail with a message
naming the action and the modality; it SHALL NOT fall back silently.

#### Scenario: Keyboard variant

- **WHEN** a test runs `driver.via("keyboard").choose("Italy")`
- **THEN** the keyboard implementation of `choose` is used

#### Scenario: Virtual variant

- **WHEN** a test runs `driver.via("virtual").open()` on an action that only has a
  pointer implementation
- **THEN** the trigger is activated with a bare click and the postcondition is
  checked as usual

#### Scenario: Missing modality

- **WHEN** an action has no touch implementation and is run via touch
- **THEN** it fails naming the action and `touch`

### Requirement: Framework-Neutral DOM Adapter

The DOM adapter SHALL perform actions through Testing Library's configured async and
event wrappers, so framework flushing (for example React's `act`) comes from the
framework's Testing Library package and the adapter contains no framework code. It
SHALL accept a pluggable input implementation (user-event by default, or Vitest
browser mode's), an injected time-advance function for fake timers, and a timeout.
Successive synthetic pointer interactions SHALL use distinct coordinates.

#### Scenario: Fake timers

- **WHEN** a test uses fake timers and passes their advance function to the adapter
- **THEN** actions whose postconditions depend on delays complete

### Requirement: Playwright Adapter Without Runtime Dependency

The Playwright adapter SHALL resolve parts as Playwright locators, match accessible
names exactly, and SHALL NOT import Playwright at runtime.

#### Scenario: Exact names

- **WHEN** two buttons are named "Save" and "Save as"
- **THEN** locating "Save" matches only the first

### Requirement: Optional Peer Dependencies

Testing Library and Playwright SHALL be optional peer dependencies; a project using
only one SHALL NOT need the other installed.

#### Scenario: Playwright-only project

- **WHEN** a project without Testing Library imports the Playwright entry
- **THEN** it loads without errors

### Requirement: Simulated DOM Setup

`@rind-ui/testing/setup` SHALL install, only where missing: `ResizeObserver` and
`IntersectionObserver` (no callbacks), `scrollIntoView` / `scrollTo` / `scrollBy`,
`getAnimations` returning no animations, `PointerEvent`, pointer capture methods,
`matchMedia` (matching nothing) and `visualViewport`. It SHALL NOT fake layout or
focus behaviour. It SHALL reset rind-ui's document-level state after each test when
a global `afterEach` exists, and SHALL export that reset for other runners. In a real
browser it SHALL change nothing.

#### Scenario: jsdom

- **WHEN** a Vitest jsdom project lists the setup in `setupFiles`
- **THEN** rind-ui components open, close and announce without further polyfills

#### Scenario: State does not leak

- **WHEN** a test ends with a component still open
- **THEN** the next test starts with no rind-ui document-level state left over

#### Scenario: Real browser

- **WHEN** the setup runs in Vitest browser mode
- **THEN** no native API is replaced

### Requirement: Pointer Steps, Geometry And Native Values

The test drivers' part handle SHALL offer, in both the Testing Library and the Playwright
adapter:

- `box()`: the part's bounding box in CSS pixels, or `null` when the environment has no
  layout (a zero-size box in jsdom);
- `pointer(phase, { at, pointerType })`: a single `down`, `move` or `up` of a mouse, pen
  or touch pointer at a position given as fractions of the part's box (`{ x, y }`, 0 to
  1), with the same pointer id across one gesture, so a contract can drive each machine
  step of a drag separately;
- `fill(value)`: sets a native input's value through the property setter and dispatches
  bubbling `input` and `change` events, with no key or pointer event, as assistive
  technology does when it adjusts a native range input.

A `pointer` step on a part with no layout SHALL fail with a message saying the step needs
layout.

#### Scenario: Native adjust in both adapters

- **WHEN** a contract calls `fill("35")` on a range input through the DOM adapter and
  through the Playwright adapter
- **THEN** in both the input's value is 35, one `input` and one `change` event were
  dispatched, and no `keydown` was

#### Scenario: Pointer step without layout

- **WHEN** `pointer("down", { at: { x: 0.5, y: 0.5 } })` runs in jsdom
- **THEN** it rejects saying the step needs layout

#### Scenario: Box in a browser

- **WHEN** `box()` runs on a 200×20 px part in Vitest browser mode
- **THEN** it returns width 200 and height 20

### Requirement: Paste Input

Both adapters SHALL offer a `paste(text)` input to the focused element that dispatches a
real paste: a `paste` `ClipboardEvent` whose `clipboardData` is a `DataTransfer` holding
`text` as `text/plain`, followed, only when that event was not cancelled, by the browser's
own text insertion (`beforeinput` / `input` with `inputType` `insertFromPaste`). The DOM
adapter SHALL perform it through its configured input implementation and Testing Library's
async wrappers; the Playwright adapter SHALL dispatch the same events without importing
Playwright at runtime. `@rind-ui/testing/setup` SHALL install `ClipboardEvent` and
`DataTransfer` only where missing (jsdom), and in a real browser SHALL change nothing.

#### Scenario: Cancelled paste inserts nothing

- **WHEN** a test calls `paste("a, b")` on a focused text input whose `paste` handler reads
  `clipboardData.getData("text/plain")` and calls `preventDefault()`
- **THEN** the handler receives "a, b", and no `beforeinput` or `input` event follows, so the
  input's value is unchanged

#### Scenario: Plain paste inserts the text

- **WHEN** a test calls `paste("hello")` on a focused empty text input with no paste handler,
  in jsdom with the setup in `setupFiles` and in Playwright
- **THEN** in both environments the input receives `beforeinput` and `input` with
  `inputType` "insertFromPaste" and its value is "hello"

