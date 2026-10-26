// Message Actions (add-message-actions design §1): only what the composed primitives do not
// own: the row's visibility (never unmounted: assistant-ui autohide drops focus), Regenerate's
// pending state (no double press), editing with focus restored (assistant-ui#8208) and the
// version index (keyed, no wrap by default, announced: AI Elements wraps silently).

import type { AnnouncerEnv, LocaleEnv, SchedulerEnv } from "../../env/capabilities"
import { setup, type } from "../../machine/setup"
import type { ActionArgs } from "../../machine/types"
import { type MessageActionsMessages, messageActionsMessages } from "./message-actions.messages"

export type RegenerateState = "idle" | "pending" | "done" | "error"

export type MessageActionsEvent =
  | { readonly type: "POINTER.ENTER" }
  | { readonly type: "POINTER.LEAVE" }
  | { readonly type: "FOCUS.IN" }
  | { readonly type: "FOCUS.OUT" }
  | { readonly type: "TOUCH" }
  | { readonly type: "PRESS.REGENERATE" }
  | { readonly type: "REGENERATE.DONE" }
  | { readonly type: "REGENERATE.FAILED"; readonly error?: unknown }
  | { readonly type: "REGENERATE.RESET" }
  | { readonly type: "PRESS.EDIT" }
  | { readonly type: "PRESS.PREVIOUS" }
  | { readonly type: "PRESS.NEXT" }
  /** `editing` turned false from outside or inside: restore the focus when it was lost. */
  | { readonly type: "EDITING.SYNCED" }

export interface MessageActionsProps {
  /** Forces the row visible. */
  readonly active?: boolean | undefined
  readonly onRegenerate?: (() => void | Promise<void>) | undefined
  readonly editing?: boolean | undefined
  readonly defaultEditing?: boolean | undefined
  readonly onEditingChange?: ((editing: boolean) => void) | undefined
  /** How many versions the message has (Versions renders from 2). */
  readonly count?: number | undefined
  readonly index?: number | undefined
  readonly defaultIndex?: number | undefined
  readonly onIndexChange?: ((index: number) => void) | undefined
  /** Previous on the first and Next on the last wrap around. */
  readonly loop?: boolean | undefined
  readonly messages?: MessageActionsMessages | undefined
  readonly id: string
  readonly lang?: string | undefined
}

export interface MessageActionsEnv extends AnnouncerEnv, LocaleEnv, SchedulerEnv {
  /** Focuses the Edit item when the document's focus was lost (the editor unmounted). */
  readonly restoreEditFocus?: (() => void) | undefined
}

export interface MessageActionsContext {
  readonly hovered: boolean
  readonly focused: boolean
  readonly touched: boolean
  readonly regenerate: RegenerateState
}

type Types = {
  props: MessageActionsProps
  events: MessageActionsEvent
  env: MessageActionsEnv
  context: MessageActionsContext
  values: "editing" | "index"
}
type Args = ActionArgs<Types>

export const DEFAULT_FEEDBACK_DURATION = 2000

const countOf = (p: MessageActionsProps) => Math.max(0, Math.floor(p.count ?? 0))

/** The index a move lands on, or null when it would leave the range without `loop`. */
export function versionTarget(index: number, count: number, by: 1 | -1, loop: boolean) {
  if (count < 2) return null
  const next = index + by
  if (next >= 0 && next < count) return next
  return loop ? (next + count) % count : null
}

function move(args: Args, by: 1 | -1) {
  const { env, props, set, values } = args
  const count = countOf(props)
  const to = versionTarget(values.index ?? 0, count, by, props.loop === true)
  if (to === null) return
  set("index", to)
  env.announcer.announce({
    message: (props.messages ?? messageActionsMessages).version(to + 1, count),
    priority: "polite",
    key: `message-actions-${props.id}`,
    lang: props.lang ?? env.locale.locale(),
  })
}

export const messageActionsMachine = /* @__PURE__ */ setup({
  types: type<Types>(),
  guards: {
    canRegenerate: ({ context }) => context.regenerate !== "pending",
  },
  actions: {
    hover: ({ set }) => set("hovered", true),
    unhover: ({ set }) => set("hovered", false),
    focusIn: ({ set }) => set("focused", true),
    focusOut: ({ set }) => set("focused", false),
    touch: ({ set }) => set("touched", true),
    regenerate: ({ props, send, set }) => {
      set("regenerate", "pending")
      let result: void | Promise<void>
      try {
        result = props.onRegenerate?.()
      } catch (error) {
        send({ type: "REGENERATE.FAILED", error })
        return
      }
      if (result && typeof (result as Promise<void>).then === "function") {
        ;(result as Promise<void>).then(
          () => send({ type: "REGENERATE.DONE" }),
          (error: unknown) => send({ type: "REGENERATE.FAILED", error }),
        )
      } else {
        send({ type: "REGENERATE.DONE" })
      }
    },
    regenerateDone: ({ set }) => set("regenerate", "done"),
    regenerateFailed: ({ set }) => set("regenerate", "error"),
    regenerateIdle: ({ set }) => set("regenerate", "idle"),
    toggleEdit: (args) => {
      const editing = args.values.editing === true
      args.set("editing", !editing)
      if (editing) args.env.restoreEditFocus?.()
    },
    restoreFocus: ({ env, values }) => {
      if (values.editing !== true) env.restoreEditFocus?.()
    },
    previous: (args) => move(args, -1),
    next: (args) => move(args, 1),
  },
  effects: {
    prepareAnnouncer: ({ env }) => env.announcer.prepare(),
    /** `done` / `error` back to `idle` after the feedback time. */
    settle: ({ context, env, send }) => {
      if (context.regenerate !== "done" && context.regenerate !== "error") return undefined
      const h = env.scheduler.setTimeout(
        () => send({ type: "REGENERATE.RESET" }),
        DEFAULT_FEEDBACK_DURATION,
      )
      return () => env.scheduler.clearTimeout(h)
    },
  },
}).machine({
  id: "message-actions",
  initial: "live",
  context: () => ({ hovered: false, focused: false, touched: false, regenerate: "idle" }),
  values: { editing: { fallback: false }, index: { fallback: 0 } },
  onProps: { editing: "EDITING.SYNCED" },
  effects: ["prepareAnnouncer"],
  on: {
    "POINTER.ENTER": { actions: ["hover"] },
    "POINTER.LEAVE": { actions: ["unhover"] },
    "FOCUS.IN": { actions: ["focusIn"] },
    "FOCUS.OUT": { actions: ["focusOut"] },
    TOUCH: { actions: ["touch"] },
    "PRESS.REGENERATE": { guard: "canRegenerate", target: "live", actions: ["regenerate"] },
    "REGENERATE.DONE": { target: "settling", actions: ["regenerateDone"] },
    "REGENERATE.FAILED": { target: "settling", actions: ["regenerateFailed"] },
    "PRESS.EDIT": { actions: ["toggleEdit"] },
    "EDITING.SYNCED": { actions: ["restoreFocus"] },
    "PRESS.PREVIOUS": { actions: ["previous"] },
    "PRESS.NEXT": { actions: ["next"] },
  },
  states: {
    live: {},
    settling: {
      effects: ["settle"],
      on: { "REGENERATE.RESET": { target: "live", actions: ["regenerateIdle"] } },
    },
  },
})

export type MessageActionsMachine = typeof messageActionsMachine

/** Whether the row shows (design §1): forced, hovered, focused within or touched. */
export const messageActionsActive = (
  c: MessageActionsContext,
  p: Pick<MessageActionsProps, "active">,
) => p.active === true || c.hovered || c.focused || c.touched
