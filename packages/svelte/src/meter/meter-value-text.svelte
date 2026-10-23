<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import type { HTMLAttributes } from "svelte/elements"
import { mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { meterContext } from "./context"
import type { MeterPartProps } from "./types"

// The visible value text, `aria-hidden` (Root carries it as `aria-valuetext`).
const { child, children, ...rest }: MeterPartProps = $props()
const ctx = meterContext.get()
const merged = $derived(stripMarker(mergeProps(normalizeProps(ctx.api().valueText()), rest)))
const current = $derived(ctx.state())
</script>

{#if child}
  {@render child({ props: merged, state: current })}
{:else}
  <span {...merged as HTMLAttributes<HTMLSpanElement>}>{#if children}{@render children(current)}{:else}{current.valueText}{/if}</span>
{/if}
