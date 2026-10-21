// Hover for parts that opt in: only mouse and pen pointers. Touch never hovers, including
// the emulated `mouse` pointer events iOS fires right after a touch (quirk
// `ios-emulated-mouse-after-touch`). `data-hover` comes from connect, via isHovered().

import type { HoverEvent } from "../a11y/events"
import type { DomEnv, ModalityEnv, PlatformInfo, SchedulerEnv } from "../env/capabilities"
import { quirkActive } from "./quirk-conditions"

export interface HoverPointerEvent {
  readonly pointerType: string
  readonly currentTarget: EventTarget | null
}

/** How long after a touch iOS may still fire emulated mouse events. */
const EMULATED_MOUSE_MS = 50

const recentTouch = new WeakMap<Document, boolean>()
const watching = new WeakSet<Document>()

/** Remembers touches per document so emulated mouse events after them can be ignored. */
function watchTouches(doc: Document, env: SchedulerEnv) {
  if (watching.has(doc)) return
  watching.add(doc)
  const onTouchEnd = () => {
    recentTouch.set(doc, true)
    env.scheduler.setTimeout(() => recentTouch.set(doc, false), EMULATED_MOUSE_MS)
  }
  doc.addEventListener("pointerup", (e) => e.pointerType === "touch" && onTouchEnd(), true)
  doc.addEventListener("touchend", onTouchEnd, true)
}

/** A mouse event iOS emulates right after a touch (never a hover). */
export function isEmulatedMouse(
  env: ModalityEnv & PlatformInfo & SchedulerEnv & DomEnv,
  doc: Document | undefined,
): boolean {
  if (!doc || !quirkActive("ios-emulated-mouse-after-touch", env)) return false
  watchTouches(doc, env)
  return recentTouch.get(doc) === true
}

export interface HoverOptions {
  readonly env: ModalityEnv & PlatformInfo & SchedulerEnv & DomEnv
  readonly send: (event: HoverEvent) => void
  readonly disabled?: () => boolean
}

export function createHover(options: HoverOptions) {
  const { env, send } = options
  // The watcher must see the FIRST tap's touch, before any hover reaches this part.
  if (typeof document !== "undefined" && quirkActive("ios-emulated-mouse-after-touch", env)) {
    const root = env.dom.getRootNode()
    watchTouches("body" in root ? root : root.ownerDocument, env)
  }
  const listeners = new Set<(hovered: boolean) => void>()
  let hovered: "mouse" | "pen" | null = null
  const set = (next: "mouse" | "pen" | null) => {
    const was = hovered
    hovered = next
    if (was === next) return
    for (const l of listeners) l(next !== null)
    if (next) send({ type: "HOVER.START", modality: "pointer", pointerType: next })
    else if (was) send({ type: "HOVER.END", modality: "pointer", pointerType: was })
  }
  const props = {
    onPointerEnter(e: HoverPointerEvent) {
      if (options.disabled?.()) return
      if (e.pointerType !== "mouse" && e.pointerType !== "pen") return
      const doc = (e.currentTarget as Element | null)?.ownerDocument
      if (doc && quirkActive("ios-emulated-mouse-after-touch", env) && recentTouch.get(doc)) return
      set(e.pointerType)
    },
    onPointerLeave(e: HoverPointerEvent) {
      if (e.pointerType !== "mouse" && e.pointerType !== "pen") return
      set(null)
    },
  }
  return {
    props,
    isHovered: () => hovered !== null,
    subscribe(listener: (hovered: boolean) => void) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    /** Ends a hover the part can no longer receive (e.g. it became disabled). */
    reset: () => set(null),
  }
}
