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
   * Chromium accessibility-tree checks for the instance (Playwright in Chromium only):
   * problems found, or "unavailable" elsewhere.
   */
  chromiumChecks?(): Promise<readonly string[] | "unavailable">
  /** Sets `dir` on the document element (right-to-left runs); null removes it. */
  setDirection(direction: Direction | null): Promise<void>
}

export interface EnvOptions {
  readonly scope: string
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
    ? `role "${by.role}"${by.name === undefined ? "" : ` named ${JSON.stringify(String(by.name))}`}`
    : `text ${JSON.stringify(String(by.text))}`
