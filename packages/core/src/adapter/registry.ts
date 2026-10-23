// The ids of the parts an instance currently renders, outside any framework's state, so ARIA
// relations reference only rendered parts (react-adapter "Stable Ids", "Expected Parts").
// Shared by the Vue and Svelte adapters; each wires `mount` after its instance mounted.
import { partId } from "../ids"

// Bundlers replace `process.env.NODE_ENV` and drop the dead branch in production builds.
declare const process: { env: { NODE_ENV?: string } }

export interface PartRegistry<P extends string> {
  /** The id an ARIA relation to `part` should use now. */
  read(part: P): string | undefined
  /** On the server and during hydration: expected parts by derived id. */
  readServer(part: P): string | undefined
  subscribe(listener: () => void): () => void
  set(part: P, id: string | undefined): void
  /** Called once the whole instance mounted; checks expected parts. */
  mount(): void
  unmount(): void
}

export interface PartRegistryOptions<P extends string> {
  /** The component scope, for warnings. */
  readonly scope: string
  /** The instance's root id; part ids derive from it (`partId(scope, root, part)`). */
  readonly root: string
  /** Parts the anatomy expects: referenced before mount, warned about when absent. */
  readonly expected?: readonly P[]
  /** Referenced before mount like `expected`, without the warning. */
  readonly optional?: readonly P[]
}

export function createPartRegistry<P extends string>(
  options: PartRegistryOptions<P>,
): PartRegistry<P> {
  const ids = new Map<P, string>()
  const listeners = new Set<() => void>()
  const expected = new Set([...(options.expected ?? []), ...(options.optional ?? [])])
  const required = new Set(options.expected ?? [])
  const warned = new Set<P>()
  let mounted = false
  const notify = () => {
    for (const l of listeners) l()
  }
  return {
    read: (part) =>
      mounted
        ? ids.get(part)
        : expected.has(part)
          ? partId(options.scope, options.root, part)
          : undefined,
    readServer: (part) =>
      expected.has(part) ? partId(options.scope, options.root, part) : undefined,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    set(part, id) {
      if (ids.get(part) === id) return
      if (id === undefined) ids.delete(part)
      else ids.set(part, id)
      if (mounted) notify()
    },
    mount() {
      mounted = true
      if (process.env.NODE_ENV !== "production") {
        for (const part of required) {
          if (ids.has(part) || warned.has(part)) continue
          warned.add(part)
          console.warn(
            `[rind-ui] ${options.scope}: the expected part "${part}" is not rendered; relations to it are removed.`,
          )
        }
      }
      notify()
    },
    unmount() {
      mounted = false
    },
  }
}
