// toast-region (add-toast design §4): the hotkey that jumps into the region and back, Tab
// leaving at the region's edges (no sentinels: radix#2584), and focus moving off a toast
// that is removed (newer, else older, else back) before it becomes inert (mui/base-ui#3466).

import type { DomEnv, ModalityEnv, PlatformInfo, SchedulerEnv } from "../env/capabilities"
import { focusSafely } from "./focus-safely"
import { deepActiveElement, tabbables } from "./focus-scope"
import { describeKey, matchHotkey, parseHotkey } from "./keyboard"

export interface ToastRegionOptions {
  readonly region: () => HTMLElement | null
  /** The toasts, newest first (their root elements). */
  readonly toasts: () => readonly HTMLElement[]
  readonly hotkey: string
  /** The hotkey moved focus into the region (it expands). */
  onEnter(): void
}

export interface ToastRegion {
  stop(): void
  /** Before the toast `el` leaves: focus inside it goes to a neighbour or back. */
  leaving(el: HTMLElement): void
}

type Env = DomEnv & ModalityEnv & PlatformInfo & SchedulerEnv

const usable = (el: Element | null | undefined): el is HTMLElement =>
  el instanceof HTMLElement && el.isConnected && !el.closest("[inert]")

export function trackToastRegion(env: Env, options: ToastRegionOptions): ToastRegion {
  const hotkey = parseHotkey(options.hotkey)
  const root = env.dom.getRootNode()
  const doc = "body" in root ? root : root.ownerDocument
  /** Where focus was before the hotkey or Tab brought it in (returned to on leaving). */
  let before: Element | null = null
  /** Focus came in with a pointer: a removal returns it straight back. */
  let byPointer = false

  const inside = (el: Element | null) => {
    const region = options.region()
    return el !== null && region?.contains(el) === true
  }
  const goBack = () => {
    const candidates = [before, ...env.modality.recentFocus().filter((el) => !inside(el))]
    const target = candidates.find(usable)
    before = null
    if (target) void focusSafely(target, env, "programmatic")
  }

  const onKeyDown = (e: KeyboardEvent) => {
    const k = describeKey(e, env)
    if (!matchHotkey(hotkey, k, env.platform)) return
    const region = options.region()
    if (!region) return
    e.preventDefault()
    const active = deepActiveElement(doc)
    if (inside(active)) {
      goBack()
      return
    }
    const newest = options.toasts()[0]
    if (!newest) return
    before = active === doc.body ? null : active
    byPointer = false
    options.onEnter()
    void focusSafely(newest, env, "navigation", "keyboard")
  }

  // Tab at the region's edges leaves it: Shift+Tab before the newest toast's first stop,
  // Tab after the oldest toast's last stop.
  const onRegionKeyDown = (e: KeyboardEvent) => {
    if (e.key !== "Tab" || e.defaultPrevented || e.isComposing) return
    const region = options.region()
    if (!region || before === null) return
    const stops = tabbables(region, { scrollers: false })
    const active = deepActiveElement(doc)
    const first = stops[0]
    const last = stops.at(-1)
    if ((e.shiftKey && active === first) || (!e.shiftKey && active === last)) {
      e.preventDefault()
      goBack()
    }
  }

  const onFocusIn = (e: FocusEvent) => {
    if (!inside(e.target as Element) || inside(e.relatedTarget as Element | null)) return
    // Entered without the hotkey: remember where from (a Tab from the page, a click).
    if (before === null && e.relatedTarget instanceof Element) before = e.relatedTarget
    byPointer = env.modality.modality() === "pointer" || env.modality.modality() === "touch"
  }

  doc.addEventListener("keydown", onKeyDown)
  const region = options.region()
  region?.addEventListener("keydown", onRegionKeyDown)
  doc.addEventListener("focusin", onFocusIn, true)

  return {
    stop() {
      doc.removeEventListener("keydown", onKeyDown)
      region?.removeEventListener("keydown", onRegionKeyDown)
      doc.removeEventListener("focusin", onFocusIn, true)
    },
    leaving(el) {
      const active = deepActiveElement(doc)
      if (!active || !el.contains(active)) return
      if (byPointer) return goBack()
      const all = options.toasts().filter((t) => t !== el && usable(t))
      const order = options.toasts()
      const at = order.indexOf(el)
      const newer = order
        .slice(0, at)
        .reverse()
        .find((t) => all.includes(t))
      const older = order.slice(at + 1).find((t) => all.includes(t))
      const next = newer ?? older
      if (next) void focusSafely(next, env, "navigation", "keyboard")
      else goBack()
    },
  }
}
