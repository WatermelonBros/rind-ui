import type { Announcement, By, Env, Key, Modality, PlatformFlags } from "@rind-ui/core"
import type { DomSnapshot } from "./collect"

export type Direction = "ltr" | "rtl"

/** An `Env` plus what drivers and the model runner need from an adapter. */
export interface AdapterEnv extends Env {
  /** The anchor's `data-instance` value. */
  instance(): Promise<string>
  /** The anchor element, resolved now: how many elements match it. */
  anchorCount(): Promise<number>
  /** What the generic invariants read, collected in the page. */
  collect(): Promise<DomSnapshot>
  /** The document alone (<html>, <body>), when the instance is gone (unmounted). */
  collectDocument(): Promise<DomSnapshot>
  /** Every announcement made in the page so far (the page-wide log). */
  announcements(): Promise<readonly Announcement[]>
  /** Uncaught errors and `console.error` calls since the last call. */
  takeErrors(): Promise<readonly string[]>
  /**
   * Pauses every running animation in the document and returns their resume: holds an exit
   * animation while the runner reopens during it, however slow the run (CI Linux).
   */
  holdAnimations?(): Promise<() => Promise<void>>
  /**
   * Called before a step that closes a presence layer, so its exit cannot end before
   * `holdAnimations` runs (a slow round trip outlasts a 150 ms exit): animations starting
   * now stay at their start until the hold, which ends this.
   */
  armHold?(): Promise<void>
  /**
   * Chromium accessibility-tree checks for the instance (Playwright in Chromium only):
   * problems found, or "unavailable" elsewhere.
   */
  chromiumChecks?(): Promise<readonly string[] | "unavailable">
  /**
   * Runs a whole test inside the framework's async scope (React: Testing Library's
   * asyncWrapper), so what a component defers to a later frame — a layer's initial focus and
   * the state its focus event updates — is not reported as an update outside act.
   */
  scope?<T>(fn: () => Promise<T>): Promise<T>
  /** Marks the start of an action: `navigated()` only counts what happens after it. */
  markNavigations(): Promise<void>
  /** Sets `dir` on the document element (right-to-left runs); null removes it. */
  setDirection(direction: Direction | null): Promise<void>
}

/**
 * A contract's `partName` for the adapters: applied to its anatomy names only, so a name read
 * back from the DOM (already the host's) is used as it is.
 */
export function hostedPartName(contract: {
  readonly anatomy: readonly string[]
  readonly partName?: ((part: never) => string) | undefined
}): {
  readonly partName?: (part: string) => string
  readonly anatomyName?: (part: string) => string
} {
  const map = contract.partName as ((part: string) => string) | undefined // called with anatomy names only
  if (!map) return {}
  const anatomy = new Set(contract.anatomy)
  const back = new Map(contract.anatomy.map((part) => [map(part), part]))
  return {
    partName: (part) => (anatomy.has(part) ? map(part) : part),
    anatomyName: (part) => back.get(part) ?? part,
  }
}

/** A snapshot with its parts named as the contract names them (a hosted component's parts). */
export function renamedSnapshot(
  snapshot: DomSnapshot,
  anatomyName: ((part: string) => string) | undefined,
): DomSnapshot {
  if (!anatomyName) return snapshot
  const rename = <T extends { readonly part: string | null }>(el: T): T =>
    el.part === null ? el : { ...el, part: anatomyName(el.part) }
  return {
    ...snapshot,
    parts: snapshot.parts.map(rename),
    elements: snapshot.elements.map(rename),
    focus: {
      ...snapshot.focus,
      part: snapshot.focus.part === null ? null : anatomyName(snapshot.focus.part),
      element: snapshot.focus.element === null ? null : rename(snapshot.focus.element),
    },
  }
}

export interface EnvOptions {
  readonly scope: string
  /** A hosted component's part names (the contract's `partName`): a part's `data-part`. */
  readonly partName?: ((part: string) => string) | undefined
  /** The inverse: a hosted `data-part` read from the DOM, as the contract names the part. */
  readonly anatomyName?: ((part: string) => string) | undefined
  readonly anchor: By
  readonly modality: Modality
  /** The platform the test runs as: decides the `mod` key (Meta on Apple, Control elsewhere). */
  readonly platform?: PlatformFlags
}

/** Creates environments for one target; adapters return one of these. */
export interface EnvFactory {
  readonly "~rindEnvFactory": true
  create(options: EnvOptions): AdapterEnv
}

export const isEnvFactory = (value: unknown): value is EnvFactory =>
  typeof value === "object" && value !== null && "~rindEnvFactory" in value

/**
 * Shared `until` loop with a deadline. Elapsed time is the larger of the wall clock and the
 * time waited, so slow reads count (no multiplied nested timeouts) and fake timers that do
 * not mock `Date` still end the loop. Reads should not wait themselves.
 */
export async function poll<T>(
  read: () => Promise<T>,
  accept: (value: T) => boolean,
  options: { readonly timeout: number; readonly wait: (ms: number) => Promise<unknown> },
): Promise<T> {
  const interval = 20
  const start = Date.now()
  let waited = 0
  let last: T | undefined
  let error: unknown
  for (;;) {
    try {
      last = await read()
      error = undefined
      if (accept(last)) return last
    } catch (e) {
      error = e
    }
    if (Math.max(Date.now() - start, waited) >= options.timeout) break
    await options.wait(interval)
    waited += interval
  }
  if (error !== undefined) throw error
  throw new UntilTimeout(last, options.timeout)
}

export class UntilTimeout extends Error {
  constructor(
    readonly last: unknown,
    timeout: number,
  ) {
    super(`condition not met within ${timeout} ms; last value: ${JSON.stringify(last)}`)
  }
}

/** Mirrors horizontal arrows for right-to-left runs; everything else is unchanged. */
export const mirror = (key: Key, direction: Direction): Key =>
  direction === "ltr"
    ? key
    : key === "ArrowLeft"
      ? "ArrowRight"
      : key === "ArrowRight"
        ? "ArrowLeft"
        : key

export const describeBy = (by: By) =>
  "role" in by
    ? `role "${[by.role].flat().join(" | ")}"${by.name === undefined ? "" : ` named ${JSON.stringify(String(by.name))}`}`
    : "label" in by
      ? `control labelled ${JSON.stringify(String(by.label))}`
      : "part" in by
        ? `part "${by.part}"`
        : `text ${JSON.stringify(String(by.text))}`
