// Checks the quirks registry: every entry's repro test exists (fails otherwise), and
// entries verified more than twelve months ago are reported for re-testing.
// Run: pnpm quirks:check   (Node strips the types; quirks.ts has no runtime imports)
import { existsSync } from "node:fs"
import { quirks } from "../packages/core/src/dom/quirks.ts"

interface Entry {
  readonly id: string
  readonly links: readonly string[]
  readonly test: string
  readonly removeWhen: string
  readonly verified: string
}

export function checkQuirks(
  entries: readonly Entry[],
  options: { readonly exists: (path: string) => boolean; readonly today: Date },
): { readonly missing: readonly string[]; readonly stale: readonly string[] } {
  const year = 365 * 24 * 60 * 60 * 1000
  return {
    missing: entries
      .filter((q) => !options.exists(q.test))
      .map((q) => `${q.id}: test ${q.test} does not exist`),
    stale: entries
      .filter((q) => options.today.getTime() - new Date(q.verified).getTime() > year)
      .map(
        (q) =>
          `${q.id}: last verified ${q.verified} — re-test (${q.links.join(", ")}); remove when ${q.removeWhen}`,
      ),
  }
}

if (import.meta.main) {
  const { missing, stale } = checkQuirks(quirks, { exists: existsSync, today: new Date() })
  for (const s of stale) console.warn(`stale quirk: ${s}`)
  for (const m of missing) console.error(`missing repro: ${m}`)
  if (missing.length > 0) process.exit(1)
  console.log(`${quirks.length} quirks checked, ${stale.length} stale`)
}
