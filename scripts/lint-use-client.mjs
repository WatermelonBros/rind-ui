// Every @rind-ui/react module that runs hooks starts with "use client", so a Next app can
// import the components from a Server Component without a wrapper. Pure helpers (mergeProps,
// normalizeProps, …) and barrels stay unmarked: a Server Component must still call them.
import { globSync, readFileSync } from "node:fs"

const hooks = /\buse[A-Z]\w*\(|\bcreateContext\b|\buse\(/
const files = globSync("packages/react/src/**/*.{ts,tsx}").filter(
  (file) => !/\.test(-d)?\.tsx?$/.test(file) && !file.endsWith(".d.ts"),
)
const wrong = files.filter((file) => {
  const source = readFileSync(file, "utf8")
  return hooks.test(source) !== source.startsWith('"use client"\n')
})
if (wrong.length > 0) {
  console.error(
    `"use client" must open exactly the modules that use hooks:\n  ${wrong.join("\n  ")}`,
  )
  process.exit(1)
}
