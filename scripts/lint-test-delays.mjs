// Fails when a test waits for elapsed time (user rule: nothing in tests may depend on it).
// Banned in *.test.* and *.pw.test.* files: `page.waitForTimeout(…)`, and a promise resolved
// by `setTimeout` (`new Promise((r) => setTimeout(r, …))`, `setTimeout(resolve, …)`).
// Allowed: waiting on a condition with a deadline, fake timers, and a `setTimeout` that only
// implements a scheduler under test control — mark that line (or the one above) with
// `// fake-time: <why>`.
// Usage: node scripts/lint-test-delays.mjs [dir…]  (default: packages a11y-nightly apps/site/tests)
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"

const PATTERNS = [
  /\bwaitForTimeout\s*\(/,
  // A promise that settles after a delay: `setTimeout(r, …)` / `setTimeout(resolve, …)`.
  /\bsetTimeout\s*\(\s*(r|res|resolve|done|ok)\s*[,)]/,
  // `setTimeout(() => r(), …)` and friends.
  /\bsetTimeout\s*\(\s*\(\)\s*=>\s*(r|res|resolve|done|ok)\s*\(/,
]
const ALLOW = /\/\/\s*fake-time:\s*\S/
const TEST = /\.(test|spec)\.(ts|tsx|mts|js)$/

const roots = process.argv.slice(2)
const dirs = roots.length > 0 ? roots : ["packages", "a11y-nightly", "apps/site/tests"]

/** Every test file under `dir`, skipping dependencies and build output. */
function* files(dir) {
  if (!existsSync(dir)) return
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "dist" || name === "out" || name.startsWith("."))
      continue
    const path = join(dir, name)
    if (statSync(path).isDirectory()) yield* files(path)
    else if (TEST.test(name)) yield path
  }
}

const problems = []
for (const dir of dirs) {
  for (const file of files(dir)) {
    const lines = readFileSync(file, "utf8").split("\n")
    lines.forEach((line, i) => {
      if (!PATTERNS.some((p) => p.test(line))) return
      if (ALLOW.test(line) || ALLOW.test(lines[i - 1] ?? "")) return
      problems.push(`  ${relative(process.cwd(), file)}:${i + 1}: ${line.trim()}`)
    })
  }
}

if (problems.length > 0) {
  console.error(
    "Tests wait for elapsed time. Wait for a condition (with a deadline) or use fake time;",
  )
  console.error("a scheduler under test control may use setTimeout with `// fake-time: <why>`:")
  for (const p of problems) console.error(p)
  process.exit(1)
}
