<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { alertContext } from "./context"
import type { AlertIconProps } from "./types"

const { label, child, children, ...rest }: AlertIconProps = $props()
const ctx = alertContext.get()
const merged = $derived(stripMarker(mergeProps(normalizeProps(ctx.connect().icon(label)), rest)))
const current = $derived({ open: ctx.open() })
</script>

{#if child}
  {@render child({ props: merged, state: current })}
{:else}
  <span {...attrs(merged)}>{@render children?.(current)}</span>
{/if}
