<script lang="ts">
import { warnStatusPlacement } from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { elementRef } from "../element-ref.svelte"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { skeletonContext } from "./context"
import type { SkeletonStatusProps } from "./types"

const { child, children, ...rest }: SkeletonStatusProps = $props()
const ctx = skeletonContext.get()
const el = elementRef("span")
// The element mounts again on reload.
$effect(() => {
  if (el.current) warnStatusPlacement(el.current)
})
const own = $derived(ctx.connect().status())
const merged = $derived(
  own ? stripMarker(mergeProps({ ...normalizeProps(own), ...el.props }, rest)) : null,
)
const current = $derived({ loading: ctx.loading() })
</script>

{#if merged}
  {#if child}
    {@render child({ props: merged, state: current })}
  {:else}
    <span {...attrs(merged)}
      >{#if children}{@render children(current)}{:else}{ctx.messages().loading}{/if}</span
    >
  {/if}
{/if}
