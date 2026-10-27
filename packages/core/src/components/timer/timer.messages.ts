// Timer's strings: every text that reaches assistive technology (spec "Timer Messages").

import type { TimerTime } from "./timer.format"

export interface TimerMessages {
  readonly [key: string]: string | ((...args: never) => string)
  /** The Area's name, from the spoken duration ("1 minute, 5 seconds"). */
  readonly label: (duration: string) => string
  /** The spoken duration where the engine has no `Intl.DurationFormat`. */
  readonly duration: (time: TimerTime) => string
  /** Announced when the timer completes. */
  readonly completed: string
  readonly start: string
  readonly pause: string
  readonly resume: string
  readonly reset: string
  readonly restart: string
}

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`

export const timerMessages: TimerMessages = {
  label: (duration) => duration,
  duration: (t) => {
    const units = [
      plural(t.days, "day"),
      plural(t.hours, "hour"),
      plural(t.minutes, "minute"),
      plural(t.seconds, "second"),
    ].filter((_, i) => [t.days, t.hours, t.minutes, t.seconds][i] !== 0)
    return units.length > 0 ? units.join(", ") : plural(0, "second")
  },
  completed: "Time's up",
  start: "Start",
  pause: "Pause",
  resume: "Resume",
  reset: "Reset",
  restart: "Restart",
}
