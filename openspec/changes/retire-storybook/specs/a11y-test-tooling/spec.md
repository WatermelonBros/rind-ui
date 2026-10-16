## MODIFIED Requirements

### Requirement: ARIA Snapshots Per State Story

Every contract state SHALL have a state example on the docs site's examples harness (an
example mapped to that state) that leaves the component in that state; a check SHALL fail
when a contract state has no state example. Playwright SHALL match a partial ARIA snapshot
(role, name and states) for each state example, on the unstyled `none` skin, in Chromium,
Firefox and WebKit, and the same snapshot SHALL be emitted into the component's generated
docs as what assistive technology sees in that state.

#### Scenario: Missing state story

- **WHEN** a contract declares an `open` state and no example is mapped to it
- **THEN** the coverage check fails naming the state

#### Scenario: Structural regression

- **WHEN** a change removes `aria-expanded` from a trigger in the open state example
- **THEN** the snapshot test fails in all three engines
