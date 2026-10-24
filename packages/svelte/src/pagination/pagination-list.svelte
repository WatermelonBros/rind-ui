<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { paginationContext } from "./context"
import type { PaginationListProps } from "./types"

const { child, children, ...rest }: PaginationListProps = $props()
const ctx = paginationContext.get()
const merged = $derived(stripMarker(mergeProps(normalizeProps(ctx.api().list()), rest)))
</script>

{#if child}
  {@render child({ props: merged, state: undefined })}
{:else}
  <ul {...attrs(merged)}>{@render children?.()}</ul>
{/if}
