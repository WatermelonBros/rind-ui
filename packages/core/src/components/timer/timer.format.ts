// Timer display (add-timer design §3, §7): the time split into units, each unit in the
// locale's digits, and the duration in words for the Area's name.

import type { TimerMessages } from "./timer.messages"

export interface TimerTime {
  readonly days: number
  readonly hours: number
  readonly minutes: number
  readonly seconds: number
  readonly milliseconds: number
}

export type TimerUnit = keyof TimerTime

export const TIMER_UNITS: readonly TimerUnit[] = [
  "days",
  "hours",
  "minutes",
  "seconds",
  "milliseconds",
]

export function toTime(ms: number): TimerTime {
  const t = Math.max(0, Math.round(ms))
  return {
    days: Math.floor(t / 86_400_000),
    hours: Math.floor(t / 3_600_000) % 24,
    minutes: Math.floor(t / 60_000) % 60,
    seconds: Math.floor(t / 1000) % 60,
    milliseconds: t % 1000,
  }
}

const numberFormats = new Map<string, Intl.NumberFormat>()

/** One unit with the locale's digits, at least two digits (milliseconds three). */
export function formatTimerUnit(time: TimerTime, unit: TimerUnit, locale: string): string {
  const key = `${locale}|${unit}`
  let format = numberFormats.get(key)
  if (!format) {
    format = new Intl.NumberFormat(locale, {
      minimumIntegerDigits: unit === "milliseconds" ? 3 : 2,
      useGrouping: false,
    })
    numberFormats.set(key, format)
  }
  return format.format(time[unit])
}

/** `Intl.DurationFormat`, where the engine has it (Chrome 129, Safari 16.4, Firefox 136). */
interface DurationFormat {
  format(duration: Partial<Record<Exclude<TimerUnit, "milliseconds">, number>>): string
}
type DurationFormatCtor = new (
  locale: string,
  options: { readonly style: "long"; readonly secondsDisplay?: "always" },
) => DurationFormat

function durationFormat(): DurationFormatCtor | undefined {
  // Sound: read off Intl at run time; the lib typings may not declare it yet.
  return (Intl as unknown as { DurationFormat?: DurationFormatCtor }).DurationFormat
}

/** The duration in words ("1 hour, 5 seconds"); zero units are left out, unless all are zero. */
export function spokenTimerDuration(time: TimerTime, locale: string, messages: TimerMessages) {
  const Ctor = durationFormat()
  if (!Ctor) return messages.duration(time)
  const { days, hours, minutes, seconds } = time
  const parts = Object.fromEntries(
    Object.entries({ days, hours, minutes, seconds }).filter(([, n]) => n !== 0),
  )
  try {
    if (Object.keys(parts).length === 0) {
      return new Ctor(locale, { style: "long", secondsDisplay: "always" }).format({ seconds: 0 })
    }
    return new Ctor(locale, { style: "long" }).format(parts)
  } catch {
    return messages.duration(time)
  }
}
