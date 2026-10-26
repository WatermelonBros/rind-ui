## Context

Research: [docs/research/timer.md](../../../docs/research/timer.md). Zag's timer accumulates
`deltaMs` from a requestAnimationFrame interval, rounds each delta down to the interval, hides
inapplicable action buttons and goes back to `idle` on completion. Each of those is a recorded
bug or a keyboard trap. rind-ui's machines get time only through injected capabilities:
`Clock` (monotonic `now()`), `Scheduler`, `PageVisibility`, `Announcer`, `LocaleSource`.

## Goals / Non-Goals

Goals: a countdown and a stopwatch that are right after a background tab, a sleep or a slow
frame; never past the target; controls that keep focus; a time screen readers read in words.

Non-goals: wall-clock targets, laps, sound, persistence, a controlled `value`.

## Decisions

### 1. Value derived from the clock

Context: `base` (the value in ms when the current run started), `startedAt` (`clock.now()` at
that moment) and `value` (the last computed value). While `running`,

```
value = clamp(base + sign × (clock.now() − startedAt))     sign = countdown ? −1 : +1
```

clamped to `[target, start]` for a countdown and `[start, target]` for a stopwatch (no upper
bound without a target). Nothing is accumulated: a missed or late tick costs no time (zag#2226,
ark#3298). `pause` captures `value` into `base`; `resume` takes a new `startedAt`.

### 2. Ticks aligned to the interval

The `ticking` effect (state `running`) schedules one `Scheduler.setTimeout` for the value's
next interval boundary in the counting direction (`interval − value mod interval` counting up,
`value mod interval` or a whole interval counting down), so the display changes on the second
even after a pause mid-interval; it sends `TICK`,
which recomputes `value`, calls `onTick`, and re-enters the effect. One effect, owned by the
state: re-renders cannot start a second one (zag#2335). The cleanup clears it (zag#3365).

With a target, the wait is at most the distance to it, so completion never waits a whole
interval past the target.

### 3. Display rounding

The displayed time is `value` rounded **toward the start** to the interval: up for a countdown
(a 10 s countdown shows 10 until a full second has gone, and 0 only when complete), down for a
stopwatch. `time` (days, hours, minutes, seconds, milliseconds) is computed from that rounded
value; each unit is formatted with `Intl.NumberFormat(locale, { minimumIntegerDigits: 2 })`
(milliseconds 3).

### 4. Completion

`TICK` (or `COMPLETE` from the completion timeout) with `value` at the target (`<=` for a
countdown, `>=` for a stopwatch: zag#2254) goes to `completed`: `value` is the target,
`onComplete()` is called once and `messages.completed` is announced politely. A stopwatch
without a target never completes.

`PageVisibility`: when the page becomes visible while `running`, the machine sends `TICK` at
once, so a completion that a throttled background timer delayed fires when the user comes
back, not on the next throttled slot (zag#2549).

### 5. States and actions

| State | start | pause | resume | reset | restart | toggle |
|---|---|---|---|---|---|---|
| idle | → running | – | – | (value = start) | → running from start | → running |
| running | – | → paused | – | → idle, value = start | → running from start | → paused |
| paused | – | – | → running | → idle, value = start | → running from start | → running |
| completed | – | – | – | → idle, value = start | → running from start | → running from start |

`–`: the action is not applicable; its trigger is `disabled` (focusable, `aria-disabled`,
`data-disabled`), never hidden, so focus stays (research: focus loss). `autoStart` starts in
`running`.

### 6. Prop changes (`onProps`)

`startMs`, `targetMs`, `countdown` change → event `CONFIG`: in `idle` and `completed` the
value becomes the new start (state `idle`); in `running` it restarts from the new start; in
`paused` the value becomes the new start and it stays paused (zag#2262). `interval` change →
the ticking effect re-enters. Invalid configurations (negative values, a countdown whose start
is not above its target, a stopwatch whose start is not below its target, a non-positive
interval) warn once in development and are normalised: values clamped at 0, interval 1000,
target ignored when on the wrong side.

### 7. Accessibility

- `Area`: `role="timer"` (implicit `aria-live="off"`), `aria-atomic="true"`, `aria-label` =
  `messages.label(duration)`: the rounded duration in words from
  `Intl.DurationFormat(locale, { style: "long" })`, units from the largest non-zero one to
  seconds ("1 hour, 0 minutes, 5 seconds" collapses zero units except the last: "1 hour,
  5 seconds"); `messages.duration` builds it where the engine lacks `DurationFormat`.
- `Separator`: `aria-hidden="true"`. `Item`, `ItemValue`, `ItemLabel`: no role.
- `ActionTrigger`: `button-like-element`, `type="button"`; its accessible name is its children;
  without children it renders its word from messages (`toggle`: "Start", "Pause" or "Resume"
  by state; the others `messages[action]`), so no trigger is ever nameless; the render state
  gives `{ action, label, disabled }`.
- Announcements: only completion (`messages.completed`), polite, keyed by instance.

### 8. Parts, attributes, theme

Every part: `data-scope="timer"`, `data-part`, `data-instance`, `data-state` (`idle`,
`running`, `paused`, `completed`). `Item` / `ItemValue` / `ItemLabel`: `data-type`. `Root`:
`--rind-timer-progress` (0–1; 0 without a target), `data-countdown` when counting down.
`ActionTrigger`: `data-action`, `data-disabled`.

Theme: family `decoration` (no variant, no size; tokens `--rind-timer-*`). The action triggers
are styled as buttons by `button.css` (family `action`: "triggers styled as buttons").
`timer.css`: tabular figures, the Area as a row of items and separators, item labels small and
muted, `completed` tinted with the accent.

### 9. Contract and driver

Anatomy from the parts; locate the Area by role `timer`. Actions `start`, `pause`, `resume`,
`reset`, `restart`, `toggle` (press the matching trigger). Queries `state` (`data-state` of the
Root), `label` (the Area's accessible name), `text` (the Area's text). Invariants: one
`role="timer"` per instance; no trigger hidden; disabled triggers match the table of §5.

### 10. Tests

Node: the machine with a virtual clock and scheduler: counting both ways, alignment, pause /
resume preserves time, a 60 s gap (background) is caught up exactly, completion once and never
past, `PageVisibility` catch-up, prop changes in every state, invalid configurations, cleanup.
DOM (jsdom and three engines): anatomy, names, disabled triggers keep focus, announcement,
localisation (`ar-EG` digits, `it` words), SSR + hydration. Model-based over the state table.

## Risks / Trade-offs

- A throttled background tab can delay `onComplete` until the page is visible again or the
  throttled timeout fires. Acceptable: the value is always right, and the alternative (a
  worker timer) is out of scope.
- `Intl.DurationFormat` is recent; the messages fallback covers older engines.
