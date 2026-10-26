# timer Specification

## Purpose
TBD - created by archiving change add-timer. Update Purpose after archive.
## Requirements
### Requirement: Timer Anatomy

A Timer SHALL consist of `Root` and `Area`, with optional `Control`, `Item`, `ItemValue`,
`ItemLabel`, `Separator` and `ActionTrigger`. The `Area` SHALL have `role="timer"` and
`aria-atomic="true"`, and SHALL NOT override `aria-live`. `Separator` SHALL be
`aria-hidden="true"`. `ActionTrigger` SHALL be a native `<button type="button">` carrying an
`action` of `start`, `pause`, `resume`, `reset`, `restart` or `toggle`. `Item`, `ItemValue`
and `ItemLabel` SHALL carry a `type` of `days`, `hours`, `minutes`, `seconds` or
`milliseconds`. Every part SHALL accept the framework's element-substitution prop.

#### Scenario: One timer region

- **WHEN** a Timer with an Area, three Items and two Separators is rendered
- **THEN** exactly one element has `role="timer"`, and the separators are hidden from the
  accessibility tree

#### Scenario: Trigger inside a form

- **WHEN** an ActionTrigger of a Timer inside a `<form>` is pressed
- **THEN** the form is not submitted

### Requirement: Timer States

The Timer SHALL be in one of `idle`, `running`, `paused` and `completed`, starting in `idle`,
or in `running` when `autoStart` is true. The actions SHALL move it as follows: `start` from
`idle` to `running`; `pause` from `running` to `paused`; `resume` from `paused` to `running`;
`reset` from any state to `idle` with the value at the start; `restart` from any state to
`running` from the start; `toggle` from `idle`, `paused` or `completed` to `running` (from the
start when `completed`) and from `running` to `paused`. Any other action SHALL do nothing.
`onStateChange(state)` SHALL be called on each change.

#### Scenario: Pause keeps the time

- **WHEN** a stopwatch runs for 3500 ms of the clock, is paused, 10 000 ms pass, and it is
  resumed for 500 ms more
- **THEN** its value is 4000 ms

#### Scenario: Toggle after completion

- **WHEN** a completed countdown's `toggle` trigger is pressed
- **THEN** the countdown runs again from its start

### Requirement: Timer Timing

While `running`, the value SHALL be computed from the injected monotonic Clock as the value
at the run's start plus (stopwatch) or minus (countdown) the clock time elapsed since then,
clamped between the start and the target. Elapsed time SHALL NOT be accumulated from tick
intervals. Ticks SHALL be scheduled on the injected Scheduler at the value's next multiple of
`interval` (default 1000 ms) in the counting direction; each tick SHALL call `onTick({ value, time })`.
Exactly one tick SHALL be pending per running timer.

#### Scenario: A background gap is caught up (regression: zag#2226, ark#3298)

- **WHEN** a stopwatch has run for 2000 ms and the next tick only fires after 62 000 ms more
  of the clock (a throttled background tab)
- **THEN** that tick reports a value of 64 000 ms, not 3000 ms

#### Scenario: No drift

- **WHEN** a stopwatch with `interval` 1000 runs while every tick fires 7 ms late for 600
  ticks
- **THEN** the value equals the clock's elapsed time, and each tick is scheduled for the
  value's next whole second

#### Scenario: One ticking loop (regression: zag#2335)

- **WHEN** the component re-renders ten times while running
- **THEN** exactly one tick is pending on the scheduler

### Requirement: Timer Completion

A countdown SHALL complete when its value reaches its target (`targetMs`, default 0); a
stopwatch SHALL complete when its value reaches `targetMs`, and SHALL never complete without
one. Reaching SHALL be tested with `<=` (countdown) or `>=` (stopwatch). On completion the
value SHALL be the target exactly, the state `completed`, `onComplete()` SHALL be called once,
and `messages.completed` SHALL be announced politely. A countdown SHALL schedule its
completion for the exact remaining time when it is shorter than the next tick. When the page
becomes visible while the timer runs, the timer SHALL recompute at once.

#### Scenario: Never past the target (regression: zag#2254, zag#2549)

- **WHEN** a 5000 ms countdown's next tick fires 9000 ms after it started
- **THEN** the state is `completed`, the value is 0, and `onComplete` was called once

#### Scenario: Completion without waiting a whole interval

- **WHEN** a countdown with `startMs` 2500 and `interval` 1000 starts
- **THEN** it completes 2500 ms of the scheduler later, not 3000 ms

#### Scenario: Coming back to the tab

- **WHEN** a countdown's completion time passes while the page is hidden and no scheduled
  callback has run, and the page becomes visible
- **THEN** the timer completes immediately and "Time's up" is announced

### Requirement: Timer Action Triggers

An ActionTrigger whose action does nothing in the current state SHALL be disabled
(`aria-disabled="true"`, `data-disabled`) and SHALL stay rendered and focusable; core SHALL
never hide a trigger. A press on a disabled trigger SHALL do nothing.

#### Scenario: Focus stays on Start (regression: Zag hides it)

- **WHEN** the keyboard focus is on the `start` trigger and Enter is pressed
- **THEN** the timer runs, the focus is still on that trigger, and it is disabled

### Requirement: Timer Configuration Changes

A change of `startMs`, `targetMs` or `countdown` SHALL apply the new start: from `idle` or
`completed` the value SHALL become the new start in `idle`; from `running` the timer SHALL
restart from the new start; from `paused` the value SHALL become the new start and stay
paused. A change of `interval` SHALL reschedule the pending tick. An invalid configuration (a
negative time, a non-positive interval, a countdown start not above its target, a stopwatch
start not below its target) SHALL be normalised and warned once in development, never thrown.

#### Scenario: New start while running (regression: zag#2262)

- **WHEN** a running countdown's `startMs` changes from 60 000 to 30 000
- **THEN** it keeps running and shows 30 seconds

### Requirement: Timer Display

The displayed time SHALL be the value rounded toward the start to the interval (up for a
countdown, down for a stopwatch), split into days, hours, minutes, seconds and milliseconds.
`ItemValue` SHALL render its unit with the locale's digits and at least two digits
(milliseconds three). The `Area`'s accessible name SHALL be `messages.label` of the displayed
duration in words for the component's locale (`Intl.DurationFormat` long style when
available, `messages.duration` otherwise), omitting zero units except when all are zero.

#### Scenario: A countdown does not show zero early

- **WHEN** a 10 000 ms countdown has run 9400 ms
- **THEN** its seconds item shows "01" and the Area is named "1 second"

#### Scenario: Localised digits

- **WHEN** a Timer with locale `ar-EG` shows 5 seconds
- **THEN** its seconds item renders "٠٥"

### Requirement: Timer Data Attributes

Every part SHALL carry `data-scope="timer"`, `data-part`, `data-instance` and `data-state`.
`Item`, `ItemValue` and `ItemLabel` SHALL carry `data-type`; `ActionTrigger` SHALL carry
`data-action`. `Root` SHALL carry `data-countdown` for a countdown and set
`--rind-timer-progress` to the fraction of the way from start to target (0 without a target).

#### Scenario: Progress

- **WHEN** a 60 000 ms countdown shows 15 seconds
- **THEN** `--rind-timer-progress` on the Root is 0.75

### Requirement: Timer Messages

The Timer's strings SHALL come from `messages`: `label(duration)`, `duration(time)` (the
fallback words), `completed`, `start`, `pause`, `resume`, `reset`, `restart`. English defaults
SHALL be provided and every string SHALL be replaceable.

#### Scenario: Localised completion

- **WHEN** a Timer with `messages.completed` "Tempo scaduto" completes
- **THEN** "Tempo scaduto" is announced

### Requirement: Timer Contract

The Timer contract SHALL locate the Area by role `timer`, provide the actions `start`,
`pause`, `resume`, `reset`, `restart`, `toggle` and the queries `state`, `label` and `text`,
and SHALL check the invariants: one timer region per instance, no hidden trigger, and each
trigger's disabled state matching the current state.

#### Scenario: Driver round trip

- **WHEN** a test calls `getTimer(root).start()` then `.pause()`
- **THEN** `.state()` is `paused`

### Requirement: Timer Theme

`@rind-ui/theme` SHALL style the Timer in the `decoration` family through `--rind-timer-*`
tokens with tabular figures, style its ActionTriggers as buttons, and mark the `completed`
state with the accent colour at 4.5:1 text contrast in light and dark.

#### Scenario: Triggers look like buttons

- **WHEN** a themed Timer renders its `start` ActionTrigger
- **THEN** it has the Button's background, radius and height

