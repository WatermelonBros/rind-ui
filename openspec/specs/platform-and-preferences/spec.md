# platform-and-preferences Specification

## Purpose
Defines the injected platform and user-preference capabilities — which platform the
code runs on and whether the user asked for reduced motion — so machines, keyboard
mapping and quirk gating decide on them without reading globals, and tests can run
every platform.
## Requirements
### Requirement: Injected Platform

The environment SHALL expose the platform as read-only flags (at least `apple`,
`mac`, `ios`, `android`, `windows`, `webkit`, `chromium`, `firefox`), detected once
from the user agent data in the browser and overridable at environment creation.
Machines, keyboard mapping, the announcer and quirk conditions SHALL read the platform
only through this capability.

#### Scenario: Tests run both platforms

- **WHEN** a test creates one environment with an Apple platform and one with Windows
- **THEN** `mod` resolves to Meta in the first and Control in the second, with no user
  agent stubbing

#### Scenario: iPadOS reporting a desktop user agent

- **WHEN** an iPad reports a macOS user agent and has touch points
- **THEN** the platform has `ios` and `apple` set

### Requirement: Rendering Engine

The platform SHALL include `engine`, the rendering engine (`"webkit"`, `"blink"` or
`"gecko"`), detected once with the other flags (user agent data brands first, the user
agent string otherwise) and overridable at environment creation. On iOS and iPadOS the
engine SHALL be `webkit` whatever the browser. The `webkit`, `chromium` and `firefox`
flags SHALL agree with it (`webkit` ⇔ `engine === "webkit"`, `chromium` ⇔ `"blink"`,
`firefox` ⇔ `"gecko"`). Every platform preset exported from `@rind-ui/testing` SHALL
carry an engine (the Apple preset `webkit`), and a test SHALL be able to override the
engine of a preset, so quirks that differ between VoiceOver in Safari and in Chrome
(RA PR #10503, RA#10326) are testable on one OS.

#### Scenario: Chrome on macOS

- **WHEN** the environment is detected in Chrome on macOS
- **THEN** the platform has `apple` and `mac` set, `engine` is `"blink"`, `chromium` is
  true and `webkit` is false

#### Scenario: Chrome on iOS

- **WHEN** the environment is detected in Chrome on an iPhone
- **THEN** `engine` is `"webkit"` and `ios` and `apple` are set

#### Scenario: Engine override in a test

- **WHEN** a test creates an environment from the Apple preset with `engine: "blink"`
- **THEN** `apple` is set, `engine` is `"blink"`, and quirk conditions see the Blink
  engine

### Requirement: Reduced Motion Preference

The environment SHALL expose `reducedMotion()` and a subscription to its changes,
following `prefers-reduced-motion` unless overridden. JavaScript-driven motion in
rind-ui (smooth scrolling, autoplay, inertia, stick-to-bottom scrolling) SHALL be
instant or off while it returns true. Presence SHALL complete when no animation is
running.

#### Scenario: Smooth scroll

- **WHEN** rind-ui scrolls a focused item into view while `reducedMotion()` is true
- **THEN** it uses instant scrolling

#### Scenario: Preference changes at runtime

- **WHEN** the user turns on reduced motion while the page is open
- **THEN** subscribers are notified and the next scroll is instant

### Requirement: Document Style Injection

`@rind-ui/core` SHALL provide one helper, `core/dom/inject-style.ts`, that inserts a rule
set into a document at most once per document and rule-set id: a `<style>` element in the
document's `head`, marked with the id, wrapped in an anonymous cascade layer so any
consumer rule wins, and carrying the environment's CSP nonce (`StyleInjection.nonce`, as
both the property and the attribute) when one is set. Calling it again for the same
document and id SHALL do nothing; each document (an iframe, a popup window) SHALL get its
own element; without a document (server rendering) it SHALL do nothing. The test reset
SHALL remove every element it inserted. Every rule set rind-ui injects (the `touch-action`
rule of `press-interactions`, and the rule sets of later components such as Scroll Area
and Number Input) SHALL go through this helper; no module SHALL create its own `<style>`
element.

#### Scenario: Injected once per document

- **WHEN** two pressable parts mount in the same document and a third mounts in an iframe
- **THEN** the main document has exactly one `touch-action` style element and the iframe
  has its own one

#### Scenario: CSP nonce

- **WHEN** the environment is created with the style nonce "abc" and a rule set is injected
- **THEN** the inserted `<style>` element carries `nonce="abc"`

#### Scenario: Server rendering

- **WHEN** the helper is called where no document exists
- **THEN** nothing is inserted and nothing throws

