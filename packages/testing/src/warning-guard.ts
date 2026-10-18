// The `[rind-ui]` warning guard: records every development warning or error rind-ui logs
// during a test, so the repository's own setup can fail a test that logs one it did not
// expect. A test that expects one says so with `expectRindWarning`. A test that spies on
// `console` itself (`vi.spyOn(console, "warn")`) already handles what it logs, so calls that
// reach the guard through a spy are not recorded.

const KEY = Symbol.for("rind-ui.warning-guard")

interface GuardState {
  seen: string[]
  expected: RegExp[]
  allowed: RegExp[]
}

function state(): GuardState {
  const g = globalThis as unknown as Record<symbol, GuardState | undefined>
  g[KEY] ??= { seen: [], expected: [], allowed: [] }
  return g[KEY]
}

/**
 * Declares that the current test logs a `[rind-ui]` warning or error matching `pattern`:
 * the guard does not fail the test for it, and fails it if no such message was logged.
 */
export function expectRindWarning(pattern: RegExp): void {
  state().expected.push(pattern)
}

/**
 * Lets the current test log a `[rind-ui]` message matching `pattern` without requiring it: for
 * a file whose shared fixture logs it in some tests (call it in `beforeEach`).
 */
export function allowRindWarning(pattern: RegExp): void {
  state().allowed.push(pattern)
}

/** Wraps `console.warn` and `console.error` once; every call still reaches the original. */
export function installWarningGuard(): void {
  for (const level of ["warn", "error"] as const) {
    const original = console[level]
    const guard = (...args: unknown[]) => {
      const [first] = args
      // a spy in front of the guard means the test is handling this call itself
      if (console[level] === guard && typeof first === "string" && first.startsWith("[rind-ui]")) {
        state().seen.push(first)
      }
      original.apply(console, args)
    }
    console[level] = guard
  }
}

/** What the current test logged against what it expected; resets for the next test. */
export function takeWarningGuard(): { unexpected: string[]; missing: RegExp[] } {
  const s = state()
  const unexpected = s.seen.filter((m) => ![...s.expected, ...s.allowed].some((p) => p.test(m)))
  const missing = s.expected.filter((p) => !s.seen.some((m) => p.test(m)))
  s.seen = []
  s.expected = []
  s.allowed = []
  return { unexpected, missing }
}
