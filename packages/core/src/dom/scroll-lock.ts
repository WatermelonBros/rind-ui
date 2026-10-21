// Page scroll lock while any modal layer is open: one reference-counted lock per document,
// styles applied through the CSS object model only (CSP-safe), an exact restore of what it
// changed, padding compensation unless the author reserves a stable gutter (never setting
// `scrollbar-gutter` itself: base-ui#4645), and no scroll-position change. Desktop uses no
// wheel or touch listeners (zoom and inner scrolling keep working). On iOS, where
// overflow:hidden does not stop the page, one touchmove listener prevents only page scrolls,
// deciding from the layers open at touchstart (headlessui#3890).

import type { PlatformFlags } from "../env/capabilities"
import { getLayerStack } from "./layer-stack"
import { quirkActive } from "./quirk-conditions"
import { registerReset } from "./resets"

const KEY = Symbol.for("rind-ui.scroll-lock@1")
const LOCKED_ATTR = "data-rind-scroll-locked"
const WIDTH_VAR = "--rind-scrollbar-width"

interface Saved {
  readonly value: string
  readonly priority: string
}
interface Lock {
  count: number
  readonly release: () => void
}
interface Store {
  lock: Lock | null
  /** The stack-driven singleton's teardown, once installed. */
  uninstall: (() => void) | null
}

function storeOf(doc: Document): Store {
  let store = Reflect.get(doc, KEY) as Store | undefined
  if (!store) {
    store = { lock: null, uninstall: null }
    Reflect.set(doc, KEY, store)
  }
  return store
}

registerReset(() => {
  if (typeof document === "undefined") return
  const store = Reflect.get(document, KEY) as Store | undefined
  store?.uninstall?.()
  store?.lock?.release()
  Reflect.deleteProperty(document, KEY)
})

const px = (v: string) => Number.parseFloat(v) || 0

/** The element that scrolls the page: <body> when <html> clips and <body> scrolls. */
function pageScroller(doc: Document): HTMLElement {
  const html = doc.documentElement
  const body = doc.body
  const view = doc.defaultView
  const clips = (o: string | undefined) => o === "hidden" || o === "clip"
  const scrolls = (o: string | undefined) => o === "auto" || o === "scroll"
  const htmlStyle = view?.getComputedStyle(html)
  const bodyStyle = body ? view?.getComputedStyle(body) : undefined
  if (body && clips(htmlStyle?.overflowY) && scrolls(bodyStyle?.overflowY)) return body
  return (doc.scrollingElement as HTMLElement | null) ?? html
}

/** Locks the page; returns the release. Reference counted per document. */
export function lockScroll(doc: Document, platform?: PlatformFlags): () => void {
  const store = storeOf(doc)
  if (!store.lock) store.lock = acquire(doc, store, platform)
  const lock = store.lock
  lock.count++
  let released = false
  return () => {
    if (released) return
    released = true
    if (--lock.count === 0) lock.release()
  }
}

function acquire(doc: Document, store: Store, platform?: PlatformFlags): Lock {
  const html = doc.documentElement
  const scroller = pageScroller(doc)
  const view = doc.defaultView
  const style = view?.getComputedStyle(scroller)
  const rtl = view?.getComputedStyle(html).direction === "rtl"
  const paddingProp = rtl ? "padding-left" : "padding-right"
  const isPage = scroller === html || scroller === doc.scrollingElement
  const barWidth = Math.max(
    0,
    isPage
      ? (view?.innerWidth ?? 0) - html.clientWidth
      : scroller.offsetWidth -
          scroller.clientWidth -
          px(style?.borderLeftWidth ?? "") -
          px(style?.borderRightWidth ?? ""),
  )
  const gutter = view?.getComputedStyle(html).getPropertyValue("scrollbar-gutter") ?? ""
  const compensate = barWidth > 0 && !gutter.includes("stable")

  /** What the lock sets, per element: property → value. */
  // Merged per element: the scroller is often <html> itself, which also gets the variable.
  const wanted = new Map<HTMLElement, Map<string, string>>()
  const want = (el: HTMLElement, prop: string, value: string) => {
    const props = wanted.get(el) ?? new Map<string, string>()
    props.set(prop, value)
    wanted.set(el, props)
  }
  want(scroller, "overflow", "hidden")
  if (compensate) {
    want(scroller, paddingProp, `${px(style?.getPropertyValue(paddingProp) ?? "") + barWidth}px`)
  }
  want(html, WIDTH_VAR, `${barWidth}px`)
  // Snapshot of the inline values, updated when another script changes them while locked.
  const saved = new Map<HTMLElement, Map<string, Saved>>()
  // The overflow longhands are saved too and restored after the shorthand, so an author's own
  // `overflow-y` (app shells) comes back.
  const extra = (el: HTMLElement) =>
    el === scroller ? ["overflow-x", "overflow-y"] : ([] as string[])
  for (const [el, props] of wanted) {
    const own = new Map<string, Saved>()
    for (const prop of [...props.keys(), ...extra(el)]) {
      own.set(prop, {
        value: el.style.getPropertyValue(prop),
        priority: el.style.getPropertyPriority(prop),
      })
    }
    saved.set(el, own)
  }
  const hadAttr = scroller.getAttribute(LOCKED_ATTR)

  let applying = false
  const apply = () => {
    applying = true
    for (const [el, props] of wanted) {
      for (const [prop, value] of props) el.style.setProperty(prop, value, "important")
    }
    scroller.setAttribute(LOCKED_ATTR, "")
    applying = false
  }
  // Scroll position untouched: overflow:hidden keeps scrollTop, even with smooth scrolling.
  apply()

  // A foreign change to a property we manage becomes the value to restore; the lock stays.
  const observer = view
    ? new view.MutationObserver(() => {
        if (applying) return
        let changed = false
        for (const [el, props] of wanted) {
          for (const [prop, value] of props) {
            const current = el.style.getPropertyValue(prop)
            const priority = el.style.getPropertyPriority(prop)
            if (current === value && priority === "important") continue
            // Same value, only the priority differs: a foreign lock re-wrote our own value
            // (base-ui#4640). It is not the author's value, so keep the snapshot and re-apply.
            if (current === value) {
              changed = true
              continue
            }
            for (const p of prop === "overflow" ? [prop, ...extra(el)] : [prop]) {
              saved.get(el)?.set(p, {
                value: el.style.getPropertyValue(p),
                priority: el.style.getPropertyPriority(p),
              })
            }
            changed = true
          }
        }
        if (changed) apply()
      })
    : null
  for (const el of wanted.keys())
    observer?.observe(el, { attributes: true, attributeFilter: ["style"] })

  const removeTouch =
    platform && quirkActive("ios-overflow-hidden-scroll", { platform })
      ? touchPolicy(doc)
      : () => {}

  return {
    count: 0,
    release: () => {
      observer?.disconnect()
      removeTouch()
      for (const [el, props] of saved) {
        for (const [prop, { value, priority }] of props) {
          if (value === "") el.style.removeProperty(prop)
          else el.style.setProperty(prop, value, priority)
        }
      }
      if (hadAttr === null) scroller.removeAttribute(LOCKED_ATTR)
      else scroller.setAttribute(LOCKED_ATTR, hadAttr)
      store.lock = null
    },
  }
}

/** The nearest ancestor of `el` (inclusive) that can scroll further along the gesture. */
function canScroll(el: Element | null, dx: number, dy: number, page: Element): boolean {
  for (let n = el; n && n !== page; n = n.parentElement) {
    const style = n.ownerDocument.defaultView?.getComputedStyle(n)
    const scrollsY = /auto|scroll/.test(style?.overflowY ?? "") && n.scrollHeight > n.clientHeight
    const scrollsX = /auto|scroll/.test(style?.overflowX ?? "") && n.scrollWidth > n.clientWidth
    const vertical = Math.abs(dy) >= Math.abs(dx)
    if (vertical && scrollsY) {
      // Finger down (dy > 0) scrolls towards the top.
      if (dy > 0 ? n.scrollTop > 0 : n.scrollTop + n.clientHeight < n.scrollHeight) return true
    }
    if (!vertical && scrollsX) {
      if (dx > 0 ? n.scrollLeft > 0 : n.scrollLeft + n.clientWidth < n.scrollWidth) return true
    }
  }
  return false
}

/** iOS: prevent only touchmoves that would scroll the page behind the topmost modal. */
function touchPolicy(doc: Document): () => void {
  const stack = getLayerStack(doc)
  let start: {
    readonly x: number
    readonly y: number
    readonly target: Element | null
    readonly allowed: boolean
  } | null = null
  const onTouchStart = (e: TouchEvent) => {
    const touch = e.touches[0]
    const target = e.target instanceof Element ? e.target : null
    // Read the layers open now, not when the lock started (sibling dialogs, headlessui#3890).
    const top = stack.topmostModal()
    const insideLayer = !!top && top.contains(target)
    const allowed =
      e.touches.length > 1 ||
      !!target?.closest("input[type='range']") ||
      !!target?.closest("input, textarea, [contenteditable]")
    start = touch
      ? { x: touch.clientX, y: touch.clientY, target: insideLayer ? target : null, allowed }
      : null
  }
  const onTouchMove = (e: TouchEvent) => {
    const touch = e.touches[0]
    if (!start || !touch || e.touches.length > 1 || start.allowed) return
    const dx = touch.clientX - start.x
    const dy = touch.clientY - start.y
    // A touch-action that excludes this axis: the element handles the gesture (RA#9493).
    const vertical = Math.abs(dy) >= Math.abs(dx)
    for (let n = start.target; n; n = n.parentElement) {
      const action = n.ownerDocument.defaultView?.getComputedStyle(n).touchAction ?? "auto"
      if (action === "auto" || action === "manipulation") continue
      const panX = /pan-x|pan-left|pan-right/.test(action)
      const panY = /pan-y|pan-up|pan-down/.test(action)
      if ((vertical && !panY) || (!vertical && !panX)) return
      break
    }
    if (!start.target || !canScroll(start.target, dx, dy, pageScroller(doc))) e.preventDefault()
  }
  doc.addEventListener("touchstart", onTouchStart, { passive: true, capture: true })
  doc.addEventListener("touchmove", onTouchMove, { passive: false, capture: true })
  return () => {
    doc.removeEventListener("touchstart", onTouchStart, { capture: true })
    doc.removeEventListener("touchmove", onTouchMove, { capture: true })
  }
}

/**
 * Installs the document's scroll-lock singleton (idempotent): locked exactly while any
 * modal layer is open, synchronously on every stack change (reka-ui#2480, ariakit#2528).
 * Modal layers' elements get `overscroll-behavior: contain` while locked.
 */
export function lockScrollForModals(doc: Document, platform?: PlatformFlags): void {
  const store = storeOf(doc)
  if (store.uninstall) return
  const stack = getLayerStack(doc)
  let release: (() => void) | null = null
  const contained = new Map<HTMLElement, Saved>()
  const recompute = () => {
    const modals = stack.layers().filter((l) => stack.options(l.id)?.modal)
    if (modals.length > 0 && !release) release = lockScroll(doc, platform)
    if (modals.length === 0 && release) {
      release()
      release = null
    }
    const elements = new Set(
      modals
        .flatMap((l) => stack.options(l.id)?.elements() ?? [])
        .filter((el): el is HTMLElement => el instanceof HTMLElement),
    )
    for (const [el, previous] of contained) {
      if (elements.has(el)) continue
      if (previous.value === "") el.style.removeProperty("overscroll-behavior")
      else el.style.setProperty("overscroll-behavior", previous.value, previous.priority)
      contained.delete(el)
    }
    for (const el of elements) {
      if (contained.has(el)) continue
      contained.set(el, {
        value: el.style.getPropertyValue("overscroll-behavior"),
        priority: el.style.getPropertyPriority("overscroll-behavior"),
      })
      el.style.setProperty("overscroll-behavior", "contain")
    }
  }
  const unsubscribe = stack.subscribe(recompute)
  store.uninstall = () => {
    unsubscribe()
    release?.()
    release = null
    for (const [el, previous] of contained) {
      if (previous.value === "") el.style.removeProperty("overscroll-behavior")
      else el.style.setProperty("overscroll-behavior", previous.value, previous.priority)
    }
    contained.clear()
    store.uninstall = null
  }
  recompute()
}
