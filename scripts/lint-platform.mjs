// Fails when code reads the user agent or a platform flag outside dom/platform.ts and
// dom/quirks.ts (openspec a11y-quirks): workarounds go through quirk entries instead.
// Flag reads are found by name in every form — `.ios`, `["ios"]`, `{ ios } = …`,
// `({ ios }) =>` — on any value, which is stricter than a type-aware check (TypeScript 7's
// compiler API is not stable yet). A deliberate platform convention (⌘ vs Control, Option
// typing characters) is allowed with `// platform-convention: <why>` on the line or the one
// above it.
// Usage: node scripts/lint-platform.mjs [dir…]  (default: packages/core/src packages/react/src)
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"

const ALLOWED = ["core/src/dom/platform.ts", "core/src/dom/quirks.ts"]
const FLAGS = "apple|mac|ios|android|windows|webkit|chromium|firefox|engine"
const PATTERNS = [
  /navigator\s*\.\s*userAgent\b/,
  /\buserAgentData\b/,
  /navigator\s*\.\s*platform\b/,
  // Member access, optional chaining included.
  new RegExp(`\\??\\.\\s*(${FLAGS})\\b(?!\\s*\\()`),
  // Element access with a string key.
  new RegExp(`\\[\\s*["'\`](${FLAGS})["'\`]\\s*\\]`),
  // Destructuring in a declaration or an assignment.
  new RegExp(`\\{[^{}]*\\b(${FLAGS})\\b[^{}]*\\}\\s*=[^=>]`),
  // Destructured parameters.
  new RegExp(`\\(\\s*\\{[^{}]*\\b(${FLAGS})\\b[^{}]*\\}\\s*[:,)]`),
]
const CONVENTION = /\/\/\s*platform-convention:\s*\S/

const roots = process.argv.slice(2)
const dirs = roots.length > 0 ? roots : ["packages/core/src", "packages/react/src"]

function* files(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) yield* files(path)
    else if (/\.tsx?$/.test(name) && !/\.test(-d)?\.tsx?$/.test(name)) yield path
  }
}

/** Strips comments and string contents (keeping bracket-key strings), so prose never matches. */
const code = (line) =>
  line
    .replace(/\/\/.*$/, "")
    .replace(/(["'`])(?:(?!\1)[^\\]|\\.)*\1/g, (s, _q, offset, all) =>
      all[offset - 1] === "[" ? s : '""',
    )

const problems = []
for (const dir of dirs) {
  for (const file of files(dir)) {
    if (ALLOWED.some((allowed) => file.replaceAll("\\", "/").endsWith(allowed))) continue
    const lines = readFileSync(file, "utf8").split("\n")
    lines.forEach((line, i) => {
      if (CONVENTION.test(line) || CONVENTION.test(lines[i - 1] ?? "")) return
      if (PATTERNS.some((p) => p.test(code(line)))) {
        problems.push(`${relative(process.cwd(), file)}:${i + 1}: ${line.trim()}`)
      }
    })
  }
}

if (problems.length > 0) {
  console.error(
    "User agent / platform reads outside dom/platform.ts and dom/quirks.ts.\nGate the workaround with a quirk entry (quirkActive), or mark a deliberate convention with `// platform-convention: <why>`:",
  )
  for (const p of problems) console.error(`  ${p}`)
  process.exit(1)
}
