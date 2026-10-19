## ADDED Requirements

### Requirement: Anatomy

A Reasoning SHALL consist of `Root`, `Trigger` and `Content`. `Trigger` SHALL be a
`<button type="button">` with `aria-expanded`, and `aria-controls` only while `Content` is
rendered. `Content` SHALL be hidden while closed. Every part SHALL accept the `render` prop.

#### Scenario: Disclosure

- **WHEN** a closed Reasoning is rendered
- **THEN** the Trigger has `aria-expanded="false"` and no dangling `aria-controls`

### Requirement: Automatic Opening And Closing

On a live start of thinking (the `thinking` prop turns true after mount), the Reasoning
SHALL open, unless the user has toggled it. On a live end, it SHALL close
`autoCloseDelay` ms later (default 1000), unless the user has toggled it or focus is inside
`Content`. A Reasoning that mounts thinking or done SHALL NOT toggle by itself. Once the
user toggles, it SHALL never toggle automatically again.

#### Scenario: Live lifecycle

- **WHEN** `thinking` turns true, then false, and 1000 ms pass on the virtual clock
- **THEN** the Reasoning opened, then closed

#### Scenario: Old message (AI Elements #86)

- **WHEN** a Reasoning mounts with `thinking` false and `defaultOpen` false
- **THEN** it stays closed and announces nothing

#### Scenario: The user wins

- **WHEN** the user opens it while it thinks and thinking ends
- **THEN** it stays open

#### Scenario: Focus inside

- **WHEN** focus is on a link inside Content when the auto-close delay ends
- **THEN** it stays open

### Requirement: Duration

The duration SHALL be the `duration` prop (seconds) when given, else the time measured with
the Environment's Clock between the live start and end, rounded up. A Reasoning mounted
done with no `duration` SHALL have an unknown duration.

#### Scenario: Measured

- **WHEN** thinking lasts 11.2 s on the virtual clock
- **THEN** the Trigger reads "Thought for 12 seconds"

### Requirement: Announcements

With `announce` (default true), the Reasoning SHALL announce `messages.thinking` on a live
start and `messages.thought(duration)` on a live end, politely, keyed per instance. While
thinking, `Content` SHALL carry `aria-busy="true"`. The trace itself SHALL never be
announced.

#### Scenario: Two announcements

- **WHEN** a Reasoning thinks for 3 s while its content grows
- **THEN** exactly "Thinking…" and "Thought for 3 seconds" are announced

### Requirement: Data Attributes

Every part SHALL carry `data-scope="reasoning"`, `data-part`, `data-instance`, `data-state`
(`open` / `closed`), and `data-thinking` while thinking.

#### Scenario: Thinking attribute

- **WHEN** the model is thinking
- **THEN** every part carries `data-thinking`

### Requirement: Contract

The Reasoning SHALL ship `reasoningContract`, located by the Trigger's role and name, with
the action `toggle`, the queries `isOpen`, `isThinking` and `triggerText`, and a
`getReasoning` driver.

#### Scenario: Driver

- **WHEN** a test calls `toggle()` on a closed Reasoning
- **THEN** `isOpen()` is true

### Requirement: Theme

`@rind-ui/theme` SHALL ship `reasoning.css` in `@layer rind.components` with `:where()`
selectors, family `decoration`. Its shimmer SHALL stop under `prefers-reduced-motion`.

#### Scenario: Reduced motion

- **WHEN** reduced motion is preferred
- **THEN** the Trigger text does not animate
