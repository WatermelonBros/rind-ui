// Pre-push check (the hook runs it): the fast, machine-friendly part only — static checks and
// the node project (seconds; some node tests read CSS and manifests). Before pushing, the author
// also runs the tests for what they wrote and touched (targeted, not the whole suite). CI runs
// the full matrix.
import { execSync } from "node:child_process"

const steps = [
  "pnpm lint",
  "pnpm typecheck",
  "pnpm docs:check",
  "pnpm exec vitest run --project node",
]
for (const step of steps) {
  console.log(`\n▶ ${step}`)
  try {
    execSync(step, { stdio: "inherit" })
  } catch {
    console.error(`\n✖ verify failed at: ${step}`)
    process.exit(1)
  }
}
console.log("\n✔ verify passed")
