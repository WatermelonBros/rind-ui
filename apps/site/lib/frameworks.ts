import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

/**
 * Which frameworks rind ships, and which components each has, read from the packages at build
 * time so the site never drifts from them: a framework is out once its package has a released
 * version (a placeholder `0.0.0` is not), and its components are its package's entry points
 * (`exports` keys other than "." and "./package.json": "./accordion" is the slug "accordion",
 * the same as the docs page's).
 */
export type FrameworkId = "react" | "vue" | "svelte" | "solid" | "angular"

export interface Framework {
  readonly id: FrameworkId
  readonly name: string
  /** the package, as it is installed */
  readonly pkg: string
  /** released on npm: its install command works */
  readonly ready: boolean
  /** the docs slugs it has a component for (empty when it has none yet) */
  readonly components: readonly string[]
}

const ORDER: readonly { id: FrameworkId; name: string }[] = [
  { id: "react", name: "React" },
  { id: "vue", name: "Vue" },
  { id: "svelte", name: "Svelte" },
  { id: "solid", name: "Solid" },
  { id: "angular", name: "Angular" },
]

const packages = join(process.cwd(), "../../packages")

function read(id: FrameworkId): Framework {
  const name = ORDER.find((f) => f.id === id)?.name ?? id
  const file = join(packages, id, "package.json")
  if (!existsSync(file)) return { id, name, pkg: `@rind-ui/${id}`, ready: false, components: [] }
  const json = JSON.parse(readFileSync(file, "utf8")) as {
    readonly name?: string
    readonly version?: string
    readonly private?: boolean
    readonly exports?: Record<string, unknown>
  }
  const components = Object.keys(json.exports ?? {})
    .filter((k) => k !== "." && k !== "./package.json" && k.startsWith("./"))
    .map((k) => k.slice(2))
  const ready = !json.private && json.version !== undefined && json.version !== "0.0.0"
  return { id, name, pkg: json.name ?? `@rind-ui/${id}`, ready, components }
}

/** Every framework, in the site's order, as the packages say today. */
export function frameworks(): readonly Framework[] {
  return ORDER.map((f) => read(f.id))
}
