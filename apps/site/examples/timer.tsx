"use client"

import type { TimerUnit } from "@rind-ui/core"
import { Timer } from "@rind-ui/react"
import { Fragment } from "react"
import type { States, Variants } from "./types"

/** `paused` and `completed` follow a press or the clock: reached by the driver. */
export const states: States = { timer: { idle: "Basic", running: "Stopwatch" } }

/** The units in order, a ":" between each two. */
function Clock({ units }: { readonly units: readonly TimerUnit[] }) {
  return (
    <Timer.Area>
      {units.map((type, i) => (
        <Fragment key={type}>
          {i > 0 && <Timer.Separator>:</Timer.Separator>}
          <Timer.Item type={type}>
            <Timer.ItemValue type={type} />
          </Timer.Item>
        </Fragment>
      ))}
    </Timer.Area>
  )
}

/** One play/pause key that names itself, and a reset. */
function Keys() {
  return (
    <Timer.Control>
      <Timer.ActionTrigger action="toggle">{({ label }) => label}</Timer.ActionTrigger>
      <Timer.ActionTrigger action="reset" data-variant="outline">
        Reset
      </Timer.ActionTrigger>
    </Timer.Control>
  )
}

export function Basic() {
  return (
    <Timer.Root countdown startMs={5 * 60_000}>
      <Clock units={["minutes", "seconds"]} />
      <Keys />
    </Timer.Root>
  )
}

export function Stopwatch() {
  return (
    <Timer.Root autoStart interval={10}>
      <Timer.Area>
        <Timer.Item type="minutes">
          <Timer.ItemValue type="minutes" />
        </Timer.Item>
        <Timer.Separator>:</Timer.Separator>
        <Timer.Item type="seconds">
          <Timer.ItemValue type="seconds" />
        </Timer.Item>
        <Timer.Separator>.</Timer.Separator>
        <Timer.Item type="milliseconds">
          <Timer.ItemValue type="milliseconds" />
        </Timer.Item>
      </Timer.Area>
      <Timer.Control>
        <Timer.ActionTrigger action="toggle">{({ label }) => label}</Timer.ActionTrigger>
        <Timer.ActionTrigger action="restart" data-variant="outline">
          Restart
        </Timer.ActionTrigger>
      </Timer.Control>
    </Timer.Root>
  )
}

export function Labelled() {
  return (
    <Timer.Root countdown startMs={2 * 86_400_000 + 3 * 3_600_000} autoStart>
      <Timer.Area>
        {(["days", "hours", "minutes", "seconds"] as const).map((type) => (
          <Timer.Item key={type} type={type}>
            <Timer.ItemValue type={type} />
            <Timer.ItemLabel type={type}>{type}</Timer.ItemLabel>
          </Timer.Item>
        ))}
      </Timer.Area>
    </Timer.Root>
  )
}

export function AllActions() {
  return (
    <Timer.Root countdown startMs={30_000}>
      <Clock units={["minutes", "seconds"]} />
      <Timer.Control>
        {(["start", "pause", "resume", "reset", "restart"] as const).map((action) => (
          <Timer.ActionTrigger key={action} action={action} data-variant="soft">
            {action[0]?.toUpperCase() + action.slice(1)}
          </Timer.ActionTrigger>
        ))}
      </Timer.Control>
    </Timer.Root>
  )
}

export function Localised() {
  return (
    <Timer.Root
      countdown
      startMs={90_000}
      locale="ar-EG"
      messages={{ completed: "انتهى الوقت", start: "ابدأ", pause: "إيقاف مؤقت", resume: "استئناف" }}
    >
      <Clock units={["minutes", "seconds"]} />
      <Keys />
    </Timer.Root>
  )
}

export const variants: Variants = {
  Basic: {
    title: "Countdown",
    description:
      "Five minutes down, one key that says Start, Pause or Resume. The time is read in words, completion is announced.",
  },
  Stopwatch: {
    title: "Stopwatch",
    description: "Counts up from mount with hundredths; a background tab loses no time.",
    motion: "keep",
  },
  Labelled: {
    title: "Units with labels",
    description: "Days to seconds, each with a caption under it.",
  },
  AllActions: {
    title: "Every action",
    description:
      "One key per action: those that do nothing now are disabled but stay focusable, so the focus never drops.",
  },
  Localised: {
    title: "Localised",
    description: "`locale` and `messages`: Arabic digits, words and announcement.",
  },
}
