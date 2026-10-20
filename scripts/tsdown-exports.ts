// Shared `exports` setup for the packages' tsdown configs. tsdown writes one `exports` entry
// per build entry (`./button`, `./select`, …) plus the `@rind-ui/source` condition the
// workspace resolves to source (dropped from the published copy, `publishConfig.exports`);
// this adds the explicit `types` condition next to `default` in both, so every subpath
// declares its declarations without relying on the sibling-file lookup.
type Entry = string | { readonly default?: string; readonly [condition: string]: unknown }

function withTypes(exports: Record<string, Entry>): Record<string, Entry> {
  return Object.fromEntries(
    Object.entries(exports).map(([key, entry]) => {
      const { default: js, ...conditions } = typeof entry === "string" ? { default: entry } : entry
      if (!js?.endsWith(".mjs")) return [key, entry]
      return [key, { ...conditions, types: js.replace(/\.mjs$/, ".d.mts"), default: js }]
    }),
  )
}

export const packageExports = { devExports: "@rind-ui/source", customExports: withTypes }
