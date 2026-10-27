// Timer parts (add-timer design §7, §8): every aria-* and data-* attribute. The Area is
// `role="timer"` (implicit aria-live off) named by the duration in words; an action that does
// nothing in the current state is disabled but stays focusable, never hidden (focus stays).

import { focusAttrs } from "../../a11y/focus"
import { dataFlag, type PartProps, scopeAttrs } from "../../connect/props"
import type { Modality } from "../../contract/env"
import type { LinkEnv } from "../../dom/link"
import { buttonLikeProps } from "../shared/button-like"
import {
  formatTimerUnit,
  spokenTimerDuration,
  type TimerTime,
  type TimerUnit,
  toTime,
} from "./timer.format"
import {
  type TimerAction,
  type TimerConfig,
  type TimerState,
  timerActionApplies,
  timerDisplayed,
  timerProgress,
} from "./timer.machine"
import type { TimerMessages } from "./timer.messages"

export type TimerPart =
  | "root"
  | "area"
  | "control"
  | "item"
  | "item-value"
  | "item-label"
  | "separator"
  | "action-trigger"

export interface TimerConnectInput {
  readonly instance: string
  readonly state: TimerState
  /** The machine's value (ms). */
  readonly value: number
  readonly config: TimerConfig
  readonly locale: string
  readonly messages: TimerMessages
}

export interface TimerTriggerInput {
  readonly action: TimerAction
  readonly tag: string
  readonly focused: boolean
  readonly modality: Modality
}

export function timerConnect(input: TimerConnectInput, env: LinkEnv) {
  const displayed = timerDisplayed(input.config, input.value)
  const time: TimerTime = toTime(displayed)
  const progress = timerProgress(input.config, input.value)
  const base = (part: TimerPart): PartProps => ({
    ...scopeAttrs("timer", part, input.instance),
    "data-state": input.state,
  })
  const typed = (part: TimerPart, type: TimerUnit): PartProps => ({
    ...base(part),
    "data-type": type,
  })
  const label = input.messages.label(spokenTimerDuration(time, input.locale, input.messages))
  return {
    time,
    progress,
    /** The Area's name. */
    label,
    /** One unit in the locale's digits ("05"). */
    text: (type: TimerUnit) => formatTimerUnit(time, type, input.locale),
    /** The toggle's word for the current state ("Start", "Pause", "Resume"). */
    toggleLabel: () =>
      input.state === "running"
        ? input.messages.pause
        : input.state === "paused"
          ? input.messages.resume
          : input.messages.start,
    applies: (action: TimerAction) => timerActionApplies(action, input.state),
    root: (): PartProps => ({
      ...base("root"),
      "data-countdown": dataFlag(input.config.countdown),
      style: { "--rind-timer-progress": String(progress) },
    }),
    area: (): PartProps => ({
      ...base("area"),
      role: "timer",
      "aria-atomic": "true",
      "aria-label": label,
    }),
    control: (): PartProps => base("control"),
    item: (type: TimerUnit): PartProps => typed("item", type),
    itemValue: (type: TimerUnit): PartProps => typed("item-value", type),
    itemLabel: (type: TimerUnit): PartProps => typed("item-label", type),
    separator: (): PartProps => ({ ...base("separator"), "aria-hidden": "true" }),
    actionTrigger: (t: TimerTriggerInput): PartProps => {
      const disabled = !timerActionApplies(t.action, input.state)
      return {
        ...buttonLikeProps(
          { role: "button", tag: t.tag, type: "button", disabled, focusableWhenDisabled: true },
          env,
        ),
        ...base("action-trigger"),
        ...focusAttrs(t.focused, t.modality),
        "data-action": t.action,
        "data-disabled": dataFlag(disabled),
      }
    },
  }
}

export type TimerApi = ReturnType<typeof timerConnect>
