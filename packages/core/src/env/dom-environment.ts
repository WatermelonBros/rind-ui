import { liveAnnouncer } from "../dom/live-announcer"
import { modalityTracker } from "../dom/modality"
import { motionPreference } from "../dom/motion"
import { readPlatform, withEngine } from "../dom/platform"
import { documentLocale, fixedLocale } from "../i18n/locale"
import type {
  Announcer,
  AnnouncerEnv,
  DomEnv,
  DomRoot,
  Engine,
  LocaleEnv,
  LocaleSource,
  ModalityEnv,
  ModalitySource,
  MotionEnv,
  PlatformFlags,
  PlatformInfo,
  Scheduler,
  SchedulerEnv,
  StyleEnv,
} from "./capabilities"

/** Every capability core defines, implemented on the real DOM. */
export type DomEnvironment = SchedulerEnv &
  DomEnv &
  PlatformInfo &
  ModalityEnv &
  MotionEnv &
  StyleEnv &
  LocaleEnv &
  AnnouncerEnv

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
  /** A locale (and optional direction), or a locale source (default: the document's). */
  readonly locale?: string | LocaleSource
  readonly dir?: "ltr" | "rtl"
  /** An announcer, or the built-in backend to use (default: live regions). */
  readonly announcer?: Announcer | "live-region" | "aria-notify"
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
  const scheduler: Scheduler = {
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
  }
}
