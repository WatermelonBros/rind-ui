<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { stepperContext, stepperItem } from "./context.svelte"
import type { StepperSpanProps } from "./types"

const { child, children, ...rest }: StepperSpanProps = $props()
const ctx = stepperContext.get()
const item = stepperItem.get()
let el: Element | null = null
// The title's text names the announcement and the content region (it can change).
const observe = (node: Element) => {
  el = node
  const report = () =>
    ctx.registry.title(
      untrack(() => item.index()),
      node.textContent?.trim() ?? "",
    )
  report()
  const observer = typeof MutationObserver === "function" ? new MutationObserver(report) : null
  observer?.observe(node, { characterData: true, childList: true, subtree: true })
  return () => {
    observer?.disconnect()
    if (el === node) el = null
    ctx.registry.title(
      untrack(() => item.index()),
      "",
    )
  }
}
const merged = $derived(
  stripMarker(mergeProps(normalizeProps(ctx.api().title(item.index())), rest)),
)
</script>

{#if child}
  {@render child({ props: merged, state: ctx.state() })}
{:else}
  <span {...attrs(merged)} {@attach observe}>{@render children?.(ctx.state())}</span>
{/if}
