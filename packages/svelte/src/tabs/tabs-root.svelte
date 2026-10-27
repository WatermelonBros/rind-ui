<script lang="ts">
import {
  announcerCapability,
  type ChangeDetails,
  createListCollection,
  layoutCapability,
  type TabsEvent,
  tabsConnect,
  tabsIds,
  tabsMachine,
} from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { SvelteSet } from "svelte/reactivity"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { declaredStop, useCollectionItems } from "../use-collection-items.svelte"
import { useMachine } from "../use-machine.svelte"
import { tabsContext } from "./context"
import type { TabsRootProps } from "./types"

const EMPTY = createListCollection<{ key: string }>({
  items: [],
  getKey: (i) => i.key,
  getText: (i) => i.key,
})

let {
  value = $bindable(),
  defaultValue,
  onValueChange,
  activationMode = "automatic",
  orientation = "horizontal",
  loop = true,
  inactivePanels = "unmount",
  disabled = false,
  focusableWhenDisabled = false,
  id,
  child,
  children,
  ...rest
}: TabsRootProps = $props()

const env = useEnvironment(announcerCapability, layoutCapability)
const uid = $props.id()
const instance = $derived(id ?? uid)
const ids = $derived.by(() => {
  const t = tabsIds(instance)
  return { list: t.list, item: t.tab }
})
const items = useCollectionItems()
const collection = $derived(items.collection ?? EMPTY)
const machine = useMachine(
  tabsMachine,
  () => ({
    collection,
    strategy: "roving" as const,
    ids,
    loop,
    focusableWhenDisabled,
    value,
    defaultValue,
    onValueChange: (next: string | null, details: ChangeDetails<TabsEvent>) => {
      let cancelled = false
      onValueChange?.(next, {
        ...details,
        cancel: () => {
          cancelled = true
          details.cancel()
        },
      })
      if (!cancelled && value !== undefined) value = next
    },
    activationMode,
    disabled,
  }),
  env,
)
const current = $derived(machine.view.values.value ?? null)
const panels = new SvelteSet<string>()
// ponytail: before the tabs register (server render), every declared tab is taken to have a
// panel (React reads its declared panels); a tab without one gets aria-controls until mount.
const declared: string[] = []
// Uncontrolled with no default, the first declared enabled tab is shown already, so the server
// HTML has a selected tab and its panel (the machine selects the same one once the tabs register).
let firstEnabled: string | null = null
const shown = () =>
  items.collection === null && current === null && value === undefined ? firstEnabled : current
const baseStop = declaredStop()
const api = (pendingStop: string | null = null) =>
  tabsConnect(
    {
      instance,
      collection,
      value: shown(),
      highlightedKey: machine.view.context.highlightedKey,
      pending: items.collection === null,
      pendingStop,
      orientation,
      activationMode,
      inactivePanels,
      disabled,
      focusableWhenDisabled,
      focusWithin: machine.view.matches("focused"),
      renderedPanels:
        items.collection === null
          ? new Set(declared.filter((k) => inactivePanels !== "unmount" || k === shown()))
          : panels,
      panelTabbable: machine.view.context.panelTabbable,
      direction: machine.view.context.direction,
      indicator: machine.view.context.indicator,
      revealed: machine.view.context.revealed,
    },
    machine.send,
    env,
  )
tabsContext.set({
  api,
  send: machine.send,
  registry: items.registry,
  instance: () => instance,
  value: shown,
  disabled: () => disabled,
  inactivePanels: () => inactivePanels,
  orientation: () => orientation,
  collection: () => items.collection,
  registerPanel: (key) => {
    panels.add(key)
    return () => panels.delete(key)
  },
  declared,
  stop: (key, keyDisabled) => {
    firstEnabled ??= baseStop(key, keyDisabled, [])
    const now = shown()
    return baseStop(key, keyDisabled, now === null ? [] : [now])
  },
})
const merged = $derived(stripMarker(mergeProps(normalizeProps(api().root()), rest)))
const rootState = $derived({ value: shown(), orientation })
</script>

{#if child}
  {@render child({ props: merged, state: rootState })}
{:else}
  <div {...attrs(merged)}>{@render children?.(rootState)}</div>
{/if}
