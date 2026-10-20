// Timeline parts (add-timeline design §1): an ordered list of events in DOM order (layout is
// data, never a reversed structure); on a progress timeline each title ends with its status
// and the current event carries aria-current="step", so progress is not colour alone.

import { dataFlag, type PartProps, scopeAttrs } from "../../connect/props"
import { visuallyHiddenStyle } from "../../dom/visually-hidden"
import type { TimelineMessages, TimelineStatus } from "./timeline.messages"

export type TimelinePart =
  | "root"
  | "item"
  | "indicator"
  | "connector"
  | "content"
  | "title"
  | "description"
  | "time"
  | "opposite"

export type TimelineOrientation = "vertical" | "horizontal"
export type TimelineAlign = "start" | "end" | "alternate"

export interface TimelineConnectInput {
  readonly instance: string
  readonly orientation: TimelineOrientation
  readonly align: TimelineAlign
  /** The current event's index (a progress timeline), or undefined. */
  readonly current?: number | undefined
  /** How many Items are mounted (the last one has no connector after it). */
  readonly count: number
  readonly messages: TimelineMessages
}

/** One Item's place: its index and its own status, if any. */
export interface TimelineItemInput {
  readonly index: number
  readonly status?: TimelineStatus | undefined
}

export function timelineConnect(input: TimelineConnectInput) {
  const part = (name: TimelinePart): PartProps => scopeAttrs("timeline", name, input.instance)
  /** The Item's status: its own, else derived from `current`, else none (a plain log). */
  const statusOf = (item: TimelineItemInput): TimelineStatus | undefined => {
    if (item.status !== undefined) return item.status
    if (input.current === undefined) return undefined
    return item.index < input.current
      ? "completed"
      : item.index === input.current
        ? "current"
        : "upcoming"
  }
  const itemPart = (name: TimelinePart, item: TimelineItemInput): PartProps => ({
    ...part(name),
    "data-status": statusOf(item),
  })
  const side = (index: number) =>
    input.align === "alternate" ? (index % 2 === 0 ? "start" : "end") : input.align
  return {
    statusOf,
    root: (): PartProps => ({
      ...part("root"),
      "data-orientation": input.orientation,
      "data-align": input.align,
    }),
    item: (item: TimelineItemInput): PartProps => ({
      ...itemPart("item", item),
      "data-index": String(item.index),
      "data-side": side(item.index),
      "aria-current": statusOf(item) === "current" ? "step" : undefined,
    }),
    indicator: (item: TimelineItemInput): PartProps => ({
      ...itemPart("indicator", item),
      "aria-hidden": "true",
    }),
    connector: (item: TimelineItemInput): PartProps => ({
      ...itemPart("connector", item),
      "aria-hidden": "true",
      "data-last": dataFlag(item.index === input.count - 1),
    }),
    content: (item: TimelineItemInput): PartProps => itemPart("content", item),
    title: (item: TimelineItemInput): PartProps => itemPart("title", item),
    description: (item: TimelineItemInput): PartProps => itemPart("description", item),
    opposite: (item: TimelineItemInput): PartProps => itemPart("opposite", item),
    time: (dateTime: string): PartProps => ({ ...part("time"), dateTime }),
    /** " (completed)", or "" on a plain log (no status). */
    statusText: (item: TimelineItemInput): string => {
      const status = statusOf(item)
      return status === undefined ? "" : ` (${input.messages.status(status)})`
    },
    statusProps: (): PartProps => ({ style: visuallyHiddenStyle }),
  }
}
