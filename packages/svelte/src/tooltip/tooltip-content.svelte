<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { elementRef } from "../element-ref.svelte"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { api, isOpen, tooltipHost, usePart } from "./context.svelte"
import type { TooltipContentProps } from "./types"

const { child, children, ...rest }: TooltipContentProps = $props()
const ctx = tooltipHost.get()
const el = elementRef("div")
const part = usePart(ctx, () => el.current)
// Referenced by the trigger only once it exists: a portalled content mounts after hydration,
// so the server markup never has a dangling IDREF.
$effect(() => {
  ctx.shared.contentMounted = true
  return () => {
    ctx.shared.contentMounted = false
  }
})
const merged = $derived(
  stripMarker(
    mergeProps({ ...normalizeProps(api(ctx).content()), hidden: part.hidden, ...el.props }, rest),
  ),
)
const current = $derived({ open: isOpen(ctx) })
</script>

{#if child}
  {@render child({ props: merged, state: current })}
{:else}
  <div {...attrs(merged)}>{@render children?.(current)}</div>
{/if}
