// Which parts of CI a change needs. Shared by CI's `changes` job and `pnpm verify`, so the local
// check can never run less than CI does. Prints `components=…`, `site=…`, `full=…` lines.
import { execSync } from "node:child_process"

export function scope(base) {
  const files = execSync(`git diff --name-only ${base}...HEAD`, { encoding: "utf8" })
    .split("\n")
    .filter(Boolean)
  const any = (re) => files.some((f) => re.test(f))
  return {
    // Anything outside the site and prose touches the components; so do the site's examples,
    // which the component tests (axe, ARIA snapshots, state coverage) open.
    components: files.some(
      (f) =>
        /^apps\/site\/examples\//.test(f) ||
        !/^(apps\/site\/|docs\/|[^/]+\.md$|\.changeset\/)/.test(f),
    ),
    site: any(/^(apps\/site\/|packages\/|docs\/|pnpm-lock\.yaml|package\.json|\.github\/)/),
    // Config, dependencies and the test infrastructure itself: run the whole suite, since
    // Vitest's --changed only follows imports.
    full: any(
      /^(package\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml|vitest\.config\.ts|tsconfig[^/]*\.json|\.github\/|\.nvmrc|scripts\/(ci-scope|verify)\.mjs|packages\/testing\/src\/(model|driver|adapter|adapters\/|invariants|collect|setup|env)|packages\/[^/]+\/package\.json|packages\/[^/]+\/tsdown\.config\.ts|apps\/site\/examples\/harness\.ts|packages\/testing\/fixtures\/harness\.ts)/,
    ),
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  for (const [k, v] of Object.entries(scope(process.argv[2] ?? "origin/main")))
    console.log(`${k}=${v}`)
}
