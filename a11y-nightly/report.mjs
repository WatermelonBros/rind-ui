// The GitHub issue body for a failed nightly run: per failing flow, the phrase difference,
// the spoken log and the screen reader, browser and OS versions. When the flows never ran
// (install, build or server failure: no results.json), the body says so with the run link.
// Prints nothing when every flow passed.
import { existsSync, readFileSync } from "node:fs"
import { release, type } from "node:os"

// Set by GitHub Actions (run link) and the workflow's matrix (SR, BROWSER).
const { GITHUB_SERVER_URL, GITHUB_REPOSITORY, GITHUB_RUN_ID, SR, BROWSER } = process.env
const runLink = GITHUB_RUN_ID
  ? `${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}`
  : "(local run)"

export function issueBody(results, env = { sr: SR, browser: BROWSER, runLink }) {
  const infrastructure = (why, details = []) =>
    [
      `The nightly ${env.sr ?? "screen-reader"} + ${env.browser ?? "browser"} run failed ${why}.`,
      `OS: ${type()} ${release()} · Run: ${env.runLink}`,
      ...(details.length > 0 ? ["", "```", ...details, "```"] : []),
    ].join("\n")
  if (!results) return infrastructure("before the golden flows ran (install, build or server)")
  // The webServer or global setup failed: Playwright reports errors and runs no test.
  const errors = (results.errors ?? []).map((e) => e.message ?? String(e))
  if (errors.length > 0) return infrastructure("outside the golden flows (server or setup)", errors)
  const failures = []
  const walk = (suite) => {
    for (const spec of suite.specs ?? []) {
      for (const t of spec.tests ?? []) {
        const last = t.results?.at(-1)
        if (!last || last.status === "passed" || last.status === "skipped") continue
        const note = (kind) => t.annotations?.find((a) => a.type === kind)?.description
        failures.push({
          flow: `${t.projectName}: ${spec.title}`,
          error: last.error?.message ?? "",
          spoken: note("spoken") ?? "[]",
          versions: JSON.parse(note("versions") ?? "{}"),
        })
      }
    }
    for (const child of suite.suites ?? []) walk(child)
  }
  for (const suite of results.suites ?? []) walk(suite)
  if (failures.length === 0) {
    // Unexpected results with no failing flow to show: still a failure, never silence.
    const unexpected = results.stats?.unexpected ?? 0
    return unexpected > 0 ? infrastructure(`with ${unexpected} unexpected result(s)`) : ""
  }
  return [
    `Nightly screen-reader run failed · Run: ${env.runLink}`,
    "",
    ...failures.map((f) =>
      [
        `### ${f.flow}`,
        "",
        `Screen reader: ${f.versions.screenReader ?? env.sr ?? "?"} · Browser: ${f.versions.browser ?? env.browser ?? "?"} · OS: ${f.versions.os ?? `${type()} ${release()}`}`,
        "",
        "```",
        f.error,
        "```",
        "",
        "Spoken log:",
        "",
        "```json",
        f.spoken,
        "```",
      ].join("\n"),
    ),
  ].join("\n")
}

if (import.meta.main) {
  const file = new URL("./results.json", import.meta.url)
  const results = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : null
  const body = issueBody(results)
  if (body) console.log(body)
}
