// Focus containment without sentinels: outside content is inert, so containment only has to
// wrap Tab at the edges of the topmost modal layer and recover when the focused element is
// removed. Initial focus moves into a layer once, within a frame. All moves go through
// focusSafely (modality kept; cause "layer" for initial focus, "navigation" for wrapping).

import type { Modality } from "../contract/env"
import type {
  DomEnv,
  ModalityEnv,
  MotionEnv,
  PlatformInfo,
  SchedulerEnv,
} from "../env/capabilities"
import { focusSafely } from "./focus-safely"
import { getLayerStack, type LayerHandle, type LayerId } from "./layer-stack"
import { registerReset } from "./resets"

/** `false`: do not move focus; `null`: the default target. */
export type FocusTarget = HTMLElement | null | false

export type FocusEnv = DomEnv &
  SchedulerEnv &
  ModalityEnv &
  Partial<MotionEnv> &
  Partial<PlatformInfo>

/** The focused element, through open shadow roots. */
export function deepActiveElement(doc: Document): Element | null {
  let active: Element | null = doc.activeElement
  while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement
  return active
}

/** `node` inside `container`, through shadow roots the node lives in. */
export function containsDeep(container: Node, node: Node | null): boolean {
  for (let n: Node | null = node; n; ) {
    if (n === container || container.contains(n)) return true
    const root = n.getRootNode()
    n = root instanceof ShadowRoot ? root.host : null
  }
  return false
}

const hiddenByStyle = (el: Element) => {
  const style = el.ownerDocument.defaultView?.getComputedStyle(el)
  return style?.display === "none" || style?.visibility === "hidden"
}
/** Not rendered, hidden or inert, up to `container`. */
function unavailable(el: HTMLElement, container: Element): boolean {
  if (el.closest("[inert]")) return true
  for (let n: Element | null = el; n && n !== container.parentElement; n = n.parentElement) {
    if ((n as HTMLElement).hidden || hiddenByStyle(n)) return true
  }
  return false
}

const FOCUSABLE =
  "a[href], area[href], button, input, select, textarea, iframe, summary, [contenteditable], [tabindex]"

/** A scroll container the browser makes keyboard focusable: scrollable, nothing focusable inside. */
function isKeyboardScroller(el: HTMLElement): boolean {
  if (el.hasAttribute("tabindex")) return false
  const style = el.ownerDocument.defaultView?.getComputedStyle(el)
  const scrolls = (overflow: string | undefined) => overflow === "auto" || overflow === "scroll"
  const overflowsY = scrolls(style?.overflowY) && el.scrollHeight > el.clientHeight
  const overflowsX = scrolls(style?.overflowX) && el.scrollWidth > el.clientWidth
  return (overflowsY || overflowsX) && !el.querySelector(FOCUSABLE)
}

function isTabStop(el: HTMLElement, scrollers: boolean): boolean {
  if (el.matches(":disabled")) return false
  if (el.tabIndex >= 0 && (el.matches(FOCUSABLE) || el.isContentEditable)) return true
  return scrollers && isKeyboardScroller(el)
}

/** The engine's tab stops: WebKit does not stop on scroll containers. */
const stopsOf = (env: FocusEnv, container: HTMLElement) =>
  // platform-convention: Safari's Tab order has no scroll containers (not a bug to work around)
  tabbables(container, { scrollers: env.platform?.webkit !== true })

/** Every element under `root`, in document order, through open shadow roots. */
function* walk(root: Element | ShadowRoot): Generator<HTMLElement> {
  for (const child of Array.from(root.children)) {
    if (child instanceof HTMLElement) yield child
    if (child.shadowRoot) yield* walk(child.shadowRoot)
    yield* walk(child)
  }
}

/**
 * The container's tab stops in the order Tab visits them: positive `tabindex` first
 * (ascending, document order within one value), then document order; one stop per radio
 * group (the checked radio, or the first); keyboard-focusable scroll containers included
 * (react-spectrum#10395) unless `scrollers` is false (WebKit: Safari's Tab skips them and
 * they refuse focus); inert, hidden and disabled elements skipped.
 */
export function tabbables(
  container: HTMLElement,
  { scrollers = true }: { readonly scrollers?: boolean } = {},
): HTMLElement[] {
  const stops = [...walk(container)].filter(
    (el) => isTabStop(el, scrollers) && !unavailable(el, container),
  )
  const radios = new Map<string, HTMLInputElement[]>()
  for (const el of stops) {
    if (el instanceof HTMLInputElement && el.type === "radio" && el.name) {
      const key = `${el.form ? "form" : "doc"}:${el.name}`
      radios.set(key, [...(radios.get(key) ?? []), el])
    }
  }
  const radioStop = (el: HTMLInputElement) => {
    const group = radios.get(`${el.form ? "form" : "doc"}:${el.name}`) ?? [el]
    return (group.find((r) => r.checked) ?? group[0]) === el
  }
  const filtered = stops.filter(
    (el) => !(el instanceof HTMLInputElement && el.type === "radio" && el.name) || radioStop(el),
  )
  const positive = filtered.filter((el) => el.tabIndex > 0).sort((a, b) => a.tabIndex - b.tabIndex)
  return [...positive, ...filtered.filter((el) => el.tabIndex <= 0)]
}

/** Makes the container focusable as the fallback target. */
function focusableContainer(container: HTMLElement): HTMLElement {
  if (!container.hasAttribute("tabindex")) container.setAttribute("tabindex", "-1")
  return container
}

/**
 * Moves focus into a layer no later than the next frame: the consumer's choice (`false`:
 * stay), `[data-autofocus]`, the first tab stop, or the container. Opened by touch, the
 * default is the container (no on-screen keyboard). If focus moved since `before` (the
 * focused element when the layer opened; default: now), or is already inside the container
 * (an autoFocus field), it is left alone (ariakit#7033, reka-ui#2886). Returns a cancel.
 */
export function focusInitial(
  env: FocusEnv,
  container: HTMLElement,
  pick?: () => FocusTarget,
  modality?: Modality,
  before: Element | null = deepActiveElement(container.ownerDocument),
): () => void {
  const doc = container.ownerDocument
  let frame: ReturnType<typeof env.scheduler.requestAnimationFrame> | null = null
  let stopped = false
  const attempt = async (left: number) => {
    frame = null
    const now = deepActiveElement(doc)
    // Moved by the user or the app: leave it. Focus lost to <body> (the trigger became
    // inert and the browser blurred it) is no one's move.
    const lost = !now || now === doc.body
    if (!container.isConnected || (now !== before && !lost)) return
    if (now && containsDeep(container, now)) return
    const chosen = pick?.() ?? null
    if (chosen === false) return
    const target =
      chosen ??
      container.querySelector<HTMLElement>("[data-autofocus]") ??
      (modality === "touch" ? null : stopsOf(env, container)[0]) ??
      focusableContainer(container)
    await focusSafely(target, env, "layer")
    // Refused: on a 1-CPU Linux WebKit run (CI) the first move left focus on <body> with the
    // dialog open (1 run in 4). The exact condition was not isolated; the candidates are the
    // content's ancestors still marked inert by the previous outside-hiding pass, or the
    // portalled content not laid out yet (a box-less target cannot take focus). Any such
    // refusal is transient, so try again on the next frames while nothing else took focus —
    // bounded, and never after the layer closed.
    const after = deepActiveElement(doc)
    const refused = !after || after === doc.body
    if (refused && left > 0 && !stopped && container.isConnected) {
      frame = env.scheduler.requestAnimationFrame(() => void attempt(left - 1))
    }
  }
  frame = env.scheduler.requestAnimationFrame(() => void attempt(INITIAL_FOCUS_RETRIES))
  return () => {
    stopped = true
    if (frame !== null) env.scheduler.cancelAnimationFrame(frame)
    frame = null
  }
}

/** Frames initial focus retries a refused move (a slow first layout, a late inert update). */
const INITIAL_FOCUS_RETRIES = 30

/** Wraps Tab at the container's edges; returns the cleanup. Used alone or by the singleton. */
export function trapTab(env: FocusEnv, container: HTMLElement): () => void {
  const doc = container.ownerDocument
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== "Tab" || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return
    wrap(env, container, e)
  }
  doc.addEventListener("keydown", onKeyDown, true)
  return () => doc.removeEventListener("keydown", onKeyDown, true)
}

function wrap(env: FocusEnv, container: HTMLElement, e: KeyboardEvent) {
  const doc = container.ownerDocument
  const active = deepActiveElement(doc)
  // Only Tab presses from inside the layer (or with focus lost to body) are contained.
  if (active && active !== doc.body && !containsDeep(container, active)) return
  const stops = stopsOf(env, container)
  const first = stops[0]
  const last = stops.at(-1)
  const move = (target: HTMLElement) => {
    e.preventDefault()
    void focusSafely(target, env, "navigation")
  }
  if (!first || !last) return move(focusableContainer(container))
  if (stops.length === 1) return move(first)
  const outside = !active || active === doc.body || !stops.includes(active as HTMLElement)
  if (e.shiftKey && (active === first || active === container || (outside && active !== last))) {
    return move(last)
  }
  if (!e.shiftKey && (active === last || (outside && active !== first && active !== container))) {
    move(first)
  }
}

interface Containment {
  readonly containers: Map<LayerId, HTMLElement>
  /** Watches a shadow root for removals too (a body observer does not see inside it). */
  readonly observe: (root: Node) => void
  readonly remove: () => void
}
const containments = new WeakMap<Document, Containment>()
registerReset(() => {
  if (typeof document === "undefined") return
  containments.get(document)?.remove()
  containments.delete(document)
})

/**
 * Registers a layer's container for the document's containment singleton: Tab wraps and
 * removed focus recovers inside the topmost MODAL layer only; a modal above pauses the one
 * beneath without moving focus. Returns the cleanup.
 */
export function containFocus(
  env: FocusEnv,
  layer: LayerHandle,
  container: HTMLElement,
): () => void {
  const doc = container.ownerDocument
  let c = containments.get(doc)
  if (!c) {
    c = install(env, doc)
    containments.set(doc, c)
  }
  c.containers.set(layer.id, container)
  const root = container.getRootNode()
  if (root instanceof ShadowRoot) c.observe(root)
  const own = c
  return () => {
    if (own.containers.get(layer.id) !== container) return
    own.containers.delete(layer.id)
    if (own.containers.size === 0) {
      own.remove()
      containments.delete(doc)
    }
  }
}

function install(env: FocusEnv, doc: Document): Containment {
  const containers = new Map<LayerId, HTMLElement>()
  const stack = getLayerStack(doc)
  const current = () => {
    const top = stack.topmostModal()
    return top ? containers.get(top.id) : undefined
  }
  /** The element last focused inside the current container (recovery is keyed on it). */
  let lastFocused: Element | null = null
  const watch = { childList: true, subtree: true }
  const onKeyDown = (e: KeyboardEvent) => {
    const container = current()
    if (!container || e.key !== "Tab" || e.defaultPrevented) return
    if (e.altKey || e.ctrlKey || e.metaKey) return
    wrap(env, container, e)
  }
  const onFocusIn = () => {
    const container = current()
    const active = deepActiveElement(doc)
    if (!container || !active || !containsDeep(container, active)) return
    lastFocused = active
    // A removal inside a shadow root is invisible to the body observer.
    const root = active.getRootNode()
    if (root instanceof ShadowRoot) observer.observe(root, watch)
  }
  // Only a real removal of the focused element triggers recovery; `body` reported as active
  // while it is still connected (TalkBack swipes, react-spectrum#7471) does not.
  const observer = new (doc.defaultView?.MutationObserver ?? MutationObserver)(() => {
    const container = current()
    if (!container || !lastFocused || lastFocused.isConnected) return
    lastFocused = null
    void focusSafely(focusableContainer(container), env, "layer")
  })
  observer.observe(doc.body ?? doc.documentElement, { childList: true, subtree: true })
  doc.addEventListener("keydown", onKeyDown, true)
  doc.addEventListener("focusin", onFocusIn, true)
  return {
    containers,
    observe: (root) => observer.observe(root, watch),
    remove: () => {
      observer.disconnect()
      doc.removeEventListener("keydown", onKeyDown, true)
      doc.removeEventListener("focusin", onFocusIn, true)
    },
  }
}
