import type { FocusCause } from "../a11y/events"
import type { Modality } from "../contract/env"

// Small capability interfaces a machine's environment is assembled from (ISP): a machine
// declares only the ones it uses in `type<{ env: … }>()`.

export type TimerHandle = unknown

export interface Scheduler {
  setTimeout(callback: () => void, ms: number): TimerHandle
  clearTimeout(handle: TimerHandle): void
  requestAnimationFrame(callback: () => void): TimerHandle
  cancelAnimationFrame(handle: TimerHandle): void
}

export interface DomRoot {
  /** The document or shadow root the component lives in. */
  getRootNode(): Document | ShadowRoot
  getById(id: string): HTMLElement | null
  activeElement(): Element | null
}

export interface SchedulerEnv {
  readonly scheduler: Scheduler
}
export interface DomEnv {
  readonly dom: DomRoot
}

// --- Accessibility capabilities (add-a11y-foundations) ---

/** The current interaction modality of the window the component lives in. */
export interface ModalitySource {
  modality(): Modality
  subscribe(listener: (modality: Modality) => void): () => void
  /** Why `el` last received focus (rind-ui's own cause, or key/pointer/window/other). */
  focusCause(el: Element): FocusCause
  /** Marks a focus move rind-ui is about to make: it keeps the modality and has `cause`. */
  markFocus(el: Element, cause: FocusCause): void
  /** Drops a mark no focus event consumed (the element refused focus). */
  unmarkFocus(el: Element): void
  /**
   * Recently focused elements, most recent first (bounded, weakly held): the fallback for
   * focus restore when the opener is gone (react-spectrum#2444). Recorded while any
   * component is mounted, so the trigger focused before the first layer opened is there.
   */
  recentFocus(): readonly Element[]
}

/** Platform flags, detected once (or injected). Read only through this capability. */
/** The rendering engine; every iOS and iPadOS browser is WebKit. */
export type Engine = "webkit" | "blink" | "gecko"

export interface PlatformFlags {
  /** `webkit`, `chromium` and `firefox` always agree with it. */
  readonly engine: Engine
  readonly apple: boolean
  readonly mac: boolean
  readonly ios: boolean
  readonly android: boolean
  readonly windows: boolean
  readonly webkit: boolean
  readonly chromium: boolean
  readonly firefox: boolean
}
export interface PlatformInfo {
  readonly platform: PlatformFlags
}

export interface MotionPreference {
  reducedMotion(): boolean
  subscribeReducedMotion(listener: (reduced: boolean) => void): () => void
}

export interface LocaleSource {
  locale(): string
  dir(): "ltr" | "rtl"
  /** Present when the locale can change (the document's `lang`, the browser language). */
  subscribe?(listener: () => void): () => void
}

export interface Announcement {
  readonly message: string
  /** Default `polite`; rind-ui components use `assertive` only for errors and failures. */
  readonly priority?: "polite" | "assertive"
  /** Coalesces pending messages with the same key (debounced). */
  readonly key?: string
  /** The announcing component's locale. */
  readonly lang?: string
}
export interface Announcer {
  announce(message: Announcement): void
  /** Called on mount by components that may announce: creates the regions eagerly. */
  prepare(): () => void
  /** Drops the pending (debounced) message with this key, if any. */
  cancel(key: string): void
}

export interface StyleInjection {
  /** CSP nonce for the few style rules rind-ui injects. */
  readonly nonce?: string
}

export interface ModalityEnv {
  readonly modality: ModalitySource
}
export interface MotionEnv {
  readonly motion: MotionPreference
}
export interface LocaleEnv {
  readonly locale: LocaleSource
}
export interface AnnouncerEnv {
  readonly announcer: Announcer
}
export interface StyleEnv {
  readonly style: StyleInjection
}
