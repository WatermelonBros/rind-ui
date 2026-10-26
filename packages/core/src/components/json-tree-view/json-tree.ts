// JSON Tree View's model (add-json-tree-view design §1–§4, §6, §7): a value as a lazy Tree
// View collection. Keys are JSON Pointers (RFC 6901: no dotted-path collision, Zag); children
// exist only for expanded containers (Zag and vue-json-pretty convert everything first); big
// containers are split in nested ranges (react-json-tree); a cycle is an ancestor only (Zag
// flags shared values).

import { createTreeCollection, type TreeCollection } from "../../collection/tree"

export type JsonType =
  | "string"
  | "number"
  | "bigint"
  | "boolean"
  | "null"
  | "undefined"
  | "object"
  | "array"
  | "map"
  | "set"
  | "date"
  | "regexp"
  | "error"
  | "function"
  | "symbol"
  | "instance"
  | "circular"
  | "range"

/** One visible row. */
export interface JsonNode {
  /** The JSON Pointer (a range: the container's pointer + `#first-last`). */
  readonly key: string
  /** The property name or index; `null` for a primitive top-level value. */
  readonly label: string | null
  readonly type: JsonType
  /** The raw value (a range: the container's). */
  readonly value: unknown
  /** Entries of a container (a range: its size). */
  readonly count: number
  /** A range's bounds, inclusive, as positions in the container's entries. */
  readonly range?: { readonly first: number; readonly last: number } | undefined
  readonly children: readonly JsonNode[]
  /** A container (or range) that has entries, built or not. */
  readonly branch: boolean
}

/** RFC 6901 token escaping. */
export const pointerToken = (token: string) => token.replace(/~/g, "~0").replace(/\//g, "~1")

const CONTAINERS = new Set<JsonType>(["object", "array", "map", "set", "error"])

export function jsonType(value: unknown): JsonType {
  if (value === null) return "null"
  switch (typeof value) {
    case "string":
    case "number":
    case "bigint":
    case "boolean":
    case "undefined":
    case "function":
    case "symbol":
      return typeof value as JsonType
  }
  if (Array.isArray(value)) return "array"
  if (value instanceof Map) return "map"
  if (value instanceof Set) return "set"
  if (value instanceof Date) return "date"
  if (value instanceof RegExp) return "regexp"
  if (value instanceof Error) return "error"
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null ? "object" : "instance"
}

/** A container's entries as [label, value]: own enumerable keys, defined indexes, Map pairs. */
export function jsonEntries(value: unknown): [string, unknown][] {
  switch (jsonType(value)) {
    case "array":
      // forEach skips holes (sparse arrays: their defined indexes only).
      return (() => {
        const out: [string, unknown][] = []
        ;(value as unknown[]).forEach((v, i) => {
          out.push([String(i), v])
        })
        return out
      })()
    case "map":
      return [...(value as Map<unknown, unknown>).entries()].map(([k, v], i) =>
        typeof k === "string" ? [k, v] : [String(i), { key: k, value: v }],
      )
    case "set":
      return [...(value as Set<unknown>).values()].map((v, i) => [String(i), v])
    case "error": {
      const e = value as Error
      return [
        ["name", e.name],
        ["message", e.message],
        ...(e.stack ? ([["stack", e.stack]] as [string, unknown][]) : []),
        ...Object.entries(e).filter(([k]) => k !== "name" && k !== "message" && k !== "stack"),
      ]
    }
    case "object":
      return Object.entries(value as object)
    default:
      return []
  }
}

/** A container's size as its summary counts it (a sparse array: its length). */
export function jsonCount(value: unknown): number {
  const type = jsonType(value)
  if (type === "array") return (value as unknown[]).length
  if (type === "map") return (value as Map<unknown, unknown>).size
  if (type === "set") return (value as Set<unknown>).size
  return jsonEntries(value).length
}

export interface JsonTreeOptions {
  /** Expanded keys: only their children are built. */
  readonly expanded: ReadonlySet<string>
  /** Default 100. */
  readonly groupSize?: number | undefined
}

function build(
  label: string | null,
  key: string,
  value: unknown,
  ancestors: readonly unknown[],
  o: JsonTreeOptions,
): JsonNode {
  const type = jsonType(value)
  if (CONTAINERS.has(type) && ancestors.includes(value)) {
    return { key, label, type: "circular", value, count: 0, children: [], branch: false }
  }
  if (!CONTAINERS.has(type)) {
    return { key, label, type, value, count: 0, children: [], branch: false }
  }
  const count = jsonCount(value)
  const entries = o.expanded.has(key) ? jsonEntries(value) : null
  const branch = entries ? entries.length > 0 : count > 0
  const children = entries ? group(key, value, entries, [...ancestors, value], o) : []
  return { key, label, type, value, count, children, branch }
}

/** The children of `key`: entries, or nested ranges when there are more than `groupSize`. */
function group(
  key: string,
  value: unknown,
  entries: readonly [string, unknown][],
  ancestors: readonly unknown[],
  o: JsonTreeOptions,
  offset = 0,
): JsonNode[] {
  const size = Math.max(2, o.groupSize ?? 100)
  if (entries.length <= size) {
    return entries.map(([label, v]) =>
      build(label, `${key}/${pointerToken(label)}`, v, ancestors, o),
    )
  }
  // The smallest power of `size` that splits the entries into at most `size` groups.
  let span = size
  while (entries.length / span > size) span *= size
  const out: JsonNode[] = []
  for (let first = 0; first < entries.length; first += span) {
    const slice = entries.slice(first, first + span)
    const last = first + slice.length - 1
    const rangeKey = `${key}#${offset + first}-${offset + last}`
    const children = o.expanded.has(rangeKey)
      ? group(key, value, slice, ancestors, o, offset + first)
      : []
    out.push({
      key: rangeKey,
      label: null,
      type: "range",
      value,
      count: slice.length,
      range: { first: offset + first, last: offset + last },
      children,
      branch: true,
    })
  }
  return out
}

/** The visible tree of `value` as nodes: the top-level entries are the roots. */
export function jsonRoots(value: unknown, o: JsonTreeOptions): JsonNode[] {
  const type = jsonType(value)
  if (!CONTAINERS.has(type)) return [build(null, "", value, [], o)]
  return group("", value, jsonEntries(value), [value], o)
}

/** The roots as a Tree View collection (rebuilt when the value or the expansion changes). */
export function jsonTreeCollection(value: unknown, o: JsonTreeOptions): TreeCollection<JsonNode> {
  return createTreeCollection<JsonNode>({
    roots: jsonRoots(value, o),
    getKey: (n) => n.key,
    getText: (n) => n.label ?? "",
    getChildren: (n) => n.children,
    hasUnloadedChildren: (n) => n.branch && n.children.length === 0,
  })
}

/** Keys of every container down to `depth` levels (1: the roots open), at most `max` rows. */
export function jsonExpandedKeys(
  value: unknown,
  depth: number,
  o: { readonly groupSize?: number | undefined; readonly max?: number | undefined } = {},
): string[] {
  const max = o.max ?? 5000
  const keys = new Set<string>()
  let rows = 0
  let level: JsonNode[] = jsonRoots(value, { expanded: keys, groupSize: o.groupSize })
  rows = level.length
  for (let d = 0; d < depth && level.length > 0; d++) {
    const next: JsonNode[] = []
    for (const node of level) {
      if (!node.branch) continue
      if (rows + node.count > max) return [...keys]
      keys.add(node.key)
      rows += Math.min(node.count, Math.max(2, o.groupSize ?? 100))
    }
    // Rebuild with the new keys to reach the next level's nodes.
    const rebuilt = jsonRoots(value, { expanded: keys, groupSize: o.groupSize })
    const byDepth = (nodes: JsonNode[], at: number): JsonNode[] =>
      at === 0 ? nodes : nodes.flatMap((n) => byDepth([...n.children], at - 1))
    next.push(...byDepth(rebuilt, d + 1))
    level = next
  }
  return [...keys]
}

/** The value's one-line text: strings escaped, numbers and others exact. */
export function jsonValueText(node: Pick<JsonNode, "type" | "value">): string {
  const v = node.value
  switch (node.type) {
    case "string":
      return (v as string)
        .replace(/\\/g, "\\\\")
        .replace(/"/g, '\\"')
        .replace(/\n/g, "\\n")
        .replace(/\r/g, "\\r")
        .replace(/\t/g, "\\t")
    case "number":
      return Object.is(v, -0) ? "-0" : String(v)
    case "bigint":
    case "boolean":
      return String(v)
    case "null":
      return "null"
    case "undefined":
      return "undefined"
    case "date": {
      const d = v as Date
      return Number.isNaN(d.getTime()) ? "Invalid Date" : d.toISOString()
    }
    case "regexp":
      return String(v)
    case "function":
      return `${(v as { name?: string }).name || "anonymous"}()`
    case "symbol":
      return String(v)
    case "instance":
      return (Object.getPrototypeOf(v)?.constructor?.name as string | undefined) ?? "Object"
    default:
      return ""
  }
}

/** JSON of a subtree: BigInt as digits, Map/Set as arrays of entries; a cycle throws. */
export function jsonStringify(value: unknown, space = 2): string {
  const seen: unknown[] = []
  const norm = (v: unknown): unknown => {
    const type = jsonType(v)
    if (type === "bigint") return { $bigint: String(v) }
    if (!CONTAINERS.has(type)) return v
    if (seen.includes(v)) throw new TypeError("Converting circular structure to JSON")
    seen.push(v)
    try {
      if (type === "map")
        return [...(v as Map<unknown, unknown>).entries()].map(([k, x]) => [norm(k), norm(x)])
      if (type === "set") return [...(v as Set<unknown>).values()].map(norm)
      if (type === "array") return (v as unknown[]).map(norm)
      return Object.fromEntries(jsonEntries(v).map(([k, x]) => [k, norm(x)]))
    } finally {
      seen.pop()
    }
  }
  const text = JSON.stringify(norm(value), null, space) ?? "undefined"
  // BigInt placeholders back to bare digits.
  return text.replace(/\{\s*"\$bigint":\s*"(-?\d+)"\s*\}/g, "$1")
}

/** What a copy of `node` writes, by format. */
export function jsonCopyText(node: JsonNode, format: "json" | "value" | "pointer"): string {
  if (format === "pointer") return node.key
  if (format === "value" && !node.branch && node.type !== "circular") return jsonValueText(node)
  if (node.type === "circular") throw new TypeError("Converting circular structure to JSON")
  return jsonStringify(node.value)
}
