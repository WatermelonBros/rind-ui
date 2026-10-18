// The repository's own setup (the jsdom project; not the browser one yet, see
// docs/review-backlog.md), after `./setup.ts`: a test that logs a `[rind-ui]` warning or error
// it did not declare with `expectRindWarning` (or allow with `allowRindWarning`) fails, naming
// the message. Not part of the public `@rind-ui/testing/setup`, so consumers' tests are
// unaffected.

import { afterEach } from "vitest"
import { installWarningGuard, takeWarningGuard } from "./warning-guard"

installWarningGuard()

afterEach(() => {
  const { unexpected, missing } = takeWarningGuard()
  if (unexpected.length === 0 && missing.length === 0) return
  const lines = [
    ...new Set([
      ...unexpected.map((m) => `unexpected: ${m.split("\n")[0]}`),
      ...missing.map((p) => `expected but not logged: ${p}`),
    ]),
  ]
  throw new Error(
    `[rind-ui] warning guard:\n${lines.map((l) => `  ${l}`).join("\n")}\nDeclare an expected one with expectRindWarning(/pattern/).`,
  )
})
