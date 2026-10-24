<script lang="ts">
// Menubar parts (design §7): Root (the bar's service, its item registry and the port to its
// menus), Menu (an ordinary Menu root level hosted by the bar) and Trigger (the menu's trigger
// in menubar mode, plus the bar's roving wiring). Inside a menu, the Menu parts.
import {
  announcerCapability,
  type CollectionKey,
  createListCollection,
  layoutCapability,
  type MenubarMenus,
  type MenubarValueReason,
  menubarConnect,
  menubarMachine,
  menuIds,
} from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import { DEV } from "../dev"
import { elementRef } from "../element-ref.svelte"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { useCollectionItems } from "../use-collection-items.svelte"
import { useMachine } from "../use-machine.svelte"
import { levelOf, type MenuHandle, menubar } from "./context"
import type { MenubarRootProps } from "./types"

let {
  value = $bindable(),
  defaultValue,
  onValueChange,
  orientation = "horizontal",
  loop = true,
  modal = true,
  disabled = false,
  focusableWhenDisabled = true,
  actions = $bindable(),
  id,
  child,
  children,
  ...rest
}: MenubarRootProps = $props()
const EMPTY = createListCollection<{ key: string }>({
  items: [],
  getKey: (i) => i.key,
  getText: (i) => i.key,
})
const env = useEnvironment(announcerCapability, layoutCapability)
const uid = $props.id()
const instance = $derived(id ?? uid)
const items = useCollectionItems()
const handles = new Map<CollectionKey, MenuHandle>()
const closing = new Set<CollectionKey>()
// The port to the menus: idempotent (a parent's value may repeat what already happened).
const menus: MenubarMenus = {
  open(key, how) {
    const h = handles.get(key)
    // A reopened menu reports its next close again (a mark its last close left behind).
    closing.delete(key)
    if (!h || h.isOpen()) return
    if (how.edge) h.send({ type: "TRIGGER_KEY", key: how.edge })
    else h.send({ type: "TRIGGER_PRESS", modality: how.modality })
  },
  close(key, { switching }) {
    const h = handles.get(key)
    if (!h?.isOpen()) return
    // Cleared by the menu's onOpenChange, which may run after this returns; at once when the
    // menu did not close (nothing will be reported), and by the next open otherwise.
    closing.add(key)
    h.send(switching ? { type: "TREE.SIBLING_OPENED" } : { type: "CLOSE" })
    if (h.isOpen()) closing.delete(key)
  },
}
const ids = untrack(() => ({
  list: `${instance}-menubar`,
  item: (key: CollectionKey) => menuIds(levelOf(instance, key)).trigger,
}))
const machine = useMachine(
  menubarMachine,
  () => ({
    collection: items.collection ?? EMPTY,
    strategy: "roving" as const,
    ids,
    loop,
    // Disabled items stay reachable by the bar's arrows and typeahead unless `false`; keyboard
    // switching between open menus skips them either way.
    focusableWhenDisabled,
    orientation,
    modal,
    disabled,
    menus,
    ...(value !== undefined ? { value } : {}),
    ...(defaultValue !== undefined ? { defaultValue } : {}),
    onValueChange: (v: string | null, d: { reason: MenubarValueReason; event: unknown }) => {
      onValueChange?.(v, d)
      if (value !== undefined) value = v
    },
  }),
  env,
)
const open = $derived(machine.view.values.value ?? null)
const el = elementRef("div")
let focusWithin = $state(false)
const api = $derived(
  menubarConnect(
    {
      instance,
      collection: items.collection ?? EMPTY,
      highlightedKey: machine.view.context.highlightedKey,
      focusWithin,
      pending: items.collection === null,
      value: open,
      orientation,
      disabled,
      focusableWhenDisabled,
      modal,
    },
    machine.send,
    env,
  ),
)
untrack(() => {
  actions = { focus: () => machine.send({ type: "FOCUS_MENUBAR" }) }
})
// An initial value (controlled or default) opens its menu once the menus are mounted (their
// handles register in the children's effects, which run first).
const initial = untrack(() => open)
$effect(() => {
  if (initial !== null) untrack(() => machine.send({ type: "VALUE.SYNC" }))
})
// Development: a menubar needs a name.
$effect(() => {
  const node = el.current
  if (!DEV || !node) return
  if (!node.getAttribute("aria-label") && !node.getAttribute("aria-labelledby")) {
    console.warn(
      `[rind-ui] menubar: #${node.id} has no accessible name; pass aria-label or aria-labelledby`,
    )
  }
})
// Render order (the server tab stop): the first item to claim it, reset with each update.
let first: CollectionKey | null = null
$effect.pre(() => {
  void items.collection
  first = null
})
menubar.set({
  instance: () => instance,
  api: () => api,
  send: machine.send,
  registry: items.registry,
  handles,
  closing,
  root: () => el.current,
  orientation: () => orientation,
  modal: () => modal,
  disabled: () => disabled,
  claimFirst: (key) => {
    first ??= key
    return first === key
  },
})
const merged = $derived(
  stripMarker(
    mergeProps(
      {
        ...normalizeProps(api.root()),
        onfocusin: () => {
          focusWithin = true
        },
        onfocusout: (e: FocusEvent) => {
          const node = e.currentTarget as Element
          if (!node.contains(e.relatedTarget as Node | null)) focusWithin = false
        },
        ...el.props,
      },
      rest,
    ),
  ),
)
const current = $derived({ open: open !== null, orientation })
</script>

{#if child}
  {@render child({ props: merged, state: current })}
{:else}
  <div {...attrs(merged)}>{@render children?.(current)}</div>
{/if}
