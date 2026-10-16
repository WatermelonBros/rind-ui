// Docs examples compose parts the way the components require: a part of a component that
// has a Root (`TextField.Input`) must sit inside an open `<TextField.Root>` in the same
// example. Catches snippets that would throw "must be inside …Root" when copied.
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { expect, it } from "vitest"

const root = new URL("..", import.meta.url).pathname
const files = (dir: string): string[] =>
  readdirSync(join(root, dir), { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? files(join(dir, e.name)) : e.name.endsWith(".md") ? [join(dir, e.name)] : [],
  )
const docs = files("docs").filter((f) => !f.startsWith(join("docs", "research")))
const blocks = (text: string) => [...text.matchAll(/```tsx\n([\s\S]*?)```/g)].map((m) => m[1] ?? "")

// Components with a Root part, read from the examples themselves.
const withRoot = new Set<string>()
for (const f of docs) {
  for (const m of readFileSync(join(root, f), "utf8").matchAll(/<([A-Z]\w*)\.Root\b/g)) {
    if (m[1]) withRoot.add(m[1])
  }
}

/**
 * Parts that are another component's Root (CheckboxGroup.Parent is a Checkbox.Root), or a
 * second root of their own (Avatar.Group holds avatars and its GroupOverflow).
 */
const ROOT_ALIASES: Readonly<Record<string, string>> = {
  "CheckboxGroup.Parent": "Checkbox",
  "Avatar.Group": "Avatar",
}

/** Problems in one example: parts used outside an open Root of their component. */
function misplacedParts(code: string): string[] {
  const out: string[] = []
  const open = new Map<string, number>()
  for (const m of code.matchAll(/<(\/?)([A-Z]\w*)\.(\w+)([^>]*?)(\/?)>/g)) {
    const [, closing, tagName = "", part, , selfClosing] = m
    const alias = ROOT_ALIASES[`${tagName}.${part}`]
    const name = alias ?? tagName
    if (part === "Root" || alias) {
      const n = open.get(name) ?? 0
      if (closing) open.set(name, n - 1)
      else if (!selfClosing) open.set(name, n + 1)
      continue
    }
    if (closing || !withRoot.has(name)) continue
    if ((open.get(name) ?? 0) <= 0) out.push(`<${name}.${part}> outside <${name}.Root>`)
  }
  return out
}

it("flags a part outside its Root", () => {
  withRoot.add("TextField")
  expect(misplacedParts("<Field.Root><TextField.Input /></Field.Root>")).toEqual([
    "<TextField.Input> outside <TextField.Root>",
  ])
  expect(misplacedParts("<TextField.Root><TextField.Input /></TextField.Root>")).toEqual([])
})

it.each(docs)("%s: every part is inside its component's Root", (file) => {
  const problems = blocks(readFileSync(join(root, file), "utf8")).flatMap(misplacedParts)
  expect(problems).toEqual([])
})
