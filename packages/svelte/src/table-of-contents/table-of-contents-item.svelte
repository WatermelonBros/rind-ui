<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { tocContext, tocItem } from "./context"
import type { TableOfContentsItemProps } from "./types"

const { item, child, children, ...rest }: TableOfContentsItemProps = $props()
const ctx = tocContext.get()
tocItem.set(() => item)
const merged = $derived(stripMarker(mergeProps(normalizeProps(ctx.api().item(item)), rest)))
</script>

{#if child}
  {@render child({ props: merged, state: ctx.state() })}
{:else}
  <li {...attrs(merged)}>{@render children?.(ctx.state())}</li>
{/if}
