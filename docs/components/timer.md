# Timer

A countdown or a stopwatch with start, pause, resume, reset and restart controls. The time comes from the environment's monotonic clock, never from adding up ticks, so it is right after a slow frame, a sleeping laptop or a background tab, and a countdown completes exactly at its target, never past it. The time is a `role="timer"` region that screen readers read on demand, in words; completion is announced ("Time's up").

## When to use

- **Use it for** a time the user watches: an exam or quiz countdown, a reservation hold, an auction's end, a workout interval, a stopwatch.
- **Over `setInterval` in app code**: it does not drift or stop in a background tab (zag#2226), it does not overshoot or go negative (zag#2254), it restarts when its start changes (zag#2262), its controls never disappear under the keyboard focus, and its digits and words follow the locale.
- **Don't use it for** a date or a time of day ([Date Field](date-field.md)), or a progress whose duration is unknown ([Progress](progress.md)).

```tsx
import { Timer } from "@rind-ui/react"

<Timer.Root countdown startMs={5 * 60_000} onComplete={submit}>
  <Timer.Area>
    <Timer.Item type="minutes">
      <Timer.ItemValue type="minutes" />
    </Timer.Item>
    <Timer.Separator>:</Timer.Separator>
    <Timer.Item type="seconds">
      <Timer.ItemValue type="seconds" />
    </Timer.Item>
  </Timer.Area>
  <Timer.Control>
    <Timer.ActionTrigger action="toggle">
      {({ label }) => label}
    </Timer.ActionTrigger>
    <Timer.ActionTrigger action="reset">Reset</Timer.ActionTrigger>
  </Timer.Control>
</Timer.Root>
```

A stopwatch is the same without `countdown`; give it a `targetMs` to stop at one.

## API

<!-- api:timer -->

## Anatomy

| Part | `data-part` | Element |
|---|---|---|
| `Timer.Root` | `root` | `<div>`; holds the timer; `--rind-timer-progress` (0–1 from start to target). |
| `Timer.Area` | `area` | `<div role="timer">`, named by the time in words. |
| `Timer.Control` | `control` | `<div>`; groups the ActionTriggers. |
| `Timer.Item` | `item` | `<div>`; one unit (`type`: days, hours, minutes, seconds, milliseconds). |
| `Timer.ItemValue` | `item-value` | `<span>`; the unit in the locale's digits ("05"), unless it has children. |
| `Timer.ItemLabel` | `item-label` | `<span>`; a visible caption ("min"). |
| `Timer.Separator` | `separator` | `<span aria-hidden="true">`; its children (":"). |
| `Timer.ActionTrigger` | `action-trigger` | `<button type="button">`; runs `action`. |

Every part carries `data-state` (`idle`, `running`, `paused`, `completed`); the unit parts `data-type`, the triggers `data-action` and `data-disabled`, the Root `data-countdown`.

## States and actions

| State | start | pause | resume | reset | restart | toggle |
|---|---|---|---|---|---|---|
| `idle` | runs | – | – | to the start | runs from the start | runs |
| `running` | – | pauses | – | to the start, idle | runs from the start | pauses |
| `paused` | – | – | runs | to the start, idle | runs from the start | runs |
| `completed` | – | – | – | to the start, idle | runs from the start | runs from the start |

An action that does nothing now (`–`) leaves its trigger **disabled but focusable**: it is never hidden, so a keyboard user who presses Start keeps the focus on it. For a single play/pause button use `action="toggle"`; its render state gives the right word (`label`: "Start", "Pause", "Resume").

## Timing

- The value is `start ± (clock now − run start)`: missed or late ticks cost no time.
- Ticks fire on the value's next whole `interval` (default 1000 ms), so the display changes on the second, also after a pause mid-second.
- A countdown shows its time rounded up (10 until a full second has gone, 0 only when complete); a stopwatch rounded down.
- A countdown completes at the exact remaining time; when the page comes back from the background, a late completion fires at once.
- A change of `startMs`, `targetMs` or `countdown` applies the new start: a running timer restarts from it, a paused or idle one shows it.

## Keyboard

| Key | Action |
|---|---|
| Enter, Space | On an ActionTrigger: runs its action. |

## Accessibility notes

- **Read on demand, not every second.** The Area is `role="timer"`, whose live region is off: a screen reader is not interrupted each second. It is named by the time in words ("1 minute, 5 seconds", from `Intl.DurationFormat`), never "zero one colon zero five".
- **Completion is announced** politely ("Time's up", `messages.completed`); nothing else is.
- **Focus stays.** Triggers are never hidden by the state; inapplicable ones are `aria-disabled`.
- **Timing adjustable (WCAG 2.2.1).** If your page has a time limit, render pause and resume (or toggle) so the user can stop it.

## Testing

```tsx
import { getTimer } from "@rind-ui/testing"

render(<Quiz />)
const timer = getTimer(screen)
await timer.start()
expect(await timer.state()).toBe("running")
await timer.pause()
expect(await timer.label()).toBe("5 minutes")
```

Contract actions: `start`, `pause`, `resume`, `reset`, `restart`, `toggle`. Queries: `state`, `label` (the time in words), `text`.

## Tested with

<!-- tested-with:timer -->
_No manual screen-reader pass recorded yet._
<!-- /tested-with -->
