// The default announcer: live regions done right (AT note root cause D).
// - One polite and one assertive region per document, created eagerly by prepare() when
//   the first component that may announce mounts, and kept for the life of the document.
// - Text is inserted no earlier than the next animation frame, as a new node per message,
//   so repeats are additions; nodes are removed after 7 s.
// - Keyed messages are debounced (500 ms): a pending message with the same key is replaced.
// - Messages are dropped while the document is hidden.
// - The container carries data-live-announcer and data-rind-top-layer (kept visible by
//   hide-outside operations) and is never moved.
// - Optional backend: ariaNotify, when the browser supports it, falling back per call.

import type {
  Announcement,
  Announcer,
  DomEnv,
  SchedulerEnv,
  TimerHandle,
} from "../env/capabilities"
import { registerReset } from "./resets"
import { applyVisuallyHidden } from "./visually-hidden"

export const KEY_DEBOUNCE_MS = 500
export const MESSAGE_LIFETIME_MS = 7000

interface Regions {
  readonly container: HTMLElement
  readonly polite: HTMLElement
  readonly assertive: HTMLElement
  /** Carries `lang` per message for ariaNotify. */
  readonly notifier: HTMLElement
}

const documents = new Map<Document, Regions>()
interface Pending {
  readonly handle: TimerHandle
  readonly clear: (handle: TimerHandle) => void
}
const pendingByDocument = new Map<Document, Map<string, Pending>>()
/** Bumped by the test reset: callbacks scheduled before it do nothing. */
let generation = 0

/** Every message actually spoken (inserted or notified), for @rind-ui/testing's log. */
export const ANNOUNCEMENTS = Symbol.for("rind-ui.announcements")
/**
 * How many messages are waiting for their debounce or frame, so @rind-ui/testing can wait
 * for them (the log only holds what was actually spoken).
 */
export const PENDING_ANNOUNCEMENTS = Symbol.for("rind-ui.announcements.pending")
const pendingCount = (delta: number) =>
  Reflect.set(
    globalThis,
    PENDING_ANNOUNCEMENTS,
    Math.max(
      0,
      ((Reflect.get(globalThis, PENDING_ANNOUNCEMENTS) as number | undefined) ?? 0) + delta,
    ),
  )

function record(a: Announcement) {
  const log: Announcement[] | undefined = Reflect.get(globalThis, ANNOUNCEMENTS)
  log?.push({
    message: a.message,
    priority: a.priority ?? "polite",
    ...(a.key ? { key: a.key } : {}),
    ...(a.lang ? { lang: a.lang } : {}),
  })
}

registerReset(() => {
  for (const regions of documents.values()) regions.container.remove()
  documents.clear()
  // Nothing scheduled in one test may be spoken (or logged) in the next.
  for (const timers of pendingByDocument.values()) {
    for (const { handle, clear } of timers.values()) clear(handle)
  }
  pendingByDocument.clear()
  generation++
  Reflect.set(globalThis, PENDING_ANNOUNCEMENTS, 0)
})

function region(doc: Document, live: "polite" | "assertive") {
  const el = doc.createElement("div")
  el.setAttribute("role", "log")
  el.setAttribute("aria-live", live)
  el.setAttribute("aria-relevant", "additions")
  return el
}

/** Creates the regions once per document, appended to `body` (outside any inert subtree). */
function ensureRegions(doc: Document): Regions {
  const existing = documents.get(doc)
  if (existing?.container.isConnected) return existing
  const container = doc.createElement("div")
  container.setAttribute("data-live-announcer", "")
  container.setAttribute("data-rind-top-layer", "")
  applyVisuallyHidden(container)
  const polite = region(doc, "polite")
  const assertive = region(doc, "assertive")
  const notifier = doc.createElement("div")
  container.append(polite, assertive, notifier)
  doc.body.append(container)
  const regions = { container, polite, assertive, notifier }
  documents.set(doc, regions)
  return regions
}

type AriaNotifier = HTMLElement & {
  ariaNotify?: (message: string, options?: { priority?: "normal" | "high" }) => void
}

export interface LiveAnnouncerOptions {
  /** `live-region` (default) or `aria-notify` (falls back to live regions per call). */
  readonly backend?: "live-region" | "aria-notify"
}

export function liveAnnouncer(
  env: SchedulerEnv & DomEnv,
  options: LiveAnnouncerOptions = {},
): Announcer {
  const docOf = (): Document | null => {
    if (typeof document === "undefined") return null
    const root = env.dom.getRootNode()
    return "body" in root ? root : root.ownerDocument
  }
  const insert = (doc: Document, a: Announcement) => {
    const regions = ensureRegions(doc)
    if (options.backend === "aria-notify") {
      const notifier = regions.notifier as AriaNotifier
      if (typeof notifier.ariaNotify === "function") {
        // Cleared when absent: the previous message's language must not leak.
        notifier.lang = a.lang ?? ""
        record(a)
        notifier.ariaNotify(a.message, { priority: a.priority === "assertive" ? "high" : "normal" })
        return
      }
    }
    // Next frame: the region must exist before the text arrives (RA#5191).
    pendingCount(1)
    const scheduled = generation
    env.scheduler.requestAnimationFrame(() => {
      if (scheduled !== generation) return
      pendingCount(-1)
      if (doc.hidden) return
      record(a)
      const node = doc.createElement("div")
      if (a.lang) node.lang = a.lang
      node.textContent = a.message
      ;(a.priority === "assertive" ? regions.assertive : regions.polite).append(node)
      env.scheduler.setTimeout(() => node.remove(), MESSAGE_LIFETIME_MS)
    })
  }
  return {
    prepare() {
      const doc = docOf()
      if (doc) ensureRegions(doc)
      // The regions stay for the life of the document.
      return () => {}
    },
    announce(a) {
      const doc = docOf()
      if (!doc || doc.hidden) return
      ensureRegions(doc)
      if (!a.key) {
        insert(doc, a)
        return
      }
      let pending = pendingByDocument.get(doc)
      if (!pending) {
        pending = new Map()
        pendingByDocument.set(doc, pending)
      }
      const previous = pending.get(a.key)
      if (previous !== undefined) previous.clear(previous.handle)
      else pendingCount(1)
      const timers = pending
      const key = a.key
      const scheduled = generation
      const handle = env.scheduler.setTimeout(() => {
        if (scheduled !== generation) return
        timers.delete(key)
        pendingCount(-1)
        if (!doc.hidden) insert(doc, a)
      }, KEY_DEBOUNCE_MS)
      timers.set(key, { handle, clear: (h) => env.scheduler.clearTimeout(h) })
    },
    cancel(key) {
      const doc = docOf()
      const timers = doc && pendingByDocument.get(doc)
      const pending = timers?.get(key)
      if (pending === undefined || !timers) return
      pending.clear(pending.handle)
      timers.delete(key)
      pendingCount(-1)
    },
  }
}
