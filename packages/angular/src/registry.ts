import {
  afterNextRender,
  computed,
  DestroyRef,
  effect,
  inject,
  PLATFORM_ID,
  type Signal,
  signal,
  untracked,
} from "@angular/core"
import {
  createPartRegistry,
  type PartRegistry,
  type PartRegistryOptions,
} from "@rind-ui/core/internal"

/**
 * One registry per instance, created on first read (after the inputs are set: the root id may
 * be the consumer's), marked mounted after the first render, when its parts have registered.
 */
export function injectPartRegistry<P extends string>(
  options: () => PartRegistryOptions<P>,
): () => PartRegistry<P> {
  let registry: PartRegistry<P> | undefined
  const get = () => {
    registry ??= createPartRegistry(untracked(options))
    return registry
  }
  if (inject(PLATFORM_ID) === "browser") afterNextRender(() => get().mount())
  inject(DestroyRef).onDestroy(() => registry?.unmount())
  return get
}

/**
 * Declares a rendered part with its final id. From an effect: effects run in the first change
 * detection, before the root's after-render mount, so the root sees every part it has.
 */
export function injectRegisterPart<P extends string>(
  registry: () => PartRegistry<P>,
  part: P,
  id: () => string | undefined,
): void {
  effect(() => {
    const value = id()
    untracked(() => registry().set(part, value))
  })
  inject(DestroyRef).onDestroy(() => registry().set(part, undefined))
}

/** The id a relation to `part` uses: only rendered parts, and expected parts before mount. */
export function injectRenderedId<P extends string>(
  registry: () => PartRegistry<P>,
  part: P,
): Signal<string | undefined> {
  const version = signal(0)
  if (inject(PLATFORM_ID) === "browser") {
    const destroy = inject(DestroyRef)
    afterNextRender(() => {
      destroy.onDestroy(registry().subscribe(() => version.update((v) => v + 1)))
      version.update((v) => v + 1)
    })
  }
  return computed(() => {
    version()
    return registry().read(part)
  })
}
