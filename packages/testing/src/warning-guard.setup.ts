// The repository's own setup (jsdom and browser projects), after `./setup.ts`: a test that
// logs a `[rind-ui]` warning or error it did not declare with `expectRindWarning` fails.
// Not part of the public `@rind-ui/testing/setup`, so consumers' tests are unaffected.

import { afterEach } from "vitest"
import { installWarningGuard, takeWarningGuard } from "./warning-guard"

/**
 * `report` records the messages on the test (`meta.rindWarnings`, read by
 * scripts/rind-warnings-report.mjs into the CI job summary) without failing it; `fail`
 * fails the test.
 */
const MODE: "report" | "fail" = "report"

installWarningGuard()

afterEach(({ task }) => {
  const { unexpected, missing } = takeWarningGuard()
  if (unexpected.length === 0 && missing.length === 0) return
  const lines = [
    ...new Set([
      ...unexpected.map((m) => `unexpected: ${m.split("\n")[0]}`),
      ...missing.map((p) => `expected but not logged: ${p}`),
    ]),
  ]
  if (MODE === "report") {
    // TaskMeta is an open interface for reporters: a JSON-serialisable list is sound here
    ;(task.meta as Record<string, unknown>)["rindWarnings"] = lines
    return
  }
  throw new Error(
    `[rind-ui] warning guard:\n${lines.map((l) => `  ${l}`).join("\n")}\nDeclare an expected one with expectRindWarning(/pattern/).`,
  )
})
