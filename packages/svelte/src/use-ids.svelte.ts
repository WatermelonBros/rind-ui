import {
  createPartRegistry,
  type PartRegistry,
  type PartRegistryOptions,
} from "@rind-ui/core/internal"

/** One registry per instance, marked mounted once the instance (and its parts) mounted. */
export function usePartRegistry<P extends string>(
  options: PartRegistryOptions<P>,
): PartRegistry<P> {
  const registry = createPartRegistry(options)
  // Parent effects run after their children's: every rendered part registered by then.
  $effect(() => {
    registry.mount()
    return () => registry.unmount()
  })
  return registry
}

/** Declares a rendered part with its final id, after mount; removed on destroy. */
export function useRegisterPart<P extends string>(
  registry: PartRegistry<P>,
  part: P,
  id: () => string | undefined,
) {
  $effect(() => {
    registry.set(part, id())
    return () => registry.set(part, undefined)
  })
}

/** The id a relation to `part` uses: only rendered parts, and expected parts before mount. Read `.current`. */
export function useRenderedId<P extends string>(registry: PartRegistry<P>, part: P) {
  let id = $state(registry.read(part))
  $effect(() => {
    id = registry.read(part)
    return registry.subscribe(() => (id = registry.read(part)))
  })
  return {
    get current() {
      return id
    },
  }
}
