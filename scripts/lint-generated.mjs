// Build outputs never go back into git (they caused a merge-conflict cascade; see #65).
import { execSync } from "node:child_process"

const generated = [
  "llms.txt",
  "docs/theme/tokens.md",
  "packages/theme/tokens.manifest.json",
  "packages/theme/src/builder/components.generated.ts",
]
const tracked = execSync(`git ls-files ${generated.join(" ")}`, { encoding: "utf8" }).trim()
if (tracked) {
  console.error(`Generated files are committed (remove them with git rm --cached):\n${tracked}`)
  process.exit(1)
}
