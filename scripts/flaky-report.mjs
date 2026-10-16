// Lists tests that failed and then passed on retry (CI only) from Vitest's JSON report, into
// the GitHub job summary, so flaky tests are visible instead of silently green.
import { appendFileSync, existsSync, readFileSync } from "node:fs"

const [file = "vitest-report.json"] = process.argv.slice(2)
if (!existsSync(file)) process.exit(0)
const report = JSON.parse(readFileSync(file, "utf8"))
const flaky = []
for (const suite of report.testResults ?? []) {
  for (const t of suite.assertionResults ?? []) {
    if (t.status === "passed" && (t.retryCount ?? 0) > 0) {
      flaky.push(`${suite.name.replace(`${process.cwd()}/`, "")} › ${t.fullName}`)
    }
  }
}
if (flaky.length === 0) process.exit(0)
const text = `### Flaky (passed on retry)\n\n${flaky.map((f) => `- ${f}`).join("\n")}\n`
console.log(text)
// biome-ignore lint/suspicious/noUndeclaredEnvVars: set by GitHub Actions on every job
const summary = process.env["GITHUB_STEP_SUMMARY"]
if (summary) appendFileSync(summary, text)
console.log(`::warning::${flaky.length} flaky test(s) passed only on retry — see the job summary`)
