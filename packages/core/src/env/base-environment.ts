import { modalityTracker } from "../dom/modality"
import { motionPreference, pointerPreference } from "../dom/motion"
import { readPlatform, withEngine } from "../dom/platform"
import { documentLocale, fixedLocale } from "../i18n/locale"
import type {
  Announcer,
  Clipboard,
  Clock,
  ClockEnv,
  DateClock,
  DomEnv,
  DomRoot,
  Engine,
  LocaleEnv,
  LocaleSource,
  ModalityEnv,
  ModalitySource,
  MotionEnv,
  PageVisibility,
  PlatformFlags,
  PlatformInfo,
  PointerEnv,
  Scheduler,
  SchedulerEnv,
  StyleEnv,
} from "./capabilities"
import type { Router, RouterCapability } from "./router"

/**
 * The capabilities every component gets: timers, the DOM root, routing, platform, modality,
 * preferences, style injection, locale and clock. The rest (announcer, clipboard, layout,
 * validity, visibility, date clock) are on-demand capabilities (`dom-capabilities.ts`), built
 * only for components that ask for them, so a component that never announces does not ship
 * the live announcer.
 */
export type BaseDomEnvironment = SchedulerEnv &
  DomEnv &
  PlatformInfo &
  ModalityEnv &
  MotionEnv &
  PointerEnv &
  StyleEnv &
  LocaleEnv &
  ClockEnv &
  RouterCapability

export interface DomEnvironmentOptions {
  /** The document or shadow root the component lives in (default: `document`). */
  readonly getRootNode?: () => Document | ShadowRoot
  /** Platform flags (default: detected from the user agent on first read). */
  readonly platform?: PlatformFlags
  /** Overrides the (detected or given) platform's rendering engine. */
  readonly engine?: Engine
  /** Fixed reduced-motion preference (default: follows `prefers-reduced-motion`). */
  readonly reducedMotion?: boolean
  /** Fixed primary-pointer preference (default: follows `(pointer: coarse)`). */
  readonly coarsePointer?: boolean
  /** A modality source (default: the per-window tracker). */
  readonly modality?: ModalitySource
  /** CSP nonce for the style rules rind-ui injects. */
  readonly nonce?: string
  /** Timers and frames (default: the window's). Tests pass a virtual clock. */
  readonly scheduler?: Scheduler
  /** Monotonic time (default: `performance.now()`). Tests pass the virtual clock's. */
  readonly clock?: Clock
  /** A locale (and optional direction), or a locale source (default: the document's). */
  readonly locale?: string | LocaleSource
  readonly dir?: "ltr" | "rtl"
  /** An announcer, or the built-in backend to use (default: live regions). */
  readonly announcer?: Announcer | "live-region" | "aria-notify"
  /** Page visibility (default: the document's `visibilityState`). Tests pass a fake. */
  readonly visibility?: PageVisibility
  /** Client routing for every link part below (default: none, the browser navigates). */
  readonly router?: Router
  /** The date clock (default: `Date.now()` and the platform's resolved time zone). */
  readonly dateClock?: DateClock
  /** The clipboard (default: the Clipboard API, with a fallback). Tests pass a fake. */
  readonly clipboard?: Clipboard
}

/** The locale option, with an explicit `dir` winning over the locale's own direction. */
function localeSource(
  options: DomEnvironmentOptions,
  documentOf: () => Document | undefined,
): LocaleSource {
  if (typeof options.locale === "string") return fixedLocale(options.locale, options.dir)
  const source = options.locale ?? documentLocale(documentOf)
  const dir = options.dir
  if (!dir) return source
  return { ...source, locale: () => source.locale(), dir: () => dir }
}

/** The document of the environment's root, or `undefined` on the server. */
export function documentOfRoot(getRootNode: () => Document | ShadowRoot) {
  return () => {
    if (typeof document === "undefined") return undefined
    const root = getRootNode()
    return "documentElement" in root ? root : root.ownerDocument
  }
}

/**
 * The base browser environment. Nothing touches globals at creation, so it is safe on the
 * server. Timers are looked up on `globalThis` at call time, so fake timers installed after
 * import (e.g. `vi.useFakeTimers()`) drive it.
 */
export function baseDomEnvironment(options: DomEnvironmentOptions = {}): BaseDomEnvironment {
  const getRootNode = options.getRootNode ?? (() => document)
  // Detected lazily (never on the server unless read).
  let platform: PlatformFlags | undefined
  const getPlatform = () => {
    const base = options.platform ?? readPlatform()
    // platform-convention: the caller's engine override option, not a platform read
    platform ??= options.engine ? withEngine(base, options.engine) : base
    return platform
  }
  const scheduler: Scheduler = options.scheduler ?? {
    setTimeout: (callback, ms) => globalThis.setTimeout(callback, ms),
    // The handle came from `setTimeout` above; the cast only restores its type.
    clearTimeout: (handle) => globalThis.clearTimeout(handle as number),
    requestAnimationFrame: (callback) => globalThis.requestAnimationFrame(callback),
    cancelAnimationFrame: (handle) => globalThis.cancelAnimationFrame(handle as number),
  }
  const dom: DomRoot = {
    getRootNode,
    getById: (id) => {
      const root = getRootNode()
      return "getElementById" in root ? root.getElementById(id) : null
    },
    activeElement: () => getRootNode().activeElement,
  }
  return {
    scheduler,
    dom,
    router: options.router,
    get platform() {
      return getPlatform()
    },
    modality: options.modality ?? modalityTracker(getRootNode, getPlatform),
    motion: motionPreference(options.reducedMotion),
    pointer: pointerPreference(options.coarsePointer),
    style: options.nonce === undefined ? {} : { nonce: options.nonce },
    locale: localeSource(options, documentOfRoot(getRootNode)),
    // Looked up at call time, like the timers, so fake clocks installed later drive it.
    clock: options.clock ?? { now: () => globalThis.performance?.now() ?? Date.now() },
  }
}
