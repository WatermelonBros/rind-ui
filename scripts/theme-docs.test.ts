import { readFileSync } from "node:fs"
import { expect, it } from "vitest"
// @ts-expect-error plain .mjs script, no types
import { renderTokens } from "./theme-docs.mjs"

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8")

it("docs/theme/tokens.md is up to date with the manifest", () => {
  const manifest = JSON.parse(read("packages/theme/tokens.manifest.json"))
  expect(read("docs/theme/tokens.md")).toBe(renderTokens(manifest))
})
