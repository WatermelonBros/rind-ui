<script lang="ts">
import { observeTabbable, toKey, untilFound } from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import { elementRef } from "../element-ref.svelte"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { tabsContext } from "./context"
import type { TabsPanelProps } from "./types"

const { value, child, children, ...rest }: TabsPanelProps = $props()
const ctx = tabsContext.get()
const env = useEnvironment()
const key = $derived(toKey(value))
const selected = $derived(ctx.value() === key)
const rendered = $derived(ctx.api().panelRendered(key))
const el = elementRef("div")
// Registered while rendered (aria-controls on the tab).
$effect(() => {
  if (!rendered) return
  const v = value
  return untrack(() => ctx.registerPanel(v))
})
// A visible panel without tabbable content is itself a tab stop (re-evaluated live).
$effect(() => {
  const node = el.current
  const k = key
  if (!node || !selected) return
  return untrack(() =>
    observeTabbable(node, (tabbable) => ctx.send({ type: "PANEL.TABBABLE", key: k, tabbable })),
  )
})
// until-found: imperative; beforematch selects the tab.
let finder: ReturnType<typeof untilFound> | null = null
$effect(() => {
  const node = el.current
  const k = key
  if (ctx.inactivePanels() !== "until-found" || !(node instanceof HTMLElement)) return
  return untrack(() => {
    const h = untilFound(node, {
      scheduler: env.scheduler,
      isOpen: () => selected,
      onReveal: () => ctx.send({ type: "find-in-page", key: k }),
    })
    finder = h
    return () => {
      h.dispose()
      finder = null
    }
  })
})
// Re-applied after every update of the selection.
$effect(() => {
  void selected
  void el.current
  untrack(() => finder?.sync())
})
const merged = $derived(
  stripMarker(mergeProps({ ...normalizeProps(ctx.api().panel(key)), ...el.props }, rest)),
)
const current = $derived({ selected })
</script>

{#if rendered}
  {#if child}
    {@render child({ props: merged, state: current })}
  {:else}
    <div {...attrs(merged)}>{@render children?.(current)}</div>
  {/if}
{/if}
