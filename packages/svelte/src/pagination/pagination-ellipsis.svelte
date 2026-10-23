<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { paginationContext } from "./context"
import type { PaginationEllipsisProps } from "./types"

const { position = "end", child, children, ...rest }: PaginationEllipsisProps = $props()
const ctx = paginationContext.get()
const merged = $derived(stripMarker(mergeProps(normalizeProps(ctx.api().ellipsis(position)), rest)))
</script>

{#if child}
  {@render child({ props: merged, state: undefined })}
{:else}
  <span {...attrs(merged)}>{#if children}{@render children()}{:else}…{/if}</span>
{/if}
