// Per-window interaction modality tracker (keyboard / pointer / touch / virtual), and the
// cause of every focus. A port of React Aria's useFocusVisible rules without patching
// HTMLElement.prototype.focus: rind-ui marks its own focus moves (focusSafely) instead, so
// a consumer's bare focus() counts as `virtual`, like the native :focus-visible heuristic.

import type { FocusCause } from "../a11y/events"
import type { Modality } from "../contract/env"
import type { ModalitySource, PlatformFlags } from "../env/capabilities"
import { quirkActive } from "./quirks"

interface WindowState {
  modality: Modality
  readonly listeners: Set<(modality: Modality) => void>
  subscribers: number
  /** The element the last pointer or key press started on (a bare click elsewhere is AT). */
  pressTarget: EventTarget | null
  /** What happened since the last focus: decides the next focus's cause. */
  inputBeforeFocus: "key" | "pointer" | null
  /** The element focused when the window lost focus, until it gets focus back. */
  windowBlurred: Element | null
  /** Focus moves rind-ui is about to make, with their cause. */
  readonly marked: WeakMap<Element, FocusCause>
  readonly causes: WeakMap<Element, FocusCause>
  /** The last focused elements, oldest first (bounded). */
  readonly recent: WeakRef<Element>[]
  readonly remove: () => void
}

const states = new WeakMap<Window, WindowState>()
/** How many recent focus targets are kept for focus restore. */
const RECENT_FOCUS = 8

const MODIFIERS = new Set([
  "Shift",
  "Control",
  "Alt",
  "Meta",
  "CapsLock",
  "Fn",
  "FnLock",
  "OS",
  "AltGraph",
])
const TEXT_TYPES = new Set([
  "text",
  "search",
  "url",
  "tel",
  "email",
  "password",
  "number",
  "date",
  "datetime-local",
  "month",
  "time",
  "week",
])

const COMBOBOX_NAVIGATION = new Set([
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Home",
  "End",
  "PageUp",
  "PageDown",
])
/** Navigation keys in a combobox input move the highlighted option: keyboard navigation. */
const isComboboxNavigation = (e: KeyboardEvent) =>
  COMBOBOX_NAVIGATION.has(e.key) &&
  !!e.target &&
  "getAttribute" in e.target &&
  (e.target as Element).getAttribute("role") === "combobox"

function isTextEntry(target: EventTarget | null): boolean {
  if (!target || !("tagName" in target)) return false
  const el = target as HTMLElement
  if (el.isContentEditable) return true
  if (el.tagName === "TEXTAREA") return true
  return el.tagName === "INPUT" && TEXT_TYPES.has((el as HTMLInputElement).type)
}

/** A key that means "the user is using the keyboard" (not ⌘+Tab, not a lone modifier). */
function isKeyboardInput(e: KeyboardEvent, platform: PlatformFlags): boolean {
  if (MODIFIERS.has(e.key)) return false
  if (e.metaKey || e.ctrlKey) return false
  // Option produces characters on Apple keyboards; elsewhere Alt is a shortcut.
  // platform-convention: Option types characters on Apple keyboards
  if (e.altKey && !platform.apple) return false
  return true
}

function isVirtualPointer(e: PointerEvent, platform: PlatformFlags): boolean {
  if (e.pointerType === "") return true
  const env = { platform }
  if (quirkActive("ios-vo-zero-size-pointer", env) && e.width === 0 && e.height === 0) return true
  return (
    quirkActive("chromium-at-click-1x1", env) &&
    e.width === 1 &&
    e.height === 1 &&
    e.pressure === 0 &&
    e.detail === 0 &&
    e.pointerType === "mouse"
  )
}

function install(win: Window, platform: PlatformFlags): WindowState {
  const doc = win.document
  const set = (state: WindowState, modality: Modality) => {
    if (state.modality === modality) return
    state.modality = modality
    for (const l of state.listeners) l(modality)
  }
  const onKey = (e: KeyboardEvent) => {
    state.inputBeforeFocus = "key"
    if (e.type === "keydown") state.pressTarget = e.target
    if (!isKeyboardInput(e, platform)) return
    // Typing in a text field after a click is not "keyboard navigation": only Tab and
    // Escape turn the ring on there.
    const pointerish = state.modality === "pointer" || state.modality === "touch"
    const ringKey = e.key === "Tab" || e.key === "Escape" || isComboboxNavigation(e)
    if (pointerish && isTextEntry(e.target) && !ringKey) return
    set(state, "keyboard")
  }
  const onPointerDown = (e: PointerEvent) => {
    state.pressTarget = e.target
    if (isVirtualPointer(e, platform)) {
      set(state, "virtual")
      return
    }
    state.inputBeforeFocus = "pointer"
    set(state, e.pointerType === "touch" ? "touch" : "pointer")
  }
  const onClick = (e: MouseEvent) => {
    // AT activation: a click with detail 0 that no press on this element started.
    if (e.detail === 0 && state.pressTarget !== e.target) set(state, "virtual")
    state.pressTarget = null
  }
  const onFocus = (e: FocusEvent) => {
    // Window and document focus are the window regaining focus, not an element's focus.
    if (e.target === win || e.target === doc || !e.target || !("nodeType" in e.target)) {
      return
    }
    // An event target with a nodeType that is not the document is an element here.
    const target = e.target as Element
    const marked = state.marked.get(target)
    let cause: FocusCause
    if (marked) {
      // rind-ui's own move: keeps the current modality.
      state.marked.delete(target)
      cause = marked
    } else if (state.inputBeforeFocus) {
      cause = state.inputBeforeFocus
    } else if (state.windowBlurred === target) {
      // The window regaining focus restores the element that had it. Any other element
      // is someone else's move (e.g. the VoiceOver cursor after an empty refocus).
      cause = "window"
    } else {
      cause = "other"
      set(state, "virtual")
    }
    state.causes.set(target, cause)
    state.recent.push(new WeakRef(target))
    if (state.recent.length > RECENT_FOCUS) state.recent.shift()
    state.inputBeforeFocus = null
    state.windowBlurred = null
  }
  const onWindowBlur = (e: FocusEvent) => {
    // Only the window itself (no nodeType); element blurs also reach this capture listener.
    if (e.target && "nodeType" in e.target) return
    // The element the window will give focus back to (activeElement survives the blur).
    const active = doc.activeElement
    state.windowBlurred = active && active !== doc.body ? active : null
    state.inputBeforeFocus = null
  }
  const capture = { capture: true } as const
  doc.addEventListener("keydown", onKey, capture)
  doc.addEventListener("keyup", onKey, capture)
  doc.addEventListener("pointerdown", onPointerDown, capture)
  doc.addEventListener("click", onClick, capture)
  win.addEventListener("focus", onFocus, capture)
  win.addEventListener("blur", onWindowBlur, capture)
  const state: WindowState = {
    modality: "keyboard",
    listeners: new Set(),
    subscribers: 0,
    pressTarget: null,
    inputBeforeFocus: null,
    windowBlurred: null,
    marked: new WeakMap(),
    causes: new WeakMap(),
    recent: [],
    remove: () => {
      doc.removeEventListener("keydown", onKey, capture)
      doc.removeEventListener("keyup", onKey, capture)
      doc.removeEventListener("pointerdown", onPointerDown, capture)
      doc.removeEventListener("click", onClick, capture)
      win.removeEventListener("focus", onFocus, capture)
      win.removeEventListener("blur", onWindowBlur, capture)
    },
  }
  return state
}

/** The modality capability for the window of `getRootNode()`; nothing runs on the server. */
export function modalityTracker(
  getRootNode: () => Document | ShadowRoot,
  getPlatform: () => PlatformFlags,
): ModalitySource {
  const windowOf = (): Window | null => {
    if (typeof document === "undefined") return null
    const root = getRootNode()
    return ("defaultView" in root ? root.defaultView : root.ownerDocument.defaultView) ?? null
  }
  const stateOf = (create: boolean): WindowState | undefined => {
    const win = windowOf()
    if (!win) return undefined
    let state = states.get(win)
    if (!state && create) {
      state = install(win, getPlatform())
      states.set(win, state)
    }
    return state
  }
  return {
    modality: () => stateOf(false)?.modality ?? "keyboard",
    subscribe(listener) {
      const win = windowOf()
      const state = stateOf(true)
      if (!win || !state) return () => {}
      state.subscribers++
      state.listeners.add(listener)
      let subscribed = true
      return () => {
        // Idempotent: a stray second call must not drop another subscriber's tracker.
        if (!subscribed) return
        subscribed = false
        state.listeners.delete(listener)
        if (--state.subscribers > 0) return
        state.remove()
        states.delete(win)
      }
    },
    focusCause: (el) => stateOf(false)?.causes.get(el) ?? "other",
    markFocus: (el, cause) => stateOf(true)?.marked.set(el, cause),
    unmarkFocus: (el) => stateOf(false)?.marked.delete(el),
    recentFocus: () =>
      (stateOf(false)?.recent ?? [])
        .map((ref) => ref.deref())
        .filter((el): el is Element => el !== undefined)
        .reverse(),
  }
}
