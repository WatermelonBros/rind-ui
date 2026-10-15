import type { AnyMachine, RawGuard, RawMachineDef, RawTransitions } from "@rind-ui/core"

export interface GraphNode {
  readonly tags: readonly string[]
  readonly entry: readonly string[]
  readonly exit: readonly string[]
  readonly effects: readonly string[]
}

export interface GraphEdge {
  readonly source: string
  /** `null` for internal transitions (actions only). */
  readonly target: string | null
  /** `OPEN`, `after:<delay>`, `$sync:<value key>`, `$props:<prop>` or `$reverted`. */
  readonly event: string
  readonly guard: RawGuard | null
  readonly actions: readonly string[]
}

export interface MachineGraph {
  readonly id: string
  readonly initial: string
  readonly nodes: Readonly<Record<string, GraphNode>>
  readonly edges: readonly GraphEdge[]
}

const list = <T>(t: T | readonly T[] | undefined): readonly T[] =>
  t === undefined ? [] : Array.isArray(t) ? t : [t as T]

/** Extracts the static graph from a machine definition, without running it. */
export function toGraph(machine: AnyMachine): MachineGraph {
  // Every machine's definition has the raw shape; the typed one is a refinement of it.
  const def = machine.def as RawMachineDef
  const nodes: Record<string, GraphNode> = {}
  const edges: GraphEdge[] = []
  const add = (source: string, event: string, transitions: RawTransitions | undefined) => {
    for (const t of list(transitions)) {
      const tr = typeof t === "string" ? { target: t } : t
      edges.push({
        source,
        target: tr.target ?? null,
        event,
        guard: tr.guard ?? null,
        actions: tr.actions ?? [],
      })
    }
  }
  for (const [state, sd] of Object.entries(def.states)) {
    nodes[state] = {
      tags: sd.tags ?? [],
      entry: sd.entry ?? [],
      exit: sd.exit ?? [],
      effects: sd.effects ?? [],
    }
    for (const [event, t] of Object.entries(sd.on ?? {})) add(state, event, t)
    for (const [event, t] of Object.entries(def.on ?? {})) {
      if (!sd.on?.[event]) add(state, event, t)
    }
    for (const [delay, t] of Object.entries(sd.after ?? {})) add(state, `after:${delay}`, t)
    for (const [key, ctl] of Object.entries(def.values ?? {})) {
      for (const target of Object.keys(ctl.states ?? {})) {
        if (target !== state) add(state, `$sync:${key}`, target)
      }
    }
  }
  for (const [prop, event] of Object.entries(def.onProps ?? {})) {
    for (const edge of edges.filter((e) => e.event === event)) {
      edges.push({ ...edge, event: `$props:${prop}` })
    }
  }
  return { id: def.id, initial: def.initial, nodes, edges }
}

export type Path = readonly GraphEdge[]

/** The target state of an edge (internal edges stay in their source). */
const after = (edge: GraphEdge) => edge.target ?? edge.source

/**
 * Shortest paths from the initial state covering every state, or every edge (default).
 * Paths that are prefixes of other paths are dropped.
 */
export function paths(
  graph: MachineGraph,
  options: {
    readonly cover?: "states" | "transitions"
    /** Only edges this returns true for are walked (e.g. those the contract maps). */
    readonly walkable?: (edge: GraphEdge) => boolean
    readonly initial?: string
  } = {},
): readonly Path[] {
  const walkable = graph.edges.filter(options.walkable ?? (() => true))
  const initial = options.initial ?? graph.initial
  // BFS: shortest path to every reachable state.
  const to = new Map<string, Path>([[initial, []]])
  for (const [state, path] of to) {
    for (const edge of walkable) {
      if (edge.source === state && !to.has(after(edge))) to.set(after(edge), [...path, edge])
    }
  }
  const found =
    options.cover === "states"
      ? [...to.values()]
      : walkable.flatMap((edge) => {
          const prefix = to.get(edge.source)
          return prefix ? [[...prefix, edge]] : []
        })
  const isPrefix = (a: Path, b: Path) => a.length < b.length && a.every((e, i) => b[i] === e)
  return found.filter(
    (p, i) => p.length > 0 && !found.some((q, j) => isPrefix(p, q) || (i > j && same(p, q))),
  )
}

const same = (a: Path, b: Path) => a.length === b.length && a.every((e, i) => b[i] === e)

/** Edges no path covers (unreachable, or not walkable). */
export function uncovered(graph: MachineGraph, found: readonly Path[]): readonly GraphEdge[] {
  const covered = new Set(found.flat())
  return graph.edges.filter((e) => !covered.has(e))
}
