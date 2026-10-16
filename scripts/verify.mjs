// What CI checks, minus the slow slices, so a push is not red on CI for something a laptop
// can catch: static checks, the whole node project (seconds; some tests read CSS and
// manifests that `vitest --changed` can't see), and jsdom + Chromium on what changed, retried once
// like CI (several sessions share this machine, so browser timing flakes under load).
import { execSync } from "node:child_process"

const base = execSync("git merge-base HEAD origin/main", { encoding: "utf8" }).trim()
const steps = [
  "pnpm lint",
  "pnpm typecheck",
  "pnpm quirks:check",
  "pnpm docs:check",
  "pnpm exec vitest run --project node",
  `pnpm exec vitest run --changed ${base} --passWithNoTests --retry 1 --project jsdom --project setup-noglobals --project setup-optout --project "browser (chromium)"`,
]
// The site prerenders every example: a component change can break it, so build and audit it
// when the site or a package it renders changed. Slow (minutes), hence only then.
const changed = execSync(`git diff --name-only ${base}`, { encoding: "utf8" })
if (/^(apps\/site|packages\/(core|react|theme))\//m.test(changed)) {
  steps.push("pnpm --filter @rind-ui/site run audit")
}
for (const step of steps) {
  console.log(`\n▶ ${step}`)
  try {
    execSync(step, { stdio: "inherit", env: { ...process.env, RIND_BROWSERS: "chromium" } })
  } catch {
    console.error(`\n✖ verify failed at: ${step}`)
    process.exit(1)
  }
}
console.log("\n✔ verify passed")
