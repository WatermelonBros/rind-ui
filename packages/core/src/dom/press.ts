// One activation model for every pressable part: mouse, pen, touch, keyboard and assistive
// technology. Not a machine-runtime service (a grid has hundreds of pressables, each with
// local state): a factory returning handler props for connect, plus the pressed state for
// `data-pressed`. Machines only ever receive the normalised PRESS* / LONG_PRESS events.

import type {
  ContextMenuEvent,
  LongPressEvent,
  PointerKind,
  PressEvent,
  PressEventType,
} from "../a11y/events"
import { isContextMenuClick } from "../a11y/keys"
import type { Modality } from "../contract/env"
import type {
  DomEnv,
  ModalityEnv,
  MotionEnv,
  PlatformInfo,
  SchedulerEnv,
  StyleEnv,
  TimerHandle,
} from "../env/capabilities"
import { focusSafely } from "./focus-safely"
import { quirkActive } from "./quirks"
import { textSelection } from "./text-selection"
import { injectTouchAction } from "./touch-action"

/** Structural event types, so React synthetic events and DOM events both fit. */
export interface PressBaseEvent {
  readonly currentTarget: EventTarget | null
  readonly target: EventTarget | null
  readonly shiftKey: boolean
  readonly ctrlKey: boolean
  readonly metaKey: boolean
  readonly altKey: boolean
  preventDefault(): void
}
export interface PressPointerEvent extends PressBaseEvent {
  readonly pointerId: number
  readonly pointerType: string
  readonly button: number
  readonly width: number
  readonly height: number
  readonly pressure: number
  readonly detail: number
  readonly clientX: number
  readonly clientY: number
}
export interface PressMouseEvent extends PressBaseEvent {
  readonly detail: number
  readonly button: number
}
export interface PressKeyEvent extends PressBaseEvent {
  readonly key: string
  readonly code: string
  readonly repeat: boolean
}

export type PressEnv = ModalityEnv &
  PlatformInfo &
  SchedulerEnv &
  Partial<StyleEnv> &
  Partial<DomEnv> &
  Partial<MotionEnv>

export interface PressOptions {
  readonly env: PressEnv
  readonly send: (event: PressEvent | LongPressEvent | ContextMenuEvent) => void
  /** Read at event time: a disabled part sends no press events. */
  readonly disabled?: () => boolean
  /** False: pressing does not move focus (e.g. a stepper button next to its input). */
  readonly focusOnPress?: boolean
  /** Opt into long press (default threshold 500 ms). */
  readonly longPress?: { readonly threshold?: number }
  /**
   * What a click forwarded by an associated label does (default "activate"): it always
   * focuses the part; "activate" then presses it once, "focus" does not (popup triggers
   * standing in for a native select: radix#3679, headlessui#3787).
   */
  readonly labelActivation?: "focus" | "activate"
  /**
   * Prevents the touch context menu while a touch press is held, without long press (no
   * LONG_PRESS, no hint): parts held on purpose, like a stepper's auto-repeat.
   */
  readonly suppressTouchContextMenu?: boolean
}

/** The label being clicked in each document, until the click it forwards has arrived. */
const labelClicks = new WeakMap<
  Document,
  { readonly label: HTMLLabelElement; readonly target: EventTarget | null }
>()
const watchedForLabels = new WeakSet<Document>()
function watchLabelClicks(doc: Document, scheduler: SchedulerEnv["scheduler"]) {
  if (watchedForLabels.has(doc)) return
  watchedForLabels.add(doc)
  doc.addEventListener(
    "click",
    (e) => {
      const label = (e.target as Element | null)?.closest?.("label")
      // Not the click it forwards to its control, nor a click on the control itself.
      if (!label || label.control?.contains(e.target as Node)) return
      const click = { label, target: e.target }
      labelClicks.set(doc, click)
      // The forwarded click is dispatched by the label's activation, in this same task.
      scheduler.setTimeout(() => {
        if (labelClicks.get(doc) === click) labelClicks.delete(doc)
      }, 0)
    },
    true,
  )
}

/** Whether this click on `part` is the one a label click forwarded to it. */
function forwardedByLabel(part: Element): boolean {
  const click = labelClicks.get(part.ownerDocument)
  if (!click) return false
  // The click started on the part itself (a part wrapped by its label): a direct press.
  if (click.target instanceof Node && part.contains(click.target)) return false
  const { label } = click
  const forId = label.htmlFor ? part.ownerDocument.getElementById(label.htmlFor) : null
  return label.control === part || forId === part || (!label.htmlFor && label.contains(part))
}

export interface PressHandle {
  /** Spread on the pressable element. */
  readonly props: {
    readonly "data-rind-pressable": ""
    readonly onPointerDown: (e: PressPointerEvent) => void
    readonly onPointerUp: (e: PressPointerEvent) => void
    readonly onPointerEnter: (e: PressPointerEvent) => void
    readonly onPointerLeave: (e: PressPointerEvent) => void
    readonly onPointerCancel: (e: PressPointerEvent) => void
    readonly onMouseDown: (e: PressMouseEvent) => void
    readonly onClick: (e: PressMouseEvent) => void
    readonly onKeyDown: (e: PressKeyEvent) => void
    readonly onKeyUp: (e: PressKeyEvent) => void
    readonly onContextMenu: (e: PressBaseEvent) => void
    readonly onDragStart: (e: PressBaseEvent) => void
  }
  /** True while a press is in progress and the pointer is over the part. */
  isPressed(): boolean
  subscribe(listener: (pressed: boolean) => void): () => void
  dispose(): void
}

type Kind = "button" | "link" | "check" | "text"

/** Which keys press this element, from its tag and role (accessibility.md rule 16). */
function kindOf(el: EventTarget | null): Kind {
  if (!el || !("tagName" in el)) return "button"
  const e = el as HTMLElement
  const role = e.getAttribute("role")
  const tag = e.tagName
  if (e.isContentEditable || tag === "TEXTAREA") return "text"
  if (tag === "INPUT") {
    const type = (e as HTMLInputElement).type
    if (type === "checkbox" || type === "radio") return "check"
    if (!["button", "submit", "reset", "image"].includes(type)) return "text"
  }
  if (role === "link" || (tag === "A" && e.hasAttribute("href"))) return "link"
  return "button"
}

/** Elements whose key activation stays native: links and submit or reset buttons. */
function keepsNativeKey(el: EventTarget | null): boolean {
  if (kindOf(el) === "link") return true
  const b = el as HTMLButtonElement | null
  return b?.tagName === "BUTTON" && (b.type === "submit" || b.type === "reset")
}

const pressesKey = (kind: Kind, key: string) =>
  kind === "button"
    ? key === "Enter" || key === " "
    : kind === "link"
      ? key === "Enter"
      : kind === "check"
        ? key === " "
        : false

/** A click after pointerup normally arrives within a frame; past this, deliver anyway. */
const CLICK_FALLBACK_MS = 32

type State =
  | { readonly kind: "idle" }
  | {
      readonly kind: "pointer"
      readonly pointerId: number
      readonly pointerType: "mouse" | "pen" | "touch"
      readonly target: Element
      inside: boolean
    }
  | { readonly kind: "key"; readonly key: string; readonly target: Element; metaHeld: boolean }

export function createPress(options: PressOptions): PressHandle {
  const { env, send } = options
  if (typeof document !== "undefined" && env.dom) {
    const root = env.dom.getRootNode()
    watchLabelClicks("body" in root ? root : root.ownerDocument, env.scheduler)
  }
  const listeners = new Set<(pressed: boolean) => void>()
  let state: State = { kind: "idle" }
  let pressed = false
  /** An activation waiting for its `click` (or the fallback). */
  let pending: { readonly event: PressEvent; readonly timer: TimerHandle } | null = null
  /** A press whose activation was delivered by the fallback: its late click is ignored. */
  let deliveredWithoutClick = false
  let longPressTimer: TimerHandle | null = null
  let longPressed = false
  let suppressVirtualClick = false
  let releaseSelection: (() => void) | null = null
  /** Listeners installed for the press in progress, removed when it ends. */
  const pressListeners: (() => void)[] = []
  const listen = <K extends keyof DocumentEventMap>(
    target: Document | Element,
    type: K,
    listener: (e: DocumentEventMap[K]) => void,
  ) => {
    const l = listener as EventListener
    target.addEventListener(type, l, true)
    pressListeners.push(() => target.removeEventListener(type, l, true))
  }
  /** A press interrupted by a blur or a hidden document: its late click is not a press. */
  let swallowClick = false

  const disabled = () => options.disabled?.() === true
  const setPressed = (next: boolean) => {
    if (pressed === next) return
    pressed = next
    for (const l of listeners) l(next)
  }
  const event = (
    type: PressEventType,
    pointerType: PointerKind,
    modifiers: Pick<PressBaseEvent, "shiftKey" | "ctrlKey" | "metaKey" | "altKey">,
    modality: Modality,
  ): PressEvent => ({
    type,
    pointerType,
    modality,
    shiftKey: modifiers.shiftKey,
    ctrlKey: modifiers.ctrlKey,
    metaKey: modifiers.metaKey,
    altKey: modifiers.altKey,
  })
  const modalityFor = (pointerType: PointerKind): Modality =>
    pointerType === "virtual"
      ? "virtual"
      : pointerType === "keyboard"
        ? "keyboard"
        : pointerType === "touch"
          ? "touch"
          : "pointer"

  const cancelLongPress = () => {
    if (longPressTimer !== null) env.scheduler.clearTimeout(longPressTimer)
    longPressTimer = null
  }
  const reset = () => {
    state = { kind: "idle" }
    setPressed(false)
    cancelLongPress()
    releaseSelection?.()
    releaseSelection = null
    for (const remove of pressListeners.splice(0)) remove()
  }
  /**
   * A long touch is usually followed by no click at all (iOS, Android): the flag that eats
   * its trailing click lives one click-delay, so it never swallows a later AT click or
   * context menu.
   */
  const expireLongPress = () => {
    env.scheduler.setTimeout(() => {
      longPressed = false
    }, CLICK_FALLBACK_MS)
  }
  /**
   * A press ends with PRESS.CANCEL when the part loses focus or the document is hidden (a
   * tab or app switch): its keyup or pointerup may never come (react-spectrum#6094), and a
   * late one must not activate.
   */
  const endOnInterruption = (
    target: Element,
    pointerType: PointerKind,
    modifiers: Pick<PressBaseEvent, "shiftKey" | "ctrlKey" | "metaKey" | "altKey">,
  ) => {
    const doc = target.ownerDocument
    const interrupt = () => {
      if (state.kind === "idle") return
      reset()
      swallowClick = true
      send(event("PRESS.CANCEL", pointerType, modifiers, modalityFor(pointerType)))
    }
    listen(target, "blur", () => {
      interrupt()
      env.scheduler.setTimeout(() => {
        swallowClick = false
      }, 0)
    })
    listen(doc, "visibilitychange", () => {
      if (doc.visibilityState !== "hidden") return
      interrupt()
      // The release may arrive when the page is shown again: swallow it until then.
      const onShown = () => {
        if (doc.visibilityState === "hidden") return
        doc.removeEventListener("visibilitychange", onShown)
        env.scheduler.setTimeout(() => {
          swallowClick = false
        }, 0)
      }
      doc.addEventListener("visibilitychange", onShown)
    })
  }
  const deliver = (e: PressEvent) => {
    if (pending) env.scheduler.clearTimeout(pending.timer)
    pending = null
    send(e)
  }

  /** Contact-area hit test; layout-free environments (0×0 rects) trust enter/leave. */
  const isOver = (target: Element, e: PressPointerEvent) => {
    const rect = target.getBoundingClientRect()
    if (rect.width === 0 && rect.height === 0) return true
    const dx = (e.width || 0) / 2
    const dy = (e.height || 0) / 2
    return (
      e.clientX + dx >= rect.left &&
      e.clientX - dx <= rect.right &&
      e.clientY + dy >= rect.top &&
      e.clientY - dy <= rect.bottom
    )
  }

  const endKeyPress = (
    modifiers: Pick<PressBaseEvent, "shiftKey" | "ctrlKey" | "metaKey" | "altKey">,
  ) => {
    reset()
    send(event("PRESS.UP", "keyboard", modifiers, "keyboard"))
    send(event("PRESS.END", "keyboard", modifiers, "keyboard"))
    send(event("PRESS", "keyboard", modifiers, "keyboard"))
  }

  const props: PressHandle["props"] = {
    "data-rind-pressable": "",
    onPointerDown(e) {
      if (disabled() || e.button !== 0 || state.kind !== "idle") return
      const pointerType = e.pointerType
      // AT pointers are handled by the click that follows (virtual activation).
      if (pointerType !== "mouse" && pointerType !== "pen" && pointerType !== "touch") return
      if (isContextMenuClick(e, env.platform)) {
        // macOS Control+click asks for the context menu; it never presses.
        send({ ...event("PRESS", pointerType, e, "pointer"), type: "CONTEXT_MENU" })
        return
      }
      // The tracker (a capture listener) already classified this pointerdown: an AT pointer
      // (e.g. iOS VoiceOver's zero-size touch) activates through the click that follows.
      if (env.modality.modality() === "virtual") return
      const target = e.currentTarget as Element
      if (pointerType === "touch") {
        // Implicit capture would keep the pointer "inside" while the finger slides off. It
        // belongs to the touched element (e.target), which may be a child of the part.
        const el = e.target as Element & {
          releasePointerCapture?(id: number): void
          hasPointerCapture?(id: number): boolean
        }
        if (el.hasPointerCapture?.(e.pointerId)) el.releasePointerCapture?.(e.pointerId)
        injectTouchAction(target.ownerDocument, env)
      }
      releaseSelection = textSelection(target, env, pointerType === "touch")
      state = { kind: "pointer", pointerId: e.pointerId, pointerType, target, inside: true }
      swallowClick = false
      deliveredWithoutClick = false
      longPressed = false
      setPressed(true)
      // A mouse has no implicit capture: its release may land anywhere in the document.
      const doc = target.ownerDocument
      listen(doc, "pointerup", (pe) => props.onPointerUp(pe))
      listen(doc, "pointercancel", (pe) => props.onPointerCancel(pe))
      endOnInterruption(target, pointerType, e)
      send(event("PRESS.START", pointerType, e, modalityFor(pointerType)))
      if (options.longPress) {
        longPressTimer = env.scheduler.setTimeout(() => {
          longPressTimer = null
          if (state.kind !== "pointer" || !state.inside) return
          longPressed = true
          send({ ...event("PRESS", pointerType, e, modalityFor(pointerType)), type: "LONG_PRESS" })
        }, options.longPress.threshold ?? 500)
      }
    },
    onPointerEnter(e) {
      if (state.kind !== "pointer" || e.pointerId !== state.pointerId || state.inside) return
      state.inside = true
      setPressed(true)
    },
    onPointerLeave(e) {
      if (state.kind !== "pointer" || e.pointerId !== state.pointerId || !state.inside) return
      state.inside = false
      setPressed(false)
      cancelLongPress()
    },
    onPointerUp(e) {
      if (state.kind !== "pointer" || e.pointerId !== state.pointerId) return
      const s = state
      const inside = s.inside && isOver(s.target, e)
      const wasLong = longPressed
      reset()
      if (inside) send(event("PRESS.UP", s.pointerType, e, modalityFor(s.pointerType)))
      send(event("PRESS.END", s.pointerType, e, modalityFor(s.pointerType)))
      if (wasLong) expireLongPress()
      if (!inside || wasLong) return
      // Activation comes from the click (so AT-only clicks work the same way); when no
      // click follows (iOS/Android after a long touch, DOM replaced between pointerup and
      // click: RA#1513), the fallback delivers it once.
      const activation = event("PRESS", s.pointerType, e, modalityFor(s.pointerType))
      pending = {
        event: activation,
        timer: env.scheduler.setTimeout(() => {
          if (!pending) return
          pending = null
          deliveredWithoutClick = true
          send(activation)
        }, CLICK_FALLBACK_MS),
      }
    },
    onPointerCancel(e) {
      if (state.kind !== "pointer" || e.pointerId !== state.pointerId) return
      const s = state
      reset()
      if (longPressed) expireLongPress()
      send(event("PRESS.CANCEL", s.pointerType, e, modalityFor(s.pointerType)))
    },
    onMouseDown(e) {
      // Keep focus where it is (stepper buttons): only the mousedown default moves focus.
      if (options.focusOnPress === false && e.button === 0) e.preventDefault()
    },
    onClick(e) {
      if (disabled()) {
        e.preventDefault()
        return
      }
      if (swallowClick && state.kind === "idle" && !pending) {
        // The release of a press that a blur or a hidden document already cancelled.
        swallowClick = false
        e.preventDefault()
        return
      }
      if (pending) {
        deliver(pending.event)
        return
      }
      const part = e.currentTarget as Element | null
      if (state.kind === "idle" && part && forwardedByLabel(part)) {
        labelClicks.delete(part.ownerDocument)
        // A label click focuses the part (the native label behaviour, kept for any part).
        void focusSafely(part as HTMLElement, env, "programmatic")
        if (options.labelActivation === "focus") {
          // No press, and no native activation (a submit button would submit).
          e.preventDefault()
          return
        }
        const modality = env.modality.modality()
        const pointerType: PointerKind =
          modality === "virtual" ? "virtual" : modality === "touch" ? "touch" : "mouse"
        send(event("PRESS.START", pointerType, e, modalityFor(pointerType)))
        send(event("PRESS.END", pointerType, e, modalityFor(pointerType)))
        send(event("PRESS", pointerType, e, modalityFor(pointerType)))
        return
      }
      if (longPressed) {
        // The trailing click of a long press is not an activation.
        longPressed = false
        e.preventDefault()
        return
      }
      if (state.kind === "key") {
        // A link's native click on Enter: the keyboard press completes here.
        endKeyPress(e)
        return
      }
      if (deliveredWithoutClick) {
        deliveredWithoutClick = false
        return
      }
      if (state.kind !== "idle" || e.detail !== 0) return
      // A bare click: assistive technology (or a programmatic click()).
      if (suppressVirtualClick) return
      const target = e.currentTarget as Element | null
      if (
        target?.tagName === "BUTTON" &&
        target.getAttribute("role") === "menuitem" &&
        quirkActive("webkit-menuitem-double-click", env)
      ) {
        // VO+Space dispatches two clicks on a native button with role=menuitem.
        suppressVirtualClick = true
        env.scheduler.setTimeout(() => {
          suppressVirtualClick = false
        }, 0)
      }
      send(event("PRESS.START", "virtual", e, "virtual"))
      send(event("PRESS.END", "virtual", e, "virtual"))
      send(event("PRESS", "virtual", e, "virtual"))
    },
    onKeyDown(e) {
      if (disabled()) return
      const kind = kindOf(e.currentTarget)
      if (!pressesKey(kind, e.key)) {
        if (state.kind === "key" && e.key === "Meta") state.metaHeld = true
        return
      }
      // Links keep their native Enter (navigation), submit and reset buttons their native
      // activation (the form submits or resets once: react-spectrum#10658); everything else
      // stops the synthetic click.
      const native = keepsNativeKey(e.currentTarget)
      // A held key activates once: a submit or reset button's repeats would each click.
      if (!native || (e.repeat && kind !== "link")) e.preventDefault()
      if (e.repeat || state.kind !== "idle") return
      const target = e.currentTarget as Element
      state = { kind: "key", key: e.key, target, metaHeld: e.metaKey }
      swallowClick = false
      setPressed(true)
      send(event("PRESS.START", "keyboard", e, "keyboard"))
      // The keyup may land elsewhere (focus moved): listen on the document for the press.
      listen(target.ownerDocument, "keyup", (ke) => onDocumentKeyUp(ke))
      endOnInterruption(target, "keyboard", e)
    },
    onKeyUp() {
      // Handled by the document listener installed for the press.
    },
    onContextMenu(e) {
      // No platform context menu while a touch press that opted in is held, or just after a
      // long press fired. Mouse, pen and keyboard context menus are never touched.
      const heldTouch = state.kind === "pointer" && state.pointerType === "touch"
      if (
        longPressed ||
        (heldTouch && (options.longPress || options.suppressTouchContextMenu === true))
      ) {
        e.preventDefault()
      }
    },
    onDragStart(e) {
      // A native drag would steal the pointer mid-press.
      if (state.kind === "pointer") e.preventDefault()
    },
  }

  function onDocumentKeyUp(e: KeyboardEvent) {
    if (state.kind !== "key") return
    const s = state
    if (e.key === s.key) {
      if (keepsNativeKey(s.target)) {
        // A submit or reset button's native click, fired after this keyup for Space,
        // completes the press.
        if (kindOf(s.target) !== "link" && e.key === " ") return
      } else e.preventDefault()
      endKeyPress(e)
      return
    }
    // macOS drops the keyup of keys released while ⌘ is held: end the press on ⌘'s keyup.
    if (e.key === "Meta" && (s.metaHeld || e.metaKey) && quirkActive("macos-meta-keyup", env)) {
      endKeyPress({ shiftKey: e.shiftKey, ctrlKey: e.ctrlKey, metaKey: true, altKey: e.altKey })
    }
  }

  return {
    props,
    isPressed: () => pressed,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    dispose() {
      if (pending) env.scheduler.clearTimeout(pending.timer)
      pending = null
      reset()
    },
  }
}
