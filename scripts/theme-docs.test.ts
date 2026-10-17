import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { expect, it } from "vitest"
// @ts-expect-error plain .mjs script, no types
import { renderTokens } from "./theme-docs.mjs"

it("renders every token of a fresh manifest into the token reference", () => {
  execFileSync("node", [
    new URL("../packages/theme/scripts/token-manifest.mjs", import.meta.url).pathname,
  ])
  const manifest = JSON.parse(
    readFileSync(new URL("../packages/theme/tokens.manifest.json", import.meta.url), "utf8"),
  )
  const md: string = renderTokens(manifest)
  for (const t of [...manifest.tier2, ...manifest.runtime]) expect(md).toContain(`\`${t}\``)
  for (const scope of Object.keys(manifest.components)) expect(md).toContain(`### ${scope}`)
})
