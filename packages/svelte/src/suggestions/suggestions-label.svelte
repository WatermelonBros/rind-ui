<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { suggestionsContext } from "./context"
import type { SuggestionsLabelProps } from "./types"

const { child, children, ...rest }: SuggestionsLabelProps = $props()
const ctx = suggestionsContext.get()
const merged = $derived(stripMarker(mergeProps(normalizeProps(ctx.api().label()), rest)))
</script>

{#if child}
  {@render child({ props: merged, state: ctx.state() })}
{:else}
  <span {...attrs(merged)}>{@render children?.(ctx.state())}</span>
{/if}
