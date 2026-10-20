// Alert (design §2): `open` / `closed`, a controllable `open` (default true). The Alert is
// never a live region: it announces through the injected Announcer, once when it appears
// after load (a client mount, or `open` becoming true) and once per change of its text while
// shown. A server-rendered alert stays silent (mui/material-ui#49440).

import type { AnnouncerEnv } from "../../env/capabilities"
import { setup, type } from "../../machine/setup"
import type { ChangeDetails } from "../../machine/types"
import type { AlertMessages } from "./alert.messages"

export type AlertAnnounce = "off" | "polite" | "assertive"

export type AlertEvent =
  /** The Root committed: `hydrating` when its HTML came from the server. */
  | {
      readonly type: "ROOT.MOUNT"
      readonly hydrating: boolean
      readonly segments: readonly string[]
    }
  /**
   * Shown again after `open` became true: the Root re-read its text from the DOM it just
   * rendered (the text may have changed while it was unmounted).
   */
  | { readonly type: "ROOT.SHOW"; readonly segments: readonly string[] }
  /** The text it would announce changed (observed on the DOM, whatever caused it). */
  | { readonly type: "CONTENT.CHANGE"; readonly segments: readonly string[] }
  /** The CloseTrigger was activated; `focusInside`: focus was inside the alert. */
  | { readonly type: "CLOSE"; readonly focusInside: boolean }
  /** Queued by CLOSE after focus has moved, so `onOpenChange` comes second. */
  | { readonly type: "CLOSE.COMMIT" }

export interface AlertProps {
  readonly open?: boolean | undefined
  readonly defaultOpen?: boolean | undefined
  /** `details.reason` is `"close-trigger"` for a CloseTrigger, `"$sync"` for the parent. */
  readonly onOpenChange?: ((open: boolean, details: ChangeDetails<AlertEvent>) => void) | undefined
  /** Default `"polite"` (coordinator amendment A.1). */
  readonly announce?: AlertAnnounce | undefined
  /** Announced instead of the text built from the Icon label, Title and Description. */
  readonly announcement?: string | undefined
  readonly messages: AlertMessages
  /** The instance id, for the announcement's key. */
  readonly id: string
  readonly lang?: string | undefined
  /** Moves focus out of the alert before it closes (the adapter's DOM: finalFocus, next tab stop). */
  readonly moveFocusOut?: (() => void) | undefined
}

const live = (props: AlertProps) => (props.announce ?? "polite") !== "off"
const joined = (segments: readonly string[]) => segments.join("\u0000")

export const alertMachine = /* @__PURE__ */ setup({
  types: type<{
    props: AlertProps
    events: AlertEvent
    env: AnnouncerEnv
    context: { mounted: boolean; segments: readonly string[] }
    values: "open"
  }>(),
  guards: {
    notMounted: ({ context }) => !context.mounted,
    textChanged: ({ context, event }) =>
      event.type === "CONTENT.CHANGE" && joined(event.segments) !== joined(context.segments),
  },
  actions: {
    setText: ({ event, set }) => {
      if (
        event.type === "ROOT.MOUNT" ||
        event.type === "ROOT.SHOW" ||
        event.type === "CONTENT.CHANGE"
      ) {
        set("segments", event.segments)
      }
    },
    /** The first commit only (Strict Mode's second mount effect is the same alert). */
    markMounted: ({ set }) => set("mounted", true),
    announceText: ({ props, context, env, event }) => {
      // Not before the first commit, nor on a hydrating mount: present at load.
      if (!context.mounted || !live(props)) return
      if (event.type === "ROOT.MOUNT" && event.hydrating) return
      const message = props.announcement ?? props.messages.announcement(context.segments)
      if (message.trim() === "") return
      env.announcer.announce({
        message,
        priority: props.announce === "assertive" ? "assertive" : "polite",
        // One key per alert: Strict Mode's double mount and text bursts collapse.
        key: `alert-${props.id}`,
        ...(props.lang === undefined ? {} : { lang: props.lang }),
      })
    },
    moveFocusIfInside: ({ props, event }) => {
      if (event.type === "CLOSE" && event.focusInside) props.moveFocusOut?.()
    },
    commitClose: ({ send }) => send({ type: "CLOSE.COMMIT" }),
  },
  effects: {
    // Regions exist before the first message (cause D of the research).
    prepareAnnouncer: ({ props, env }) => (live(props) ? env.announcer.prepare() : undefined),
  },
}).machine({
  id: "alert",
  initial: "open",
  context: () => ({ mounted: false, segments: [] }),
  values: { open: { fallback: true, states: { open: true, closed: false } } },
  effects: ["prepareAnnouncer"],
  states: {
    open: {
      on: {
        // Shown again through `open`: one announcement, from the freshly rendered text.
        "ROOT.SHOW": { actions: ["setText", "announceText"] },
        "ROOT.MOUNT": {
          guard: "notMounted",
          actions: ["setText", "markMounted", "announceText"],
        },
        "CONTENT.CHANGE": { guard: "textChanged", actions: ["setText", "announceText"] },
        // Focus first, then the change: a consumer that unmounts in onOpenChange cannot
        // strand focus on body.
        CLOSE: { actions: ["moveFocusIfInside", "commitClose"] },
        "CLOSE.COMMIT": { target: "closed", reason: "close-trigger" },
      },
    },
    closed: {
      on: {
        "ROOT.MOUNT": { guard: "notMounted", actions: ["setText", "markMounted"] },
        "CONTENT.CHANGE": { actions: ["setText"] },
      },
    },
  },
})

export type AlertMachine = typeof alertMachine
