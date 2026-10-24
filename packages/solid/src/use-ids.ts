import {
  createPartRegistry,
  type PartRegistry,
  type PartRegistryOptions,
} from "@rind-ui/core/internal"
import { createComputed, createSignal, createUniqueId, onCleanup } from "solid-js"
import { afterMount } from "./lifecycle"

/** The instance's root id: the consumer's `id`, or `createUniqueId()` (stable through hydration). */
export function useRootId(id: () => string | undefined): () => string {
  const generated = createUniqueId()
  return () => id() ?? generated
}

/** One registry per instance, marked mounted after the instance (and its parts) mounted. */
export function usePartRegistry<P extends string>(
  options: PartRegistryOptions<P>,
): PartRegistry<P> {
  const registry = createPartRegistry(options)
  afterMount(() => registry.mount())
  onCleanup(() => registry.unmount())
  return registry
}

/**
 * Declares a rendered part with its final id; removed on cleanup. Set while rendering, not in
 * a mount callback: the Root's registry marks the instance mounted in a callback created
 * before its parts', so a part's later one would miss the "expected part" check.
 */
export function useRegisterPart<P extends string>(
  registry: PartRegistry<P>,
  part: P,
  id: () => string | undefined,
) {
  let current: string | undefined
  createComputed(() => {
    current = id()
    registry.set(part, current)
  })
  // Children are disposed before their Root: removing at once would notify the Root's
  // listeners while it is being torn down. A part rendered again in the same tick wins.
  onCleanup(() => {
    const removed = current
    queueMicrotask(() => {
      if (registry.read(part) === removed) registry.set(part, undefined)
    })
  })
}

/** The id a relation to `part` uses: only rendered parts, and expected parts before mount. */
export function useRenderedId<P extends string>(registry: PartRegistry<P>, part: P) {
  const [id, setId] = createSignal(registry.read(part))
  afterMount(() => {
    onCleanup(registry.subscribe(() => setId(registry.read(part))))
    setId(registry.read(part))
  })
  return id
}
