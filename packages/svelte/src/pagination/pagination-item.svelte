<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { paginationContext } from "./context"
import type { PaginationItemProps } from "./types"

const { type = "page", child, children, ...rest }: PaginationItemProps = $props()
const ctx = paginationContext.get()
const merged = $derived(stripMarker(mergeProps(normalizeProps(ctx.api().item(type)), rest)))
</script>

{#if child}
  {@render child({ props: merged, state: undefined })}
{:else}
  <li {...attrs(merged)}>{@render children?.()}</li>
{/if}
