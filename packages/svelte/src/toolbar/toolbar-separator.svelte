<script lang="ts">
import type { SeparatorOrientation } from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { elementRef } from "../element-ref.svelte"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useToolbar } from "./host.svelte"
import type { ToolbarSeparatorProps } from "./types"

const { orientation, child, children, ...rest }: ToolbarSeparatorProps = $props()
const host = useToolbar("Separator")
const el = elementRef("div")
const own = $derived(normalizeProps(host.api.separator({ orientation, tag: el.tag })))
const merged = $derived(stripMarker(mergeProps({ ...own, ...el.props }, rest)))
const current = $derived({ orientation: own["data-orientation"] as SeparatorOrientation }) // set by separatorProps
</script>

{#if child}
  {@render child({ props: merged, state: current })}
{:else}
  <div {...attrs(merged)}>{@render children?.(current)}</div>
{/if}
