<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { frameHost } from "./context.svelte"
import type { TableFramePartProps } from "./types"

const { child, children, ...rest }: TableFramePartProps = $props()
const f = frameHost.get()
const merged = $derived(stripMarker(mergeProps(normalizeProps(f.api().footer()), rest)))
const current = $derived({ expanded: f.expanded() })
</script>

{#if child}
  {@render child({ props: merged, state: current })}
{:else}
  <div {...attrs(merged)}>{@render children?.(current)}</div>
{/if}
