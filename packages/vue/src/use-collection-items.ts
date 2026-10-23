// Static item parts → a collection: each part registers on mount; the root receives one
// collection per flush (the same instance when nothing changed, so the machine sees no change).
import {
  type Collection,
  createItemRegistry,
  createListCollection,
  type ItemRegistration,
  type ItemRegistry,
  type RegisteredItem,
} from "@rind-ui/core"
import {
  isVNode,
  onBeforeUnmount,
  onMounted,
  onUpdated,
  type Ref,
  type ShallowRef,
  type Slots,
  shallowRef,
  type VNodeChild,
  watch,
} from "vue"

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
 * mount's items have registered (the server render and the hydrating render).
 */
export function useCollectionItems(): {
  readonly collection: ShallowRef<Collection<RegisteredItem> | null>
  readonly registry: ItemRegistry
} {
  const collection = shallowRef<Collection<RegisteredItem> | null>(null)
  const registry = createItemRegistry((items) => {
    if (!sameItems(collection.value, items)) collection.value = toCollection(items)
  })
  // After the items' own mount and update hooks (a parent's run last): known in the same tick.
  onMounted(() => registry.flush())
  onUpdated(() => registry.flush())
  return { collection, registry }
}

/** Registers an item part's element with the root's registry while mounted. */
export function useRegisterItem(
  registry: ItemRegistry | null,
  item: () => Omit<ItemRegistration, "element">,
  el: Ref<Element | null>,
): void {
  let stop: (() => void) | undefined
  onMounted(() =>
    watch(
      () => {
        const it = item()
        // Compared by value: equal sections and keywords are the same registration.
        return JSON.stringify([
          it.key,
          it.textValue,
          it.disabled,
          it.section?.key,
          it.section?.label,
          it.keywords ?? [],
        ])
      },
      () => {
        stop?.()
        stop = undefined
        const element = el.value
        if (!element || !registry) return
        const it = item()
        stop = registry.register({ ...it, keywords: it.keywords ?? [], element })
      },
      { immediate: true },
    ),
  )
  onBeforeUnmount(() => stop?.())
}

/**
 * The server tab stop of a composite whose items have not registered yet (server render and
 * hydration): items set up in document order, so each one asks when it sets up. With a
 * selection, the first enabled selected item; without one, the first enabled item.
 * ponytail: a selection naming no declared item gets no server stop (React falls back to the
 * first enabled item); the stop appears once the items register on mount.
 */
export function declaredStop() {
  let firstEnabled: string | null = null
  let firstSelected: string | null = null
  return (value: string, disabled: boolean, selected: readonly string[]): string | null => {
    if (!disabled) {
      firstEnabled ??= value
      if (firstSelected === null && selected.includes(value)) firstSelected = value
    }
    return selected.length > 0 ? firstSelected : firstEnabled
  }
}

export interface DeclaredItem {
  readonly value: string
  readonly disabled: boolean
}

/**
 * The items of a composite declared in a slot's output (any depth, in render order, slots of
 * nested components expanded), before they register: the server render needs them. Items
 * rendered by a consumer component's own template are not seen (they follow registration).
 */
export function declaredItems(children: VNodeChild, item: unknown): readonly DeclaredItem[] {
  const out: DeclaredItem[] = []
  const walk = (node: VNodeChild) => {
    if (Array.isArray(node)) return node.forEach(walk)
    if (!isVNode(node)) return
    const props = node.props as { value?: unknown; disabled?: unknown } | null
    if (node.type === item && typeof props?.value === "string") {
      out.push({ value: props.value, disabled: props.disabled === true || props.disabled === "" })
    }
    const kids = node.children
    if (Array.isArray(kids)) walk(kids as VNodeChild)
    else if (kids && typeof kids === "object" && typeof (kids as Slots)["default"] === "function") {
      walk((kids as Slots)["default"]?.() as VNodeChild)
    }
  }
  walk(children)
  return out
}

/** The server tab stop: the first enabled declared item that is selected, else the first enabled. */
export function serverStop(
  items: readonly DeclaredItem[],
  selected: readonly string[],
): string | null {
  const enabled = items.filter((i) => !i.disabled)
  return (enabled.find((i) => selected.includes(i.value)) ?? enabled[0])?.value ?? null
}
