// Message Thread (add-message-thread design §2): follow or detach, from scroll facts the DOM
// layer reports (the component's own scrolls never reach here). Scrolling and focus are
// injected effects, so every rule runs in Node.

import type { Modality } from "../../contract/env"
import { setup, type } from "../../machine/setup"

export type ThreadAnchor = "bottom" | "top"
export type ScrollBehaviorChoice = "smooth" | "instant"

export type MessageThreadEvent =
  /** A user scroll: where it ended and which way it went. */
  | { readonly type: "SCROLLED"; readonly atBottom: boolean; readonly up: boolean }
  /** An upward wheel on the viewport, or a text selection dragged inside it. */
  | { readonly type: "ESCAPE" }
  /** `count` or `lastFromUser` changed (onProps). */
  | { readonly type: "COUNT.SYNCED" }
  | { readonly type: "JUMP"; readonly modality: Modality }
  | { readonly type: "MOTION.CHANGED"; readonly reduced: boolean }

export interface MessageThreadProps {
  readonly anchor?: ThreadAnchor | undefined
  /** Messages in the thread (or loaded). */
  readonly count: number
  /** The newest message is the user's. */
  readonly lastFromUser?: boolean | undefined
}

/** What the machine reaches the DOM through (injected; absent in Node). */
export interface MessageThreadEnv {
  readonly scrollToBottom?: ((behavior: ScrollBehaviorChoice) => void) | undefined
  /** Scrolls the newest message's top to the viewport's top (anchor "top"). */
  readonly revealTurn?: ((behavior: ScrollBehaviorChoice) => void) | undefined
  readonly focusLast?: (() => void) | undefined
}

export interface MessageThreadContext {
  /** Messages added while detached. */
  readonly unread: number
  /** The count last seen (new messages are the difference). */
  readonly seen: number
  readonly reduced: boolean
}

type Types = {
  props: MessageThreadProps
  events: MessageThreadEvent
  env: MessageThreadEnv
  context: MessageThreadContext
}

const behavior = (reduced: boolean): ScrollBehaviorChoice => (reduced ? "instant" : "smooth")
const top = (props: MessageThreadProps) => props.anchor === "top"

export const messageThreadMachine = /* @__PURE__ */ setup({
  types: type<Types>(),
  guards: {
    leftBottom: ({ event }) =>
      event.type === "ESCAPE" || (event.type === "SCROLLED" && (event.up || !event.atBottom)),
    // In the top layout `following` only means "at the bottom": nothing follows growth there,
    // and the DOM layer reports growth that leaves the bottom as a SCROLLED fact.
    reachedBottom: ({ event }) => event.type === "SCROLLED" && event.atBottom,
    /** New messages since the last sync (two props changing together sync twice). */
    grew: ({ props, context }) => props.count > context.seen,
    /** A new message from the user, in the classic layout: follow again. */
    userSent: ({ props, context }) =>
      !top(props) && props.count > context.seen && props.lastFromUser === true,
    topAnchor: ({ props }) => top(props),
  },
  actions: {
    follow: ({ env, context }) => env.scrollToBottom?.(behavior(context.reduced)),
    clearUnread: ({ set, props }) => {
      set("unread", 0)
      set("seen", props.count)
    },
    countUnread: ({ set, props, context }) => {
      const added = Math.max(0, props.count - context.seen)
      set("unread", context.unread + added)
      set("seen", props.count)
    },
    revealTurn: ({ env, props, context, set }) => {
      if (props.count > context.seen && props.lastFromUser === true) {
        env.revealTurn?.(behavior(context.reduced))
      }
      set("seen", props.count)
    },
    focusLast: ({ event, env }) => {
      if (
        event.type === "JUMP" &&
        (event.modality === "keyboard" || event.modality === "virtual")
      ) {
        env.focusLast?.()
      }
    },
    motion: ({ event, set }) => {
      if (event.type === "MOTION.CHANGED") set("reduced", event.reduced)
    },
  },
}).machine({
  id: "message-thread",
  initial: "following",
  context: (props) => ({ unread: 0, seen: props.count, reduced: false }),
  onProps: { count: "COUNT.SYNCED", lastFromUser: "COUNT.SYNCED", anchor: "COUNT.SYNCED" },
  on: {
    JUMP: { target: "following", actions: ["clearUnread", "follow", "focusLast"] },
    "MOTION.CHANGED": { actions: ["motion"] },
  },
  states: {
    following: {
      on: {
        SCROLLED: { guard: "leftBottom", target: "detached" },
        ESCAPE: { target: "detached" },
        "COUNT.SYNCED": [
          // The top layout never follows: the user's turn goes to the top instead.
          { guard: "topAnchor", target: "detached", actions: ["revealTurn"] },
          { guard: "grew", actions: ["clearUnread", "follow"] },
        ],
      },
    },
    detached: {
      on: {
        SCROLLED: { guard: "reachedBottom", target: "following", actions: ["clearUnread"] },
        "COUNT.SYNCED": [
          { guard: "topAnchor", actions: ["revealTurn"] },
          { guard: "userSent", target: "following", actions: ["clearUnread", "follow"] },
          { actions: ["countUnread"] },
        ],
      },
    },
  },
})

export type MessageThreadMachine = typeof messageThreadMachine
