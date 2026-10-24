import {
  createPartRegistry,
  type PartRegistry,
  type PartRegistryOptions,
} from "@rind-ui/core/internal"
import { onBeforeUnmount, onMounted, shallowRef, useId, watch } from "vue"

/** The instance's root id: the consumer's `id`, or one from Vue's `useId` (SSR-stable). */
export function useRootId(id: () => string | undefined): () => string {
  const generated = useId()
  return () => id() ?? generated
}

/** One registry per instance, marked mounted after the instance (and its parts) mounted. */
export function usePartRegistry<P extends string>(
  options: PartRegistryOptions<P>,
): PartRegistry<P> {
  const registry = createPartRegistry(options)
  onMounted(() => registry.mount())
  onBeforeUnmount(() => registry.unmount())
  return registry
}

/** Declares a rendered part with its final id, after mount; removed before unmount. */
export function useRegisterPart<P extends string>(
  registry: PartRegistry<P>,
  part: P,
  id: () => string | undefined,
) {
  onMounted(() => {
    registry.set(part, id())
    watch(id, (next) => registry.set(part, next))
  })
  onBeforeUnmount(() => registry.set(part, undefined))
}

/** The id a relation to `part` uses: only rendered parts, and expected parts before mount. */
export function useRenderedId<P extends string>(registry: PartRegistry<P>, part: P) {
  const id = shallowRef(registry.read(part))
  onMounted(() => {
    const off = registry.subscribe(() => (id.value = registry.read(part)))
    id.value = registry.read(part)
    onBeforeUnmount(off)
  })
  return id
}
