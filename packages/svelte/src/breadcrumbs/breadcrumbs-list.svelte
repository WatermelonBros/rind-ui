<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { breadcrumbsContext } from "./context"
import type { BreadcrumbsListProps } from "./types"

const { child, children, ...rest }: BreadcrumbsListProps = $props()
const root = breadcrumbsContext.get()
const merged = $derived(stripMarker(mergeProps(normalizeProps(root.connect().list()), rest)))
const current = $derived({ collapsed: root.trail().collapsed.length > 0 })
</script>

{#if child}
  {@render child({ props: merged, state: current })}
{:else}
  <ol {...attrs(merged)}>{@render children?.(current)}</ol>
{/if}
