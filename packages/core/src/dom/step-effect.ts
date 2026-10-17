// A tour step's visit (design §2): the lifetime of one step's preparation and effect, which
// outlives the `preparing` state. It owns an AbortController and an exactly-once cleanup slot
// (a cleanup returned after the visit ended runs at once; a promise of one is chained).
// `handedOff` lets the state that adopts the visit keep it alive past `preparing`'s cleanup.

export type Cleanup = () => void
export type EffectResult = Cleanup | undefined | Promise<Cleanup | undefined>

export interface StepVisit {
  readonly stepId: string
  readonly signal: AbortSignal
  /** Adopted by the state that shows the step: `preparing`'s cleanup leaves it alive. */
  handedOff: boolean
  readonly released: boolean
  /** Stores the effect's result (a cleanup, a promise of one, or nothing). */
  setResult(result: unknown): void
  /** Aborts `signal` and runs the cleanup, once; later calls do nothing. */
  release(): void
}

const isPromise = (v: unknown): v is PromiseLike<unknown> =>
  typeof v === "object" && v !== null && typeof (v as { then?: unknown }).then === "function"

export function createStepVisit(stepId: string): StepVisit {
  const controller = new AbortController()
  let cleanup: Cleanup | null = null
  let released = false
  const run = (fn: Cleanup) => {
    try {
      fn()
    } catch (error) {
      console.error(`[rind-ui] tour: the cleanup of step "${stepId}" threw`, error)
    }
  }
  const adopt = (value: unknown) => {
    if (typeof value !== "function") return
    // Sound: the effect contract returns a cleanup function or nothing.
    const fn = value as Cleanup
    if (released) run(fn)
    else if (cleanup) {
      // A second cleanup (sync return plus an awaited one): both run.
      const prev = cleanup
      cleanup = () => {
        prev()
        fn()
      }
    } else cleanup = fn
  }
  return {
    stepId,
    signal: controller.signal,
    handedOff: false,
    get released() {
      return released
    },
    setResult(result) {
      if (isPromise(result)) {
        result.then(adopt, () => {})
        return
      }
      adopt(result)
    },
    release() {
      if (released) return
      released = true
      controller.abort(new Error(`step "${stepId}" left`))
      const fn = cleanup
      cleanup = null
      if (fn) run(fn)
    },
  }
}
