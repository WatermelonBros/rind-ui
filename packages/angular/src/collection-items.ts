// Static item parts → a collection: each part registers after its first render; the root
// flushes once per render, after its items (the same instance when nothing changed, so the
// machine sees no change).

import {
  afterEveryRender,
  afterNextRender,
  DestroyRef,
  effect,
  inject,
  PLATFORM_ID,
  type Signal,
  signal,
  untracked,
} from "@angular/core"
import {
  type Collection,
  createItemRegistry,
  createListCollection,
  type ItemRegistration,
  type ItemRegistry,
  type RegisteredItem,
} from "@rind-ui/core"

const sameItems = (c: Collection<RegisteredItem> | null, items: readonly RegisteredItem[]) => {
  if (!c || c.size !== items.length) return false
  return items.every((it, i) => {
    const prev = c.at(i)?.value
    return (
      prev !== undefined &&
      prev.key === it.key &&
      prev.textValue === it.textValue &&
      (prev.disabled ?? false) === (it.disabled ?? false) &&
      prev.section?.key === it.section?.key &&
      prev.section?.label === it.section?.label &&
      (prev.keywords ?? []).join("\u0000") === (it.keywords ?? []).join("\u0000")
    )
  })
}

const toCollection = (items: readonly RegisteredItem[]) =>
  createListCollection({
    items,
    getKey: (it) => it.key,
    getText: (it) => it.textValue,
    getKeywords: (it) => it.keywords ?? [],
    isDisabled: (it) => it.disabled === true,
    getSection: (it) => it.section,
  })

/**
 * The collection of the item parts registered through `registry`; null until the first
 * render's items have registered (the server render and the hydrating render).
 */
export function injectCollectionItems(): {
  readonly collection: Signal<Collection<RegisteredItem> | null>
  readonly registry: ItemRegistry
} {
  const collection = signal<Collection<RegisteredItem> | null>(null)
  const registry = createItemRegistry((items) => {
    if (!sameItems(collection(), items)) collection.set(toCollection(items))
  })
  // The `read` phase runs after every `mixedReadWrite` callback of the render: after the items
  // registered, so the collection is known in the same render.
  if (inject(PLATFORM_ID) === "browser") afterEveryRender({ read: () => registry.flush() })
  return { collection: collection.asReadonly(), registry }
}

/** Registers an item part's element with the root's registry while rendered. */
export function injectRegisterItem(
  registry: ItemRegistry | null,
  item: () => Omit<ItemRegistration, "element">,
  element: Element,
): void {
  if (!registry || inject(PLATFORM_ID) !== "browser") return
  let stop: (() => void) | undefined
  let ready = false
  let last: string | undefined
  const register = () => {
    const it = untracked(item)
    // Compared by value: equal sections and keywords are the same registration.
    const key = JSON.stringify([
      it.key,
      it.textValue,
      it.disabled,
      it.section?.key,
      it.section?.label,
      it.keywords ?? [],
    ])
    if (key === last) return
    last = key
    stop?.()
    stop = registry.register({ ...it, keywords: it.keywords ?? [], element })
  }
  afterNextRender(() => {
    ready = true
    register()
  })
  effect(() => {
    item()
    if (ready) register()
  })
  inject(DestroyRef).onDestroy(() => stop?.())
}

/**
 * The server tab stop of a composite whose items have not registered yet (server render and
 * hydration), as React's: the first enabled selected item, else the first enabled item. Each
 * item declares itself when its props first apply (in document order) and reads the stop from
 * a signal, so an earlier item follows what a later one declares.
 */
export function declaredStop() {
  const items = signal<readonly { value: string; disabled: boolean }[]>([])
  const seen = new Set<string>()
  return (value: string, disabled: boolean, selected: readonly string[]): string | null => {
    if (!seen.has(value)) {
      seen.add(value)
      items.update((all) => [...all, { value, disabled }])
    }
    const enabled = items().filter((i) => !i.disabled)
    return (enabled.find((i) => selected.includes(i.value)) ?? enabled[0])?.value ?? null
  }
}
