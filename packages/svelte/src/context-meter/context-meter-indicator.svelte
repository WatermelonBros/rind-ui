<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { contextMeterContext } from "./context"
import type { ContextMeterDivProps } from "./types"

const { child, children, ...rest }: ContextMeterDivProps = $props()
const ctx = contextMeterContext.get()
const merged = $derived(stripMarker(mergeProps(normalizeProps(ctx.api().indicator()), rest)))
</script>

{#if child}
  {@render child({ props: merged, state: ctx.state() })}
{:else}
  <div {...attrs(merged)}>{@render children?.(ctx.state())}</div>
{/if}
