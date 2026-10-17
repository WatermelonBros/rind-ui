// Lists the `[rind-ui]` warnings tests logged without declaring them (recorded by
// packages/testing/src/warning-guard.setup.ts in report mode) from Vitest's JSON report, into
// the GitHub job summary: one entry per message (ids normalised), with the tests that logged it.
import { appendFileSync, existsSync, readFileSync } from "node:fs"

const [file = "vitest-report.json"] = process.argv.slice(2)
if (!existsSync(file)) process.exit(0)
const report = JSON.parse(readFileSync(file, "utf8"))
/** message (generated ids replaced) → tests */
const byMessage = new Map()
for (const suite of report.testResults ?? []) {
  const path = suite.name.replace(`${process.cwd()}/`, "")
  for (const t of suite.assertionResults ?? []) {
    for (const line of t.meta?.rindWarnings ?? []) {
      const key = line.replace(/_[rR]_[0-9a-z]+_/g, "_ID_")
      const tests = byMessage.get(key) ?? new Set()
      tests.add(`${path} › ${t.fullName}`)
      byMessage.set(key, tests)
    }
  }
}
if (byMessage.size === 0) process.exit(0)
const entries = [...byMessage].sort((a, b) => b[1].size - a[1].size)
const text = `### [rind-ui] warnings: ${entries.length} distinct\n\n${entries
  .map(
    ([message, tests]) =>
      `- **${tests.size} test(s)**: ${message}\n${[...tests]
        .slice(0, 5)
        .map((t) => `  - ${t}`)
        .join("\n")}${tests.size > 5 ? `\n  - … ${tests.size - 5} more` : ""}`,
  )
  .join("\n")}\n`
console.log(text)
// biome-ignore lint/suspicious/noUndeclaredEnvVars: set by GitHub Actions on every job
const summary = process.env["GITHUB_STEP_SUMMARY"]
if (summary) appendFileSync(summary, text)
