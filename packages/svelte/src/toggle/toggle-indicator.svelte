<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import type { HTMLAttributes } from "svelte/elements"
import { mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { toggleContext } from "./context"
import type { ToggleIndicatorProps } from "./types"

const { child, children, fallback, ...rest }: ToggleIndicatorProps = $props()
const ctx = toggleContext.get()
const current = $derived(ctx.state())
const merged = $derived(stripMarker(mergeProps(normalizeProps(ctx.api().indicator()), rest)))
</script>

{#if child}
  {@render child({ props: merged, state: current })}
{:else}
  <!-- Connect's props are the span's attributes. -->
  <span {...merged as HTMLAttributes<HTMLSpanElement>}>{@render (current.pressed ? children : fallback)?.(current)}</span>
{/if}
