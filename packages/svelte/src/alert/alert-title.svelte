<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { alertContext } from "./context"
import type { AlertTitleProps } from "./types"

const { child, children, ...rest }: AlertTitleProps = $props()
const ctx = alertContext.get()
const merged = $derived(stripMarker(mergeProps(normalizeProps(ctx.connect().title()), rest)))
const current = $derived({ open: ctx.open() })
</script>

{#if child}
  {@render child({ props: merged, state: current })}
{:else}
  <div {...attrs(merged)}>{@render children?.(current)}</div>
{/if}
