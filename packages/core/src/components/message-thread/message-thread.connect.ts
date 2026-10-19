// Message Thread parts (add-message-thread design §4, §5): an APG Feed of articles, never a
// live region (each message announces its own lifecycle); the viewport is a focusable,
// named scroll region; JumpToLatest exists only while the user reads back.

import { focusAttrs } from "../../a11y/focus"
import { dataFlag, type PartProps, scopeAttrs } from "../../connect/props"
import type { Modality } from "../../contract/env"
import type { ThreadAnchor } from "./message-thread.machine"
import type { MessageFrom, MessageThreadMessages } from "./message-thread.messages"

export type MessageThreadPart = "root" | "viewport" | "message" | "jump-to-latest"
export type MessageThreadState = "following" | "detached"

export interface MessageThreadConnectInput {
  readonly instance: string
  readonly state: MessageThreadState
  readonly anchor: ThreadAnchor
  readonly count: number
  /** The thread's full length when larger than what is loaded (`-1`: unknown). */
  readonly total?: number | undefined
  readonly unread: number
  /** The viewport is scrolled to the bottom (within the threshold). */
  readonly atBottom: boolean
  readonly loadingOlder: boolean
  readonly messages: MessageThreadMessages
  readonly locale: string
}

/** What a key on the feed does (APG Feed), or null to leave it to the target. */
export type FeedKeyAction = "next" | "previous" | "after" | "before"

export function feedKeyAction(key: {
  readonly key: string
  readonly ctrlKey: boolean
  readonly metaKey: boolean
  /** The event's target edits text or declares its own shortcuts: it keeps the keys. */
  readonly targetOwnsKeys: boolean
}): FeedKeyAction | null {
  if (key.targetOwnsKeys) return null
  const mod = key.ctrlKey || key.metaKey
  if (key.key === "PageDown" && !mod) return "next"
  if (key.key === "PageUp" && !mod) return "previous"
  if (key.key === "End" && mod) return "after"
  if (key.key === "Home" && mod) return "before"
  return null
}

/** A part's own focus, for `data-focus` / `data-focus-visible`. */
export interface PartFocus {
  readonly focused: boolean
  readonly modality: Modality
}
const UNFOCUSED: PartFocus = { focused: false, modality: "pointer" }

export function messageThreadConnect(input: MessageThreadConnectInput) {
  const part = (name: MessageThreadPart): PartProps => ({
    ...scopeAttrs("message-thread", name, input.instance),
    "data-state": input.state,
    "data-anchor": input.anchor,
  })
  return {
    root: (): PartProps => ({ ...part("root"), "data-at-bottom": dataFlag(input.atBottom) }),
    viewport: (named: boolean, focus: PartFocus = UNFOCUSED): PartProps => ({
      ...part("viewport"),
      ...focusAttrs(focus.focused, focus.modality),
      role: "feed",
      "aria-label": named ? undefined : input.messages.label,
      "aria-busy": input.loadingOlder ? "true" : undefined,
      "data-loading": dataFlag(input.loadingOlder),
      tabindex: 0,
      style: { overflowY: "auto", overflowAnchor: "none" },
    }),
    message: (m: {
      readonly index: number
      readonly from: MessageFrom
      readonly named: boolean
      readonly focus?: PartFocus | undefined
    }): PartProps => ({
      ...part("message"),
      ...focusAttrs(m.focus?.focused ?? false, m.focus?.modality ?? "pointer"),
      role: "article",
      tabindex: -1,
      "aria-posinset": m.index + 1,
      "aria-setsize": input.total ?? input.count,
      "aria-label": m.named
        ? undefined
        : input.messages.messageLabel({ from: m.from, index: m.index }),
      "data-from": m.from,
      "data-index": String(m.index),
    }),
    /** Rendered only while detached. */
    showJump: input.state === "detached",
    jumpToLatest: (named: boolean): PartProps => ({
      ...part("jump-to-latest"),
      type: "button",
      "aria-label": named ? undefined : input.messages.jumpLabel(input.unread, input.locale),
      "data-unread": input.unread > 0 ? String(input.unread) : undefined,
    }),
  }
}
