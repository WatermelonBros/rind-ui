<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { tocContext } from "./context"
import type { TableOfContentsTitleProps } from "./types"

const { child, children, ...rest }: TableOfContentsTitleProps = $props()
const ctx = tocContext.get()
$effect(() => {
  untrack(() => ctx.setTitled(true))
  return () => untrack(() => ctx.setTitled(false))
})
const merged = $derived(stripMarker(mergeProps(normalizeProps(ctx.api().title()), rest)))
</script>

{#if child}
  {@render child({ props: merged, state: ctx.state() })}
{:else}
  <h2 {...attrs(merged)}>{@render children?.(ctx.state())}</h2>
{/if}
