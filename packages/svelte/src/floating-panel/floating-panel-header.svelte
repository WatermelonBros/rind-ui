<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { floatingPanelContext } from "./context"
import type { FloatingPanelPartProps } from "./types"

/** The title bar. */
const { child, children, ...rest }: FloatingPanelPartProps = $props()
const ctx = floatingPanelContext.get()
const merged = $derived(stripMarker(mergeProps(normalizeProps(ctx.api().header()), rest)))
</script>

{#if child}
  {@render child({ props: merged, state: ctx.state() })}
{:else}
  <div {...attrs(merged)}>{@render children?.(ctx.state())}</div>
{/if}
