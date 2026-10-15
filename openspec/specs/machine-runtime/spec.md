# machine-runtime Specification

## Purpose
Defines how every rind-ui component's behaviour is expressed as a statically
declared, fully typed state machine, and how that machine runs without any
framework or DOM, so behaviour is written once and bound by thin adapters.
## Requirements
### Requirement: Static Definitions

A machine definition SHALL declare as data everything that decides which state
comes next: states, the initial state, transitions, targets, guard names and guard
combinators (`and`, `or`, `not`), action names, effect names, delayed transitions,
controllable value bindings and prop-change events. Functions SHALL be allowed only
in named implementations (guards, actions, effects, delays), in the initial-context
factory and in computed values. State names SHALL NOT contain `.` (reserved for a
future hierarchical extension).

#### Scenario: The whole graph is readable from the definition

- **WHEN** a tool reads a machine definition without running it
- **THEN** it can enumerate every state, every transition with its event, target,
  guard and actions, every delayed transition and every prop-driven transition

#### Scenario: Guards combine as data

- **WHEN** a transition requires two guards to pass
- **THEN** it is declared as `{ and: ["a", "b"] }`, not as an inline function

### Requirement: Definitions Are Type-Checked

Names SHALL be inferred from the definition and its implementations, and every
mismatch SHALL be a compile-time error: a target or initial state that is not a
declared state; an event key that is not in the declared event union; an action,
guard, effect or delay name with no implementation; a controllable whose state
binding does not cover every state; a controllable whose prop names do not follow
the `x` / `defaultX` / `onXChange` convention. Events SHALL be a discriminated union
declared once per machine.

#### Scenario: Misspelled target

- **WHEN** a transition targets `"opne"` in a machine whose states are `open` and
  `closed`
- **THEN** the definition does not compile

#### Scenario: Unimplemented action

- **WHEN** a state's `entry` lists an action name that `setup` does not implement
- **THEN** the definition does not compile

### Requirement: Run-To-Completion Sends

Sending an event SHALL be synchronous: when `send` returns, the transition, its exit
actions, transition actions, entry actions, effect cleanups and effect starts have
all run, and the new snapshot is available. An event sent while another is being
processed (from an action or effect) SHALL be queued and processed, in order, before
the outer `send` returns. Subscribers SHALL be notified once per outer `send`, after
all queued events have been processed.

#### Scenario: Two sends in one tick

- **WHEN** a consumer calls `open()` then `close()` synchronously
- **THEN** the machine ends in `closed`, and no event is lost or reordered

#### Scenario: Re-entrant send

- **WHEN** an entry action sends another event
- **THEN** that event is processed after the current step completes and before the
  outer `send` returns, and subscribers are notified once

### Requirement: Snapshots

A service SHALL expose an immutable snapshot containing the current state, the
context and the internal (uncontrolled) values. The snapshot reference SHALL stay
identical until something in it changes. A view built from a snapshot and the
current props SHALL expose resolved controllable values, memoised computed values,
`matches(...states)` and `hasTag(tag)`.

#### Scenario: Stable reference

- **WHEN** `getSnapshot()` is called twice with no event in between
- **THEN** both calls return the same object

#### Scenario: Event that changes nothing

- **WHEN** an event has no transition in the current state
- **THEN** the snapshot reference does not change and subscribers are not notified

### Requirement: Controllable Values

A machine SHALL be able to declare a controllable value `x`, which implies the props
`x`, `defaultX` and `onXChange(value, details)`. Controlled mode SHALL be fixed when
the service is created (`x !== undefined`); switching modes later SHALL emit a
development warning and be ignored. The resolved value SHALL be read from props at
view time when controlled and from internal state when uncontrolled, with no render
of lag. A controllable MAY bind machine states to values, in which case the machine's
state follows the value.

#### Scenario: Uncontrolled change

- **WHEN** an uncontrolled `open` value changes because of an event
- **THEN** the internal value and state change, and `onOpenChange(true, details)` is
  called during that same `send`

#### Scenario: Controlled change is a proposal

- **WHEN** a controlled machine would change `open` because of an event
- **THEN** `onOpenChange` is called, the transition's own actions run (so context
  such as the trigger that opened it is recorded), exit and entry actions do not run,
  and the state does not change until the parent passes the new value through props

#### Scenario: Refused proposal keeps context

- **WHEN** the parent refuses a proposal whose transition actions wrote context
- **THEN** those context writes stay applied and the machine receives `$reverted`

#### Scenario: Parent changes the value

- **WHEN** the parent passes a different controlled `open` value
- **THEN** the machine transitions to the state bound to that value through a
  `$sync` transition, running exits, entries and effects as for any transition

#### Scenario: Parent refuses the change

- **WHEN** `onOpenChange` was called and the next props do not apply the proposed
  value
- **THEN** the machine receives a `$reverted` event for that value

#### Scenario: Mode switch

- **WHEN** a value created uncontrolled later receives a defined `x` prop
- **THEN** a development warning is emitted and the value stays uncontrolled

### Requirement: Read-Only Prop Bindings

A machine SHALL be able to bind its states to a prop that only the parent controls (no
`defaultX`, no `onXChange`), for example `pending` or `invalid`. The state SHALL be
resolved from the prop when the service is created, so the initial snapshot — and a
server render — already reflects it, and SHALL follow later prop changes through a
`$sync` transition that runs exits, entries and effects. Events SHALL NOT be able to
move the machine out of a state bound to the prop's current value, and the binding
SHALL appear in the graph as `$sync:<prop>` edges.

#### Scenario: Pending on first render

- **WHEN** a button bound to `pending` renders on the server with `pending: true`
- **THEN** the snapshot's state is `pending` and no effect has run

#### Scenario: Parent clears the prop

- **WHEN** the parent changes `pending` from `true` to `false`
- **THEN** the machine transitions to `idle` through a `$sync` transition

### Requirement: Change Details

Every `onXChange` callback SHALL receive details carrying the `reason` (the event
type that caused it), the originating event, and `cancel()`. Calling `cancel()`
during the callback SHALL prevent the change in uncontrolled mode and SHALL be
equivalent to the parent refusing it in controlled mode.

#### Scenario: Reason is the event

- **WHEN** a dialog closes because of an `ESCAPE` event
- **THEN** `onOpenChange` receives `details.reason === "ESCAPE"`

#### Scenario: Cancelled change

- **WHEN** the consumer calls `details.cancel()` inside `onOpenChange`
- **THEN** the value and state do not change, and none of the transition's actions
  run

### Requirement: Effects

A state SHALL be able to declare effects that start when the state is entered and
are cleaned up when it is exited. A machine SHALL be able to declare effects that
live for the whole service. An effect SHALL be able to send events and read live
props, context and values; it SHALL NOT write context directly, so every state
change is a declared transition.

#### Scenario: Cleanup on exit

- **WHEN** the machine leaves a state with an effect
- **THEN** the effect's cleanup runs before the next state's entry actions

#### Scenario: Stale reads

- **WHEN** a long-lived effect reads props after the parent changed them
- **THEN** it reads the current props, not the ones from when it started

### Requirement: Delayed Transitions

A state SHALL be able to declare transitions that fire after a named delay. Delays
SHALL be scheduled through the injected scheduler, SHALL be cancelled when the state
is exited, and SHALL be resolved through implementations that may read props.

#### Scenario: Fake timers

- **WHEN** a test uses fake timers and advances past the delay
- **THEN** the delayed transition fires, with no real time elapsed

#### Scenario: Leaving early

- **WHEN** the state is exited before its delay elapses
- **THEN** the delayed transition never fires

### Requirement: Injected Environment

Machines and their implementations SHALL access the outside world only through an
environment passed when the service is created, composed of small capability
interfaces (at least a scheduler and a DOM root accessor). The runtime SHALL NOT fall
back to global `window`, `document` or timers. The scheduler SHALL resolve
`setTimeout` and `requestAnimationFrame` at call time, never at import time.

#### Scenario: Machine test without a DOM

- **WHEN** a machine is run in plain Node with a fake environment
- **THEN** every transition, action and effect runs without touching DOM globals

#### Scenario: Fake timers installed after import

- **WHEN** a test installs fake timers after the module was imported
- **THEN** scheduled work is driven by the fake timers

### Requirement: Service Lifecycle

A service SHALL be created without side effects, SHALL activate the current state's
effects on `start()` and SHALL run every effect cleanup and revoke `send` on
`stop()`. `start()` and `stop()` SHALL be idempotent. A `start()` after `stop()`
SHALL re-activate effects only, without re-running entry actions. A service that is
never started (server rendering) SHALL still produce a correct snapshot reflecting
initial props.

#### Scenario: Strict mode remount

- **WHEN** a service is started, stopped and started again
- **THEN** effects are active exactly once and entry actions ran exactly once

#### Scenario: Server render

- **WHEN** a component renders on the server with `defaultOpen: true`
- **THEN** the snapshot's state is `open` and no effect has run

#### Scenario: Send after stop

- **WHEN** an effect's async callback sends an event after `stop()`
- **THEN** the event is ignored

### Requirement: Inspection

A service SHALL allow subscribing to each processed step (event, source state,
target state, actions run), for devtools and for the model-based test oracle.

#### Scenario: Step log

- **WHEN** an inspector is attached and an event causes a transition
- **THEN** the inspector receives the event, the source and target states and the
  actions that ran

### Requirement: Size Budget

The runtime SHALL be at most 2.5 kB minified and gzipped. Graph extraction and path
generation SHALL NOT be part of `@rind-ui/core`.

#### Scenario: Budget check

- **WHEN** the core package is built
- **THEN** a size check fails the build if the runtime exceeds 2.5 kB min+gz

