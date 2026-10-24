<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { colorArea } from "./context"
import type { ColorAreaPartProps } from "./types"

// The gradient: decorative.
const { child, children, ...rest }: ColorAreaPartProps = $props()
const ctx = colorArea.get()
const merged = $derived(stripMarker(mergeProps(normalizeProps(ctx.api().background()), rest)))
</script>

{#if child}
  {@render child({ props: merged, state: ctx.state() })}
{:else}
  <div {...attrs(merged)}>{@render children?.(ctx.state())}</div>
{/if}
