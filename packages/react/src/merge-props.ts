import { CRITICAL } from "@rind-ui/core"
import type { Ref, RefCallback } from "react"

// Bundlers replace `process.env.NODE_ENV` and drop the dead branch in production builds.
// Unbundled ESM must define `process.env.NODE_ENV` (as for React).
declare const process: { env: { NODE_ENV?: string } }

/** Added by `mergeProps` to every event a part handles. */
export interface RindEventExtension {
  /** Skips the part's own handler for this event. Native defaults are unaffected. */
  preventRindHandler(): void
}

type Props = Record<string | symbol, unknown>
type Handler = (event: object) => unknown
interface Link {
  readonly fn: Handler
  /** The part's own handler: skipped after `preventRindHandler()`. */
  readonly part: boolean
}

const CHAIN = Symbol("rind-ui.chain")
type Chained = Handler & { readonly [CHAIN]: readonly Link[] }

const isHandler = (key: string, value: unknown): value is Handler =>
  typeof value === "function" && /^on[A-Z]/.test(key)

/** A handler's links: its chain if `mergeProps` built it, else itself. */
const linksOf = (fn: Handler, part: boolean): readonly Link[] =>
  CHAIN in fn ? (fn as Chained)[CHAIN] : [{ fn, part }]

/** Runs the links in order; the opt-out only skips links that belong to the part. */
function chain(links: readonly Link[]): Chained {
  const run = (event: object) => {
    let skip = false
    const extension: RindEventExtension = { preventRindHandler: () => (skip = true) }
    Object.assign(event, extension)
    for (const link of links) if (!(link.part && skip)) link.fn(event)
  }
  return Object.assign(run, { [CHAIN]: links })
}

interface Composed {
  readonly fn: RefCallback<unknown>
  /** The part's latest ref: parts may create theirs inline on every render. */
  part: Ref<unknown> | undefined
}
const composed = new WeakMap<object, Composed>()

/**
 * Composes a part's ref with the consumer's, including React 19 callback refs that return
 * a cleanup. The result is cached per consumer ref and calls the part's latest ref, so it
 * stays stable even when the part's ref is created inline, and React does not re-attach it
 * on every render.
 */
export function composeRefs<T>(
  part: Ref<T> | undefined,
  consumer: Ref<T> | undefined,
): Ref<T> | undefined {
  if (!part || !consumer) return part ?? consumer
  let entry = composed.get(consumer)
  if (!entry) {
    const target = consumer as Ref<unknown>
    const created: Composed = {
      part: undefined,
      fn: (node) => {
        const refs = [created.part, target]
        const cleanups = refs.map((ref) => {
          if (typeof ref === "function") return ref(node)
          if (ref) ref.current = node
          return undefined
        })
        return () => {
          refs.forEach((ref, i) => {
            const cleanup = cleanups[i]
            if (typeof cleanup === "function") cleanup()
            else if (typeof ref === "function") ref(null)
            else if (ref) ref.current = null
          })
        }
      },
    }
    composed.set(consumer, created)
    entry = created
  }
  // Ref<T> and Ref<unknown> differ only in the node type the ref receives.
  entry.part = part as Ref<unknown>
  return entry.fn as RefCallback<T>
}

const warned = new Set<string>()
/** Warns once per part, attribute and message. */
function warnCritical(props: Props, key: string, message: string) {
  const part = `${String(props["data-scope"])}.${String(props["data-part"])}`
  const id = `${part}.${key}:${message}`
  if (warned.has(id)) return
  warned.add(id)
  console.warn(`[rind-ui] ${part}: ${message}`)
}

/**
 * Merges a part's props with consumer layers, later layers winning. Handlers all run, the
 * last layer first and the part's last; `event.preventRindHandler()` skips only the part's.
 * Undefined consumer values are ignored. Class names concatenate, styles merge, refs
 * compose. Overriding (or clearing) an attribute the part's accessibility depends on warns
 * once in development. The CRITICAL marker stays until `renderPart` renders.
 */
export function mergeProps(part: Props, ...layers: Props[]): Props {
  let out: Props = { ...part }
  for (const layer of layers) out = mergeTwo(out, layer)
  return out
}

/** Keys where a consumer's null means "nothing to add", like undefined. */
const KEEP_ON_NULL = new Set(["className", "style", "ref"])

function mergeTwo(base: Props, top: Props): Props {
  const out: Props = { ...base }
  const critical = (base[CRITICAL] as readonly string[] | undefined) ?? []
  for (const key of Object.keys(top)) {
    const a = base[key]
    const b = top[key]
    const empty =
      b === undefined ||
      (b === null && (KEEP_ON_NULL.has(key) || /^on[A-Z]/.test(key) || critical.includes(key)))
    if (empty) {
      if (process.env.NODE_ENV !== "production" && critical.includes(key) && a !== undefined) {
        warnCritical(
          base,
          key,
          `"${key}" cannot be cleared: the part's accessibility depends on it.`,
        )
      }
      continue
    }
    // "!key" in the marker: the part owns the attribute (a roving item's id, which its
    // relations and focus resolve): the consumer's value is dropped.
    if (a !== undefined && critical.includes(`!${key}`)) {
      if (process.env.NODE_ENV !== "production" && a !== b) {
        warnCritical(base, key, `"${key}" is the part's own; the given value is ignored.`)
      }
      continue
    }
    if (a === undefined) {
      out[key] = isHandler(key, b) ? chain(linksOf(b, false)) : b
    } else if (isHandler(key, a) && isHandler(key, b)) {
      // A handler that is not a chain yet can only be the part's own.
      out[key] = chain([...linksOf(b, false), ...linksOf(a, !(CHAIN in a))])
    } else if (key === "className") {
      out[key] = `${a} ${b}`
    } else if (key === "style") {
      out[key] = { ...(a as object), ...(b as object) }
    } else if (key === "ref") {
      out[key] = composeRefs(a as Ref<unknown>, b as Ref<unknown>)
    } else {
      out[key] = b
      if (process.env.NODE_ENV !== "production" && critical.includes(key) && a !== b) {
        warnCritical(base, key, `overriding "${key}" can break its accessibility.`)
      }
    }
  }
  return out
}

/** Removes the CRITICAL marker before props reach an element. */
export function stripMarker(props: Props): Props {
  if (!(CRITICAL in props)) return props
  const { [CRITICAL]: _, ...rest } = props
  return rest
}
