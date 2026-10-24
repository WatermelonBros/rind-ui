<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { breadcrumbsContext, breadcrumbsItem } from "./context"
import type { BreadcrumbsSeparatorProps } from "./types"

/** A glyph after the crumb, `aria-hidden`; no default content. */
const { child, children, ...rest }: BreadcrumbsSeparatorProps = $props()
const root = breadcrumbsContext.get()
const item = breadcrumbsItem.get()
const merged = $derived(
  stripMarker(mergeProps(normalizeProps(root.connect().separator(item.state())), rest)),
)
</script>

{#if child}
  {@render child({ props: merged, state: item.state() })}
{:else}
  <span {...attrs(merged)}>{@render children?.(item.state())}</span>
{/if}
