// image-loading-status (design §2): the status of the one <img> a component renders —
// `idle | loading | loaded | error` — observed from the element, never controlled. The
// element registers (IMAGE.MOUNT, IMAGE.SOURCE) with what `imageSettled` read from it at
// commit, so an image that finished before hydration starts `loaded`. Shared by Avatar
// (`avatarMachine`) and Image.

import type { ImageSettled } from "../../dom/image-status"
import type { SchedulerEnv } from "../../env/capabilities"
import { setup, type } from "../../machine/setup"
import type { ChangeDetails } from "../../machine/types"

export type ImageStatus = "idle" | "loading" | "loaded" | "error"

/** `source` numbers the image's sources: events of a replaced source are dropped. */
export type ImageStatusEvent =
  | { readonly type: "ROOT.MOUNT" }
  | {
      readonly type: "IMAGE.MOUNT" | "IMAGE.SOURCE"
      readonly hasSource: boolean
      readonly source: number
      readonly settled: ImageSettled
    }
  /** The `decode()` result for an image `complete` with no natural width. */
  | { readonly type: "IMAGE.SETTLED"; readonly status: "loaded" | "error"; readonly source: number }
  | { readonly type: "IMAGE.LOAD" | "IMAGE.ERROR"; readonly source: number }
  | { readonly type: "IMAGE.UNMOUNT" }

export interface ImageStatusProps {
  /** Milliseconds the fallback waits while the image is `loading` (default 0). */
  readonly fallbackDelay?: number | undefined
  readonly onStatusChange?:
    | ((status: ImageStatus, details: ChangeDetails<ImageStatusEvent>) => void)
    | undefined
}

export interface ImageStatusContext {
  readonly source: number
  readonly mounted: boolean
  /** Sticky: once the fallback may show, a delay never hides it again. */
  readonly fallbackReady: boolean
}

const isSource = (e: {
  readonly type: string
}): e is Extract<ImageStatusEvent, { hasSource: boolean }> =>
  e.type === "IMAGE.MOUNT" || e.type === "IMAGE.SOURCE"

const notify =
  (status: ImageStatus) =>
  ({ props, event }: { props: ImageStatusProps; event: { readonly type: string } }) => {
    // The creation entry is not a change.
    if (event.type === "$start") return
    props.onStatusChange?.(status, {
      reason: event.type as ChangeDetails<ImageStatusEvent>["reason"], // a declared or runtime event
      event: event as ChangeDetails<ImageStatusEvent>["event"],
      // Observed, not controlled: there is nothing to cancel.
      cancel: () => {},
    })
  }

export const imageStatusMachine = /* @__PURE__ */ setup({
  types: type<{
    props: ImageStatusProps
    events: ImageStatusEvent
    env: SchedulerEnv
    context: ImageStatusContext
  }>(),
  guards: {
    noSource: ({ event }) => isSource(event) && !event.hasSource,
    settledLoaded: ({ event }) => isSource(event) && event.settled === "loaded",
    settledError: ({ event }) => isSource(event) && event.settled === "error",
    current: ({ event, context }) => "source" in event && event.source === context.source,
    decodedLoaded: ({ event, context }) =>
      event.type === "IMAGE.SETTLED" &&
      event.source === context.source &&
      event.status === "loaded",
  },
  actions: {
    setSource: ({ event, set }) => {
      if (isSource(event)) set("source", event.source)
    },
    markMounted: ({ set }) => set("mounted", true),
    markFallbackReady: ({ set }) => set("fallbackReady", true),
    notifyIdle: notify("idle"),
    notifyLoading: notify("loading"),
    notifyLoaded: notify("loaded"),
    notifyError: notify("error"),
  },
  delays: { fallbackDelay: ({ props }) => props.fallbackDelay ?? 0 },
}).machine({
  id: "image-status",
  initial: "idle",
  context: (props) => ({
    source: 0,
    mounted: false,
    fallbackReady: (props.fallbackDelay ?? 0) <= 0,
  }),
  on: {
    "IMAGE.MOUNT": [
      { guard: "noSource", target: "idle", actions: ["setSource"] },
      { guard: "settledLoaded", target: "loaded", actions: ["setSource"] },
      { guard: "settledError", target: "error", actions: ["setSource"] },
      { target: "loading", actions: ["setSource"] },
    ],
    "IMAGE.SOURCE": [
      { guard: "noSource", target: "idle", actions: ["setSource"] },
      { guard: "settledLoaded", target: "loaded", actions: ["setSource"] },
      { guard: "settledError", target: "error", actions: ["setSource"] },
      { target: "loading", actions: ["setSource"] },
    ],
    "IMAGE.UNMOUNT": "idle",
    "ROOT.MOUNT": { actions: ["markMounted"] },
  },
  states: {
    idle: {
      entry: ["notifyIdle"],
      // Nothing to wait for: the fallback shows after the first commit.
      on: { "ROOT.MOUNT": { actions: ["markMounted", "markFallbackReady"] } },
    },
    loading: {
      entry: ["notifyLoading"],
      on: {
        "IMAGE.LOAD": { guard: "current", target: "loaded" },
        "IMAGE.ERROR": { guard: "current", target: "error" },
        "IMAGE.SETTLED": [
          { guard: "decodedLoaded", target: "loaded" },
          { guard: "current", target: "error" },
        ],
      },
      after: { fallbackDelay: { actions: ["markFallbackReady"] } },
    },
    loaded: {
      entry: ["notifyLoaded"],
      on: { "IMAGE.ERROR": { guard: "current", target: "error" } },
    },
    error: {
      entry: ["markFallbackReady", "notifyError"],
      on: { "ROOT.MOUNT": { actions: ["markMounted", "markFallbackReady"] } },
    },
  },
})

export type ImageStatusMachine = typeof imageStatusMachine

/** Whether the fallback is rendered: the image is not `loaded` and the delay allows it. */
export const fallbackVisible = (status: ImageStatus, fallbackReady: boolean): boolean =>
  status !== "loaded" && fallbackReady
