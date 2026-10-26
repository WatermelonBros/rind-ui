// Framework-neutral prop merging for the adapters. Each adapter merges in its own spelling
// (Vue `onClick`/`class`, Svelte `onclick`/`class`/`style` string), so the spelling-specific
// steps are options; the rules are the same everywhere (react-adapter "Merging Consumer
// Props"): handlers chain, the consumer's first and the part's last; `preventRindHandler()`
// skips the part's; class concatenates; style merges; refs compose; overriding an attribute
// the part's accessibility depends on warns once in development.
import { CRITICAL } from "../connect/props"

// Bundlers replace `process.env.NODE_ENV` and drop the dead branch in production builds.
declare const process: { env: { NODE_ENV?: string } }

/** Added by `mergeProps` to every event a part handles. */
export interface RindEventExtension {
  /** Skips the part's own handler for this event. Native defaults are unaffected. */
  preventRindHandler(): void
}

export type AdapterProps = Record<string | symbol, unknown>
/** A consumer layer: an attrs or props object (symbol keys, if any, are kept). */
export type PropsLayer = Readonly<Record<string, unknown>> | Readonly<AdapterProps>
type Handler = (event: object) => unknown
interface Link {
  readonly fn: Handler
  /** The part's own handler: skipped after `preventRindHandler()`. */
  readonly part: boolean
}

const CHAIN = Symbol("rind-ui.chain")
type Chained = Handler & { readonly [CHAIN]: readonly Link[] }

const linksOf = (fn: Handler, part: boolean): readonly Link[] =>
  CHAIN in fn ? (fn as Chained)[CHAIN] : [{ fn, part }]

function chain(links: readonly Link[]): Chained {
  const run = (event: object) => {
    let skip = false
    const extension: RindEventExtension = { preventRindHandler: () => (skip = true) }
    Object.assign(event, extension)
    for (const link of links) if (!(link.part && skip)) link.fn(event)
  }
  return Object.assign(run, { [CHAIN]: links })
}

export interface MergeOptions {
  /** Whether `key` names an event handler in this framework's spelling. */
  readonly isHandler: (key: string) => boolean
  /** Combines two style values (the consumer's `b` wins per property). */
  readonly mergeStyle: (a: unknown, b: unknown) => unknown
  /** Combines two refs under `refKey`; omit when refs are not props. */
  readonly refKey?: string | symbol
  readonly composeRefs?: (a: unknown, b: unknown) => unknown
}

const warned = new Set<string>()
function warnCritical(props: AdapterProps, key: string, message: string) {
  const part = `${String(props["data-scope"])}.${String(props["data-part"])}`
  const id = `${part}.${key}:${message}`
  if (warned.has(id)) return
  warned.add(id)
  console.warn(`[rind-ui] ${part}: ${message}`)
}

/** A `mergeProps(part, ...consumerLayers)` for one framework's spelling. */
export function createMergeProps(options: MergeOptions) {
  const { isHandler, mergeStyle, refKey, composeRefs } = options
  const handler = (key: string, value: unknown): value is Handler =>
    typeof value === "function" && isHandler(key)
  const keepOnNull = (key: string) => key === "class" || key === "style" || isHandler(key)

  function mergeTwo(base: AdapterProps, layer: PropsLayer): AdapterProps {
    // A string-keyed record read through its own keys, symbol keys included.
    const top = layer as AdapterProps
    const out: AdapterProps = { ...base }
    const critical = (base[CRITICAL] as readonly string[] | undefined) ?? []
    for (const key of Reflect.ownKeys(top)) {
      const a = base[key]
      const b = top[key]
      if (typeof key === "symbol") {
        // Symbol keys (Svelte attachments) are distinct per consumer: keep both.
        if (key === refKey && a !== undefined && b !== undefined && composeRefs) {
          out[key] = composeRefs(a, b)
        } else if (b !== undefined) out[key] = b
        continue
      }
      const empty = b === undefined || (b === null && (keepOnNull(key) || critical.includes(key)))
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
        out[key] = handler(key, b) ? chain(linksOf(b, false)) : b
      } else if (handler(key, a) && handler(key, b)) {
        // A handler that is not a chain yet can only be the part's own.
        out[key] = chain([...linksOf(b, false), ...linksOf(a, !(CHAIN in a))])
      } else if (key === "class") {
        out[key] = [a, b]
      } else if (key === "style") {
        out[key] = mergeStyle(a, b)
      } else if (key === refKey && composeRefs) {
        out[key] = composeRefs(a, b)
      } else {
        out[key] = b
        if (process.env.NODE_ENV !== "production" && critical.includes(key) && a !== b) {
          warnCritical(base, key, `overriding "${key}" can break its accessibility.`)
        }
      }
    }
    return out
  }

  return function mergeProps(part: PropsLayer, ...layers: PropsLayer[]): AdapterProps {
    let out = { ...part } as AdapterProps
    for (const layer of layers) out = mergeTwo(out, layer)
    return out
  }
}

/**
 * A part's own props from several core modules (connect, press, hover, focus): later values
 * win, except same-named handlers, which all run in order.
 */
export function joinHandlers(
  isHandler: (key: string) => boolean,
  ...sources: Readonly<AdapterProps>[]
): AdapterProps {
  const out: AdapterProps = {}
  for (const source of sources) {
    for (const key of Reflect.ownKeys(source)) {
      const value = source[key]
      const prev = out[key]
      out[key] =
        typeof key === "string" &&
        isHandler(key) &&
        typeof prev === "function" &&
        typeof value === "function"
          ? (e: unknown) => {
              prev(e)
              value(e)
            }
          : value
    }
  }
  return out
}

/** Removes the CRITICAL marker before props reach an element. */
export function stripMarker(props: AdapterProps): AdapterProps {
  if (!(CRITICAL in props)) return props
  const { [CRITICAL]: _, ...rest } = props
  return rest
}
