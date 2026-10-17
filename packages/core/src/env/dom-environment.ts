import { collectionLayout } from "../dom/collection-layout"
import { type ConstraintValidity, constraintValidity } from "../dom/constraint-validity"
import { liveAnnouncer } from "../dom/live-announcer"
import { modalityTracker } from "../dom/modality"
import { motionPreference } from "../dom/motion"
import { readPlatform, withEngine } from "../dom/platform"
import { documentLocale, fixedLocale } from "../i18n/locale"
import type {
  Announcer,
  AnnouncerEnv,
  ClockEnv,
  CollectionLayoutEnv,
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
  Scheduler,
  SchedulerEnv,
  StyleEnv,
  VisibilityEnv,
} from "./capabilities"
import type { Router, RouterCapability } from "./router"

/** Every capability core defines, implemented on the real DOM. */
export type DomEnvironment = SchedulerEnv &
  DomEnv &
  PlatformInfo &
  ModalityEnv &
  MotionEnv &
  StyleEnv &
  LocaleEnv &
  AnnouncerEnv &
  ClockEnv &
  CollectionLayoutEnv &
  RouterCapability &
  ValidityEnv &
  VisibilityEnv

/** Native constraint validity, for machines that validate a form control (Field). */
export interface ValidityEnv {
  readonly validity: ConstraintValidity
}

export interface DomEnvironmentOptions {
  /** The document or shadow root the component lives in (default: `document`). */
  readonly getRootNode?: () => Document | ShadowRoot
  /** Platform flags (default: detected from the user agent on first read). */
  readonly platform?: PlatformFlags
  /** Overrides the (detected or given) platform's rendering engine. */
  readonly engine?: Engine
  /** Fixed reduced-motion preference (default: follows `prefers-reduced-motion`). */
  readonly reducedMotion?: boolean
  /** A modality source (default: the per-window tracker). */
  readonly modality?: ModalitySource
  /** CSP nonce for the style rules rind-ui injects. */
  readonly nonce?: string
  /** Timers and frames (default: the window's). Tests pass a virtual clock. */
  readonly scheduler?: Scheduler
  /** A locale (and optional direction), or a locale source (default: the document's). */
  readonly locale?: string | LocaleSource
  readonly dir?: "ltr" | "rtl"
  /** An announcer, or the built-in backend to use (default: live regions). */
  readonly announcer?: Announcer | "live-region" | "aria-notify"
  /** Page visibility (default: the document's `visibilityState`). Tests pass a fake. */
  readonly visibility?: PageVisibility
  /** Client routing for every link part below (default: none, the browser navigates). */
  readonly router?: Router
}

/**
 * The browser environment. Nothing touches globals at creation, so it is safe on the
 * server. Timers are looked up on `globalThis` at call time, so fake timers installed after
 * import (e.g. `vi.useFakeTimers()`) drive it.
 */
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

export function domEnvironment(options: DomEnvironmentOptions = {}): DomEnvironment {
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
  const documentOf = () => {
    if (typeof document === "undefined") return undefined
    const root = getRootNode()
    return "documentElement" in root ? root : root.ownerDocument
  }
  return {
    scheduler,
    dom,
    router: options.router,
    validity: constraintValidity,
    get platform() {
      return getPlatform()
    },
    modality: options.modality ?? modalityTracker(getRootNode, getPlatform),
    motion: motionPreference(options.reducedMotion),
    style: options.nonce === undefined ? {} : { nonce: options.nonce },
    locale: localeSource(options, documentOf),
    announcer:
      typeof options.announcer === "object"
        ? options.announcer
        : liveAnnouncer({ scheduler, dom }, { backend: options.announcer ?? "live-region" }),
    // Looked up at call time, like the timers, so fake clocks installed later drive it.
    clock: { now: () => globalThis.performance?.now() ?? Date.now() },
    layout: collectionLayout(dom),
    visibility: options.visibility ?? documentVisibility(documentOf),
  }
}

/** The document's visibility state; `visibilitychange` only (never focus or blur). */
function documentVisibility(documentOf: () => Document | undefined): PageVisibility {
  return {
    hidden: () => documentOf()?.visibilityState === "hidden",
    subscribe(listener) {
      const doc = documentOf()
      if (!doc) return () => {}
      const onChange = () => listener(doc.visibilityState === "hidden")
      doc.addEventListener("visibilitychange", onChange)
      return () => doc.removeEventListener("visibilitychange", onChange)
    },
  }
}
