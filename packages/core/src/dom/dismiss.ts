// Dismissal of overlay layers by Escape, a press outside them, or focus moving outside them,
// routed through the document's layer stack. One router per document (shared by every copy
// of @rind-ui/core, like the stack), installed while any layer is dismissable.
//
// - Escape: document keydown in the bubble phase, to the topmost layer only; an inner widget
//   that handled it (preventDefault) or an IME composition keeps the layer open.
// - Outside press: tracked in the capture phase (stopPropagation-proof, radix#2782). A press
//   is outside only if it went down after the layer registered, and down and up are both
//   outside. Mouse dismisses on pointerup; touch and pen on the following click (ghost
//   clicks, radix#1658). A bare click (assistive technology) is never an outside press.
// - Outside focus: for non-modal layers only.

import { isContextMenuClick } from "../a11y/keys"
import type { DomEnv, PlatformInfo } from "../env/capabilities"
import {
  containsDeep,
  getLayerStack,
  type LayerHandle,
  type LayerId,
  type LayerStack,
} from "./layer-stack"
import { registerReset } from "./resets"

export type DismissReason = "escape-key" | "outside-press" | "outside-focus" | "parent-dismissed"

export interface DismissRequest {
  readonly reason: DismissReason
  readonly event: Event | undefined
  readonly target: Element | null
  /** Keeps the layer open; the dismissal goes no further. */
  cancel(): void
  readonly canceled: boolean
}

export interface DismissOptions {
  /** The owner closes (machine: CLOSE { reason }) unless it cancels. */
  readonly onRequest: (request: DismissRequest) => void
  /** Default true for each source. */
  readonly escape?: boolean
  readonly outsidePress?: boolean
  readonly outsideFocus?: boolean
  /** Elements that are inside although no layer holds them (persistent elements). */
  readonly isInside?: (target: Element) => boolean
}

/** Builds a request; `cancel()` marks it. */
export function dismissRequest(
  reason: DismissReason,
  event: Event | undefined,
  target: Element | null,
): DismissRequest {
  let canceled = false
  return {
    reason,
    event,
    target,
    cancel: () => {
      canceled = true
    },
    get canceled() {
      return canceled
    },
  }
}

interface Registration {
  readonly layer: LayerHandle
  readonly options: DismissOptions
  readonly modal: boolean
  /** The press counter when the layer registered: earlier presses are its opening press. */
  readonly since: number
  /** `body`'s children when it opened: later ones (extensions, third-party portals) are not outside. */
  readonly present: WeakSet<Element>
}

/** A touch held this long is a long press: no click follows, and it dismisses nothing. */
const LONG_TOUCH_MS = 500
/**
 * Past this after a short tap's pointerup, the click is not coming. Longer than the 300 ms a
 * zoomable page may delay it, so a click that does come always decides first.
 */
const CLICK_OVERDUE_MS = 350

interface Press {
  readonly seq: number
  readonly pointerType: string
  readonly downTarget: EventTarget | null
  /** Primary, not macOS Ctrl+click, single touch, not on a scrollbar. */
  readonly eligible: boolean
  readonly topmostAtStart: LayerId | undefined
  readonly downAt: number
  upTarget?: EventTarget | null
  upPoint?: { readonly x: number; readonly y: number }
}

interface Router {
  readonly registrations: Map<LayerId, Registration>
  seq: number
  remove: (() => void) | null
}

const KEY = Symbol.for("rind-ui.dismiss@1")

registerReset(() => {
  if (typeof document === "undefined") return
  ;(Reflect.get(document, KEY) as Router | undefined)?.remove?.()
  Reflect.deleteProperty(document, KEY)
})

const isElement = (t: EventTarget | null | undefined): t is Element =>
  !!t && "nodeType" in t && (t as Node).nodeType === 1

/**
 * The real target: document-level listeners see events retargeted to the shadow host, which
 * would make everything inside an open shadow root look outside its layer.
 */
const targetOf = (e: Event): EventTarget | null => e.composedPath()[0] ?? e.target

/** A press on the page's scrollbar, or on a scroll container's (ark#2925). */
function onScrollbar(doc: Document, e: PointerEvent): boolean {
  const root = doc.documentElement
  if (root.clientWidth > 0 && (e.clientX >= root.clientWidth || e.clientY >= root.clientHeight)) {
    return true
  }
  const t = targetOf(e)
  const el = isElement(t) ? (t as HTMLElement) : null
  if (!el || el.clientWidth === 0) return false
  // The scrollbar is what the box has beyond its client area and its borders.
  const style = doc.defaultView?.getComputedStyle(el)
  const border = (side: string) => Number.parseFloat(style?.getPropertyValue(side) ?? "") || 0
  const barX =
    el.offsetWidth - el.clientWidth - border("border-left-width") - border("border-right-width")
  const barY =
    el.offsetHeight - el.clientHeight - border("border-top-width") - border("border-bottom-width")
  return (barX > 0 && e.offsetX >= el.clientWidth) || (barY > 0 && e.offsetY >= el.clientHeight)
}

function install(doc: Document, stack: LayerStack, platform: () => PlatformInfo["platform"]) {
  const router: Router = { registrations: new Map(), seq: 0, remove: null }
  let press: Press | null = null
  let pressing = false
  const touches = new Set<number>()

  /** The registrations from the topmost layer down. */
  const fromTop = () =>
    stack
      .layers()
      .slice()
      .reverse()
      .map((layer) => router.registrations.get(layer.id))

  /** Inside the layer: its non-surface elements or a descendant layer. */
  const inside = (reg: Registration, t: Element) => {
    const { layer } = reg
    if (!layer.contains(t)) return false
    const options = stack.options(layer.id)
    const surfaces = options?.surfaces?.() ?? []
    if (!surfaces.some((s) => containsDeep(s, t))) return true
    const own = (options?.elements() ?? []).filter((el) => !surfaces.includes(el))
    if (own.some((el) => containsDeep(el, t))) return true
    // A descendant layer whose elements hold the target.
    return stack.layers().some((l) => l !== layer && descends(l, layer.id) && l.contains(t))
  }
  const descends = (layer: LayerHandle, ancestor: LayerId) => {
    for (let id = layer.parentId; id; id = stack.get(id)?.parentId) if (id === ancestor) return true
    return false
  }
  /** Never outside, whatever the layer: top-layer regions and nodes added after it opened. */
  const exempt = (reg: Registration, t: Element) => {
    if (t.closest("[data-rind-top-layer]")) return true
    if (reg.options.isInside?.(t)) return true
    let top: Element = t
    // Up through shadow hosts too: a node inside a web component is judged by its host.
    for (;;) {
      const up: Element | null =
        top.parentElement ?? (top.parentNode instanceof ShadowRoot ? top.parentNode.host : null)
      if (!up || up === doc.body) break
      top = up
    }
    return top.parentElement === doc.body && !reg.present.has(top)
  }
  const request = (
    reg: Registration,
    reason: DismissReason,
    event: Event,
    target: Element | null,
  ) => {
    const r = dismissRequest(reason, event, target)
    reg.options.onRequest(r)
    return !r.canceled
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== "Escape" || e.defaultPrevented) return
    if (e.isComposing || e.keyCode === 229) return
    // One dismissal per key press: holding Escape must not unwind the whole stack.
    if (e.repeat) return
    const top = stack.topmost()
    const reg = top && router.registrations.get(top.id)
    if (!reg || reg.options.escape === false) return
    // Acted on: the key is consumed (outer handlers can tell).
    if (request(reg, "escape-key", e, isElement(targetOf(e)) ? (targetOf(e) as Element) : null))
      e.preventDefault()
  }

  const onPointerDown = (e: PointerEvent) => {
    router.seq++
    pressing = true
    if (e.pointerType === "touch") touches.add(e.pointerId)
    const eligible =
      e.button === 0 &&
      !isContextMenuClick(e, platform()) &&
      touches.size <= 1 &&
      !onScrollbar(doc, e)
    press = {
      seq: router.seq,
      pointerType: e.pointerType,
      downTarget: targetOf(e),
      eligible,
      // A tooltip is never interacted with: one open (or closing) over a modal must not make
      // the modal's next backdrop press count as "not topmost".
      topmostAtStart: stack.layers().findLast((l) => stack.options(l.id)?.kind !== "tooltip")?.id,
      downAt: e.timeStamp,
    }
    if (!eligible && press && touches.size > 1) press = null
  }
  const onPointerUp = (e: PointerEvent) => {
    pressing = false
    touches.delete(e.pointerId)
    if (!press) return
    press.upTarget = targetOf(e)
    press.upPoint = { x: e.clientX, y: e.clientY }
    // Touch and pen wait for the click that follows; mouse decides now.
    if (press.pointerType === "mouse" || press.pointerType === "") {
      outsidePress(e)
      return
    }
    // iOS often sends no click for a tap on an element it does not deem clickable (a backdrop,
    // page text: radix#4207): a short tap decides on its own once the click is overdue. A long
    // touch never does (no click follows it by design).
    if (e.timeStamp - press.downAt >= LONG_TOUCH_MS) return
    const pending = press
    doc.defaultView?.setTimeout(() => {
      if (press === pending) outsidePress(e)
    }, CLICK_OVERDUE_MS)
  }
  const onPointerCancel = (e: PointerEvent) => {
    pressing = false
    touches.delete(e.pointerId)
    press = null
  }
  const onClick = (e: MouseEvent) => {
    // A bare click (detail 0: assistive technology) is never outside, and it must not consume
    // or inherit a press left over from a touch that no click followed (long-press).
    if (e.detail === 0) {
      press = null
      return
    }
    // Only the click that completes a tracked touch or pen press.
    if (press?.upTarget !== undefined && press.pointerType !== "mouse") outsidePress(e)
  }

  /** One gesture dismisses at most once: the press is consumed here. */
  function outsidePress(e: Event) {
    const p = press
    press = null
    if (!p?.eligible) return
    const down = p.downTarget
    const up = p.upTarget ?? null
    if (!isElement(down) || !isElement(up) || !up.isConnected) return
    if (p.upPoint && stack.isExitingAt(p.upPoint.x, p.upPoint.y)) return
    for (const reg of fromTop()) {
      // A layer without dismiss options is a boundary.
      if (!reg) return
      if (inside(reg, down) || inside(reg, up)) return
      if (exempt(reg, down) || exempt(reg, up)) return
      // Its opening press, or a modal that was not topmost when the press started.
      if (p.seq <= reg.since) return
      if (reg.modal && p.topmostAtStart !== reg.layer.id) return
      if (reg.options.outsidePress === false) return
      if (!request(reg, "outside-press", e, up)) return
      if (reg.modal) return
    }
  }

  const onFocusIn = (e: FocusEvent) => {
    const target = targetOf(e)
    if (!isElement(target) || pressing) return
    // Past the layer that holds the focus, the walk goes on: a layer beneath that does not
    // hold it (not an ancestor) lost focus too — a modal dialog opened from the page leaves
    // a non-modal popover behind it (ark#2610).
    let below = false
    for (const reg of fromTop()) {
      if (!reg) return
      if (inside(reg, target)) {
        below = true
        continue
      }
      // Below the focused layer, a node added after this one opened is that layer's portal,
      // not a third-party node: only the explicit exemptions apply.
      const exempted = below
        ? target.closest("[data-rind-top-layer]") !== null ||
          reg.options.isInside?.(target) === true
        : exempt(reg, target)
      if (reg.modal || exempted) return
      if (reg.options.outsideFocus === false) return
      if (!request(reg, "outside-focus", e, target)) return
    }
  }

  doc.addEventListener("keydown", onKeyDown)
  doc.addEventListener("pointerdown", onPointerDown, true)
  doc.addEventListener("pointerup", onPointerUp, true)
  doc.addEventListener("pointercancel", onPointerCancel, true)
  doc.addEventListener("click", onClick, true)
  doc.addEventListener("focusin", onFocusIn, true)
  router.remove = () => {
    doc.removeEventListener("keydown", onKeyDown)
    doc.removeEventListener("pointerdown", onPointerDown, true)
    doc.removeEventListener("pointerup", onPointerUp, true)
    doc.removeEventListener("pointercancel", onPointerCancel, true)
    doc.removeEventListener("click", onClick, true)
    doc.removeEventListener("focusin", onFocusIn, true)
  }
  return router
}

/**
 * Makes a registered layer dismissable; returns the cleanup. Active at once (no deferral):
 * Escape right after opening closes it (zag#3248).
 */
export function dismissable(
  env: DomEnv & PlatformInfo,
  layer: LayerHandle,
  options: DismissOptions & { readonly modal: boolean },
): () => void {
  if (typeof document === "undefined") return () => {}
  const root = env.dom.getRootNode()
  const doc = "body" in root ? root : root.ownerDocument
  const stack = getLayerStack(doc)
  let router = Reflect.get(doc, KEY) as Router | undefined
  if (!router?.remove) {
    router = install(doc, stack, () => env.platform)
    Reflect.set(doc, KEY, router)
  }
  const reg: Registration = {
    layer,
    options,
    modal: options.modal,
    since: router.seq,
    present: new WeakSet(doc.body ? Array.from(doc.body.children) : []),
  }
  router.registrations.set(layer.id, reg)
  const own = router
  return () => {
    if (own.registrations.get(layer.id) !== reg) return
    own.registrations.delete(layer.id)
    if (own.registrations.size === 0) {
      own.remove?.()
      Reflect.deleteProperty(doc, KEY)
    }
  }
}
