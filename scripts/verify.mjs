// Runs locally exactly what CI runs for this branch (same scope rules: scripts/ci-scope.mjs),
// so CI is never red for something a push could have caught. CI retries a failed browser test
// once; so does this (several sessions share the machine, browser timing flakes under load).
import { execSync } from "node:child_process"
import { scope } from "./ci-scope.mjs"

const base = execSync("git merge-base HEAD origin/main", { encoding: "utf8" }).trim()
const { components, site, full } = scope(base)
const changed = full ? "" : `--changed ${base} --passWithNoTests`
const vitest = (projects) => `pnpm exec vitest run ${projects} ${changed} --retry 1`

const steps = [
  // CI `static`
  "pnpm lint",
  "pnpm typecheck",
  "pnpm quirks:check",
  "pnpm docs:check",
  "pnpm turbo run build --filter='./packages/*' --filter=@rind-ui/storybook",
  "pnpm --filter @rind-ui/core size",
]
if (components) {
  // CI `test` slices. node always in full: seconds, and some tests read files --changed can't see.
  steps.push(
    "pnpm exec vitest run --project node",
    vitest("--project jsdom --project setup-noglobals --project setup-optout"),
    vitest(
      `--project "browser (chromium)" --project "browser (firefox)" --project "browser (webkit)"`,
    ),
    vitest(
      `--project "storybook (chromium)" --project "storybook (firefox)" --project "storybook (webkit)"`,
    ),
    vitest("--project playwright"),
  )
}
// CI `site-audit`
if (site) steps.push("pnpm --filter @rind-ui/site run audit")

for (const step of steps) {
  console.log(`\n▶ ${step}`)
  try {
    execSync(step, {
      stdio: "inherit",
      env: { ...process.env, RIND_BROWSERS: "chromium,firefox,webkit" },
    })
  } catch {
    console.error(`\n✖ verify failed at: ${step}`)
    process.exit(1)
  }
}
console.log("\n✔ verify passed: CI will run the same checks")
