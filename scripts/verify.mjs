// Fast pre-push check (the hook runs it). Not a CI mirror: the machine is shared by several
// sessions, so it runs only what a change can break, in Chromium. CI runs the full matrix.
// - static checks and the node project (seconds; some node tests read CSS and manifests);
// - jsdom + Chromium tests related to the changed source files (`vitest related`);
// - the site build + audit only when apps/site changed.
import { execSync } from "node:child_process"

const base = execSync("git merge-base HEAD origin/main", { encoding: "utf8" }).trim()
const changed = execSync(`git diff --name-only ${base}`, { encoding: "utf8" })
  .split("\n")
  .filter((f) => /\.(ts|tsx|css)$/.test(f) && !f.startsWith("apps/site/"))

const steps = [
  "pnpm lint",
  "pnpm typecheck",
  "pnpm docs:check",
  "pnpm exec vitest run --project node",
]
if (changed.length > 0) {
  steps.push(
    `pnpm exec vitest related ${changed.join(" ")} --run --passWithNoTests --project jsdom --project "browser (chromium)"`,
  )
}
if (/^apps\/site\//m.test(execSync(`git diff --name-only ${base}`, { encoding: "utf8" }))) {
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
