// Rolldown (tsdown's unbundled output) turns `export * as Name from "./parts"` into an object
// built with `__exportAll` and re-exports that object. A bundler cannot drop the properties of
// an object, so a consumer using one part would ship them all. This plugin rewrites the
// references back into module namespaces, which bundlers shake member by member; the
// `__exportAll` object is then unused and, being `@__PURE__`, dropped.

/** `<name>_exports` is how Rolldown names the namespace object of a module. */
const NAMESPACE = /^\w+_exports$/

function rewrite(code: string): string {
  // export { a_exports as A, b } from "./m.mjs";
  code = code.replace(/export \{([^}]*)\} from "([^"]+)";/g, (all, list: string, from: string) => {
    const specs = list
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
    const spaces = specs.filter((s) => NAMESPACE.test(s.split(/\s+as\s+/)[0] ?? ""))
    if (spaces.length === 0) return all
    const rest = specs.filter((s) => !spaces.includes(s))
    const out = spaces.map((s) => {
      const [, name = s] = s.split(/\s+as\s+/)
      return `export * as ${name} from "${from}";`
    })
    if (rest.length > 0) out.unshift(`export { ${rest.join(", ")} } from "${from}";`)
    return out.join("\n")
  })
  // import { a_exports, b } from "./m.mjs";
  return code.replace(/import \{([^}]*)\} from "([^"]+)";/g, (all, list: string, from: string) => {
    const specs = list
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
    const spaces = specs.filter((s) => NAMESPACE.test(s))
    if (spaces.length === 0) return all
    const rest = specs.filter((s) => !spaces.includes(s))
    const out = spaces.map((s) => `import * as ${s} from "${from}";`)
    if (rest.length > 0) out.unshift(`import { ${rest.join(", ")} } from "${from}";`)
    return out.join("\n")
  })
}

/** Rolldown plugin: keep namespace re-exports as module namespaces. */
export const namespaceReexports = {
  name: "rind:namespace-reexports",
  renderChunk(code: string) {
    return code.includes("_exports") ? { code: rewrite(code) } : null
  },
}
