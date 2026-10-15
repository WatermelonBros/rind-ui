## ADDED Requirements

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
