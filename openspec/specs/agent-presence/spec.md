# agent-presence Specification

## Purpose
TBD - created by archiving change add-agent-presence. Update Purpose after archive.
## Requirements
### Requirement: Agent Presence Anatomy

Agent Presence SHALL consist of a `Root` with optional `Visual`, `Status`, `Label` and
`Detail`. `Visual` SHALL be `aria-hidden="true"`. The Root SHALL have no role. Without a
composed `Status`, the Root SHALL render a visually hidden one.

#### Scenario: The picture is hidden, the state is text

- **WHEN** an Agent Presence with a Visual is `listening`
- **THEN** the Visual is hidden from assistive technology and the text "Listening" is in the
  page

### Requirement: Agent Presence States

The state SHALL be the `state` prop (`idle`, `connecting`, `listening`, `thinking`,
`speaking`, `error`), any state following any other; `onStateChange(state, { from })` SHALL be
called on each change.

#### Scenario: Skipping thinking (regression: livekit/agents#3007)

- **WHEN** the state goes `listening` then `speaking`
- **THEN** both changes are reported and nothing waits for `thinking`

### Requirement: Agent Presence Announcements

With `announce` not `"off"`, the first `listening` after `connecting` SHALL announce
`messages.listening` politely, `thinking` SHALL announce `messages.thinking` politely only once
it has lasted `thinkingDelay` (default 1500 ms), `idle` after a session SHALL announce
`messages.ended`, and `error` SHALL announce `messages.error(reason)` assertively. `speaking`
and the level SHALL never be announced.

#### Scenario: A short think is silent

- **WHEN** the state is `thinking` for 800 ms and then `speaking`
- **THEN** nothing is announced for `thinking`

### Requirement: Agent Presence Staleness

When `staleAfter[state]` is given and the state lasts that long, every part SHALL carry
`data-stale` and `onStale(state)` SHALL be called once; a state change SHALL clear it.

#### Scenario: Stuck thinking (regression: livekit/agents#8027)

- **WHEN** `staleAfter.thinking` is 10000 and the state stays `thinking` 10 s
- **THEN** `onStale("thinking")` was called and the Root has `data-stale`

### Requirement: Agent Presence Level

While `listening` (input) or `speaking` (output), with motion allowed and the page visible, the
level from `getLevel(channel)` SHALL be clamped to 0–1, smoothed, and written each frame to
`--rind-agent-presence-level` on the Root without rendering; `data-level` (`0`–`3`) SHALL update
at most every 250 ms. Otherwise the level SHALL be 0 and no frame loop SHALL run.

#### Scenario: Reduced motion stops the loop (WCAG 2.2.2)

- **WHEN** the user prefers reduced motion and the agent is speaking
- **THEN** no animation frame is requested and `data-level` is `0`

### Requirement: Agent Presence Data Attributes

Every part SHALL carry `data-scope="agent-presence"`, `data-part`, `data-instance`,
`data-state`, `data-previous-state`, and when they apply `data-muted`, `data-stale`, and
`data-motion` (`full`, `reduced`, `off`); `Detail` SHALL carry `data-reason`.

#### Scenario: Muted

- **WHEN** `muted` is true
- **THEN** the Root has `data-muted`

### Requirement: Agent Presence Messages

The strings SHALL come from `messages`: `status(state)` (a word per state), `listening`, `thinking`,
`ended`, `error(reason)`, with English defaults.

#### Scenario: Localised status

- **WHEN** `messages.status` returns "In ascolto" for `listening`
- **THEN** the Status reads "In ascolto"

### Requirement: Agent Presence Contract

The contract SHALL locate the component by its scope and provide the queries `state`,
`statusText`, `isStale` and `level`.

#### Scenario: Driver

- **WHEN** the state prop is `thinking`
- **THEN** `getAgentPresence(root).state()` is `thinking`

### Requirement: Agent Presence Theme

`@rind-ui/theme` SHALL draw an empty Visual as a glass orb with a ribbon of coloured light
that follows `--rind-agent-presence-level` while listening or speaking, with a distinct shape
and motion per state (not colour alone), and every state's shape kept, still, under reduced
motion.

#### Scenario: Thinking looks different

- **WHEN** the state is `thinking`
- **THEN** the Visual's shape differs from `listening`'s

#### Scenario: Speaking looks different

- **WHEN** the state is `speaking`
- **THEN** the Visual's shape differs from `listening`'s

