import { partId } from "@rind-ui/core"
import { useEffect, useId, useLayoutEffect, useMemo, useSyncExternalStore } from "react"

// Bundlers replace `process.env.NODE_ENV` and drop the dead branch in production builds.
declare const process: { env: { NODE_ENV?: string } }

// useLayoutEffect warns on the server; it never runs there anyway.
const useIsoLayoutEffect = typeof document === "undefined" ? useEffect : useLayoutEffect

/** The instance's root id: the consumer's `id`, or one from React's `useId`. */
export function useRootId(id?: string): string {
  const generated = useId()
  return id ?? generated
}

/** The ids of the parts currently rendered. Lives outside React state and context value. */
export interface PartRegistry<P extends string> {
  /** The id an ARIA relation to `part` should use now (see `useRenderedId`). */
  read(part: P): string | undefined
  /** The same on the server and during hydration: expected parts by derived id. */
  readServer(part: P): string | undefined
  subscribe(listener: () => void): () => void
  set(part: P, id: string | undefined): void
  /** Called after the whole instance committed; checks expected parts. */
  mount(): void
  unmount(): void
}

export interface PartRegistryOptions<P extends string> {
  /** The component scope, for warnings. */
  readonly scope: string
  /** The instance's root id; part ids derive from it (`partId(scope, root, part)`). */
  readonly root: string
  /**
   * Parts the anatomy expects (e.g. Title, Description). Relations to them use the derived
   * id on the server and during hydration, so server HTML carries them even when the part
   * renders after the element that references it; if one is not rendered, the relation is
   * removed after commit and a development warning names it.
   */
  readonly expected?: readonly P[]
}

function createRegistry<P extends string>(options: PartRegistryOptions<P>): PartRegistry<P> {
  const ids = new Map<P, string>()
  const listeners = new Set<() => void>()
  const expected = new Set(options.expected ?? [])
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
        for (const part of expected) {
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

/**
 * One registry per instance. Its layout effect runs after every part's (children commit
 * first), so it marks the instance mounted once all rendered parts registered.
 */
export function usePartRegistry<P extends string>(
  options: PartRegistryOptions<P>,
): PartRegistry<P> {
  const { scope, root, expected } = options
  // `expected` is the component's static anatomy: it never changes for an instance.
  // biome-ignore lint/correctness/useExhaustiveDependencies: see above
  const registry = useMemo(
    () => createRegistry<P>(expected ? { scope, root, expected } : { scope, root }),
    [scope, root],
  )
  useIsoLayoutEffect(() => {
    registry.mount()
    return () => registry.unmount()
  }, [registry])
  return registry
}

/**
 * Declares a rendered part with its final id (the consumer's or the derived one), after
 * commit. Nothing is written during render, so a render that never commits leaves nothing.
 */
export function useRegisterPart<P extends string>(registry: PartRegistry<P>, part: P, id: string) {
  useIsoLayoutEffect(() => {
    registry.set(part, id)
    return () => registry.set(part, undefined)
  }, [registry, part, id])
}

/** The id a relation to `part` uses: only rendered parts, and expected parts before commit. */
export function useRenderedId<P extends string>(registry: PartRegistry<P>, part: P) {
  return useSyncExternalStore(
    registry.subscribe,
    () => registry.read(part),
    () => registry.readServer(part),
  )
}
